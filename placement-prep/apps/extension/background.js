const LEETCODE_GRAPHQL_URL = "https://leetcode.com/graphql";

const PROBLEMSET_QUERY = `
  query problemsetQuestionListV2($filters: QuestionFilterInput, $limit: Int, $searchKeyword: String, $skip: Int, $sortBy: QuestionSortByInput, $categorySlug: String) {
    problemsetQuestionListV2(
      filters: $filters
      limit: $limit
      searchKeyword: $searchKeyword
      skip: $skip
      sortBy: $sortBy
      categorySlug: $categorySlug
    ) {
      questions {
        titleSlug
        status
      }
      hasMore
    }
  }
`;

function buildFilters(statuses) {
  const statusFilter = { questionStatuses: statuses, operator: "IS" };
  const base = {
    filterCombineType: "ALL",
    statusFilter,
    acceptanceFilter: {},
    companyFilter: { companySlugs: [], operator: "IS" },
    contestPointFilter: { contestPoints: [], operator: "IS" },
    difficultyFilter: { difficulties: [], operator: "IS" },
    frequencyFilter: {},
    frontendIdFilter: {},
    languageFilter: { languageSlugs: [], operator: "IS" },
    lastSubmittedFilter: {},
    positionFilter: { positionSlugs: [], operator: "IS" },
    positionLevelFilter: { positionLevelSlugs: [], operator: "IS" },
    premiumFilter: { premiumStatus: [], operator: "IS" },
    publishedFilter: {},
    topicFilter: { topicSlugs: [], operator: "IS" },
  };
  return { filters: base, filtersV2: base };
}

function parseQuestionStatus(status) {
  if (status == null) return null;
  const s = String(status).toLowerCase();
  if (s === "ac" || s === "solved" || s === "completed") return "SOLVED";
  if (s === "notac" || s === "attempted") return "ATTEMPTED";
  return null;
}

async function getLeetCodeAuthHeaders() {
  const cookies = await chrome.cookies.getAll({ url: "https://leetcode.com" });
  const session = cookies.find((c) => c.name === "LEETCODE_SESSION");
  if (!session?.value) {
    return null;
  }

  const csrf = cookies.find((c) => c.name === "csrftoken");
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  const headers = {
    "Content-Type": "application/json",
    Cookie: cookieHeader,
    Referer: "https://leetcode.com/problemset/",
    Origin: "https://leetcode.com",
  };
  if (csrf?.value) {
    headers["X-Csrftoken"] = csrf.value;
  }
  return headers;
}

async function fetchSolvedViaGraphQL(headers, port) {
  const problems = [];
  let skip = 0;
  const limit = 100;
  let hasMore = true;
  let retries = 3;
  const { filters, filtersV2 } = buildFilters(["SOLVED", "ATTEMPTED"]);

  while (hasMore) {
    const response = await fetch(LEETCODE_GRAPHQL_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({
        query: PROBLEMSET_QUERY,
        variables: { skip, limit, categorySlug: "all-code-essentials", filters, filtersV2 },
        operationName: "problemsetQuestionListV2",
      }),
    });

    if (!response.ok) {
      if (response.status === 429 || response.status === 403) {
        if (retries > 0) {
          console.warn(`GraphQL rate limited. Retrying in 60s... (${retries} left)`);
          if (port) port.postMessage({ type: "PROGRESS", message: `Problem fetch rate limited. Pausing for 60s... (${retries} retries left)` });
          await new Promise(r => setTimeout(r, 60000));
          retries--;
          continue;
        }
      }
      console.warn(`GraphQL HTTP ${response.status}. Stopping early to process fetched data.`);
      if (port) port.postMessage({ type: "PROGRESS", message: `Problem fetch stopped early due to API limit. Processing what we have...` });
      break;
    }
    
    retries = 3; // Reset on success

    const result = await response.json();
    if (result.errors?.length) {
      console.warn("LeetCode GraphQL error:", result.errors[0]?.message);
      break;
    }

    const problemset = result?.data?.problemsetQuestionListV2;
    if (!problemset) break;

    for (const q of problemset.questions || []) {
      const slug = q.titleSlug || q.title_slug;
      if (!slug) continue;
      const parsed = parseQuestionStatus(q.status);
      if (parsed === "SOLVED" || parsed === "ATTEMPTED") {
        problems.push({ slug, status: parsed });
      }
    }

    hasMore = problemset.hasMore;
    skip += limit;
    if (skip > 15000) break;
  }

  return problems;
}

async function fetchSolvedViaContentScript() {
  const tabs = await chrome.tabs.query({ url: ["https://leetcode.com/*", "https://*.leetcode.com/*"] });
  if (!tabs.length) {
    throw new Error(
      "Open https://leetcode.com in a Chrome tab (logged in), then sync again."
    );
  }

  const tab = tabs.find((t) => t.url?.includes("leetcode.com/problemset")) || tabs[0];

  try {
    const response = await chrome.tabs.sendMessage(tab.id, { action: "FETCH_SOLVED_IN_PAGE" });
    if (response?.success && Array.isArray(response.problems)) {
      return response.problems;
    }
    throw new Error(response?.error || "Content script returned no data");
  } catch (err) {
    if (err?.message?.includes("Receiving end does not exist")) {
      throw new Error(
        "LeetCode tab needs a refresh after updating the extension. Open leetcode.com/problemset, refresh the page, then sync again."
      );
    }
    throw err;
  }
}

async function fetchSolvedProblems() {
  const headers = await getLeetCodeAuthHeaders();
  let problems = [];

  if (headers) {
    try {
      problems = await fetchSolvedViaGraphQL(headers, null);
    } catch (e) {
      console.warn("Cookie GraphQL fetch failed, trying content script:", e);
    }
  }

  if (problems.length === 0) {
    problems = await fetchSolvedViaContentScript();
  }

  if (problems.length === 0) {
    throw new Error(
      "No solved problems returned. Sign in at leetcode.com, open the problem list, refresh that tab, then sync again."
    );
  }

  return problems;
}

async function fetchSolvedSlugs() {
  const problems = await fetchSolvedProblems();
  return problems.map((p) => p.slug);
}

async function fetchSubmissionsViaREST(headers, port, timeframe, syncStatus) {
  let cutoffTimestamp;
  if (timeframe === "6_months") {
    cutoffTimestamp = Date.now() / 1000 - (6 * 30 * 24 * 3600);
  } else if (timeframe === "1_year") {
    cutoffTimestamp = Date.now() / 1000 - (12 * 30 * 24 * 3600);
  } else {
    cutoffTimestamp = 0; // all time
  }
  
  const maxPages = 1500; // max ~30,000 submissions
  const delayMs = 600; // faster fetch, relying on 429 backoff if needed
  
  let offset = 0;
  let lastKey = null;
  let pageCount = 0;
  let shouldStop = false;
  let retries = 3;

  while (!shouldStop && pageCount < maxPages) {
    let url = `https://leetcode.com/api/submissions/?offset=${offset}&limit=20`;
    if (lastKey) {
      url += `&lastkey=${encodeURIComponent(lastKey)}`;
    }

    try {
      const response = await fetch(url, { headers });
      
      if (!response.ok) {
        if (response.status === 429 || response.status === 403) {
          if (retries > 0) {
            console.warn(`Rate limited at page ${pageCount}, waiting 60s (${retries} left)`);
            port.postMessage({ type: "PROGRESS", message: `Rate limited by LeetCode. Pausing for 60s... (${retries} retries left)` });
            await new Promise(r => setTimeout(r, 60000));
            retries--;
            continue; // retry same page, don't increment offset
          }
        }
        console.warn(`REST fetch failed (HTTP ${response.status}). Stopping early.`);
        port.postMessage({ type: "PROGRESS", message: `Fetch stopped early due to API limit. Processing what we have...` });
        break;
      }
      
      retries = 3; // Reset on success
      
      const data = await response.json();
      const submissions = data.submissions_dump || [];
      const hasNext = data.has_next;
      const nextLastKey = data.last_key;

      if (submissions.length === 0) {
        port.postMessage({ type: "PROGRESS", message: `LeetCode API limit reached (fetched ${offset} records). Finishing up...` });
        break;
      }

      const levelMap = { '6_months': 1, '1_year': 2, 'all_time': 3 };
      const reqLevel = levelMap[timeframe] || 1;
      const prevLevel = syncStatus?.sync_level ? (levelMap[syncStatus.sync_level] || 0) : 0;
      const isUpdateOnly = reqLevel <= prevLevel;

      const filtered = [];
      for (const s of submissions) {
        if (s.timestamp < cutoffTimestamp) {
          if (timeframe !== "all_time") {
            port.postMessage({ type: "PROGRESS", message: `Reached cutoff date.` });
          }
          shouldStop = true;
          break;
        }

        if (syncStatus?.latest_timestamp && s.timestamp <= syncStatus.latest_timestamp) {
          if (isUpdateOnly) {
            port.postMessage({ type: "PROGRESS", message: `Reached already synced data. Update complete.` });
            shouldStop = true;
            break;
          }

          if (syncStatus.oldest_timestamp && s.timestamp >= syncStatus.oldest_timestamp) {
            continue; // Skip duplicates that are within the known synced bounds
          }
        }
        filtered.push(s);
      }

      if (filtered.length > 0) {
        port.postMessage({ type: "CHUNK", submissions: filtered });
      }

      if (shouldStop) break;

      // Stop conditions
      if (!hasNext) {
        port.postMessage({ type: "PROGRESS", message: `Reached end of submission history.` });
        shouldStop = true;
        break;
      }

      // Advance pagination
      offset += 20;          // always increment by actual page size
      lastKey = nextLastKey; // capture cursor for next page (if available)
      pageCount++;

      // Rate limit delay
      await new Promise(r => setTimeout(r, delayMs));

    } catch (e) {
      console.warn(`Failed at offset ${offset}:`, e);
      break;
    }
  }
}

async function runDeepSync(port, timeframe, syncStatus) {
  port.postMessage({ type: "PROGRESS", message: "Fetching authenticated headers..." });
  const headers = await getLeetCodeAuthHeaders();
  if (!headers) {
    port.postMessage({ type: "ERROR", message: "Not logged into LeetCode." });
    return;
  }
  
  try {
    port.postMessage({ type: "PROGRESS", message: "Fetching basic problem list..." });
    let problems = await fetchSolvedViaGraphQL(headers, port);
    if (problems.length === 0) {
      problems = await fetchSolvedViaContentScript();
    }
    
    port.postMessage({ type: "PROBLEMS", problems });
    
    port.postMessage({ type: "PROGRESS", message: "Streaming submission history from REST API..." });
    await fetchSubmissionsViaREST(headers, port, timeframe, syncStatus);
    
    port.postMessage({ type: "COMPLETE", message: "Finished fetching LeetCode data." });
  } catch (err) {
    console.error(err);
    port.postMessage({ type: "ERROR", message: err.message });
  }
}

chrome.runtime.onConnectExternal.addListener((port) => {
  if (port.name === "DEEP_SYNC") {
    port.onMessage.addListener((msg) => {
      if (msg.action === "START") {
        runDeepSync(port, msg.timeframe || "1_year", msg.syncStatus);
      }
    });
  }
});

chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  console.log("Received message from web app:", request);

  if (request.action === "GET_SOLVED_PROBLEMS") {
    fetchSolvedProblems()
      .then((problems) => {
        console.log(`Found ${problems.length} solved problems.`);
        sendResponse({ success: true, problems });
      })
      .catch((err) => {
        console.error("Sync process failed:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }

  if (request.action === "GET_SOLVED_SLUGS") {
    fetchSolvedSlugs()
      .then((slugs) => {
        console.log(`Found ${slugs.length} solved questions.`);
        sendResponse({ success: true, slugs });
      })
      .catch((err) => {
        console.error("Sync process failed:", err);
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});
