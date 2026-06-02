/**
 * Runs in leetcode.com page context — fetch includes the user's session cookies.
 */
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

async function fetchSolvedProblemsInPage() {
  const problems = [];
  let skip = 0;
  const limit = 100;
  let hasMore = true;
  const { filters, filtersV2 } = buildFilters(["SOLVED", "ATTEMPTED"]);

  while (hasMore) {
    const response = await fetch(LEETCODE_GRAPHQL_URL, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: PROBLEMSET_QUERY,
        variables: { skip, limit, categorySlug: "all-code-essentials", filters, filtersV2 },
        operationName: "problemsetQuestionListV2",
      }),
    });

    if (!response.ok) {
      throw new Error(`LeetCode HTTP ${response.status}`);
    }

    const result = await response.json();
    if (result.errors?.length) {
      throw new Error(result.errors[0]?.message || "LeetCode GraphQL error");
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

chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
  if (request.action === "FETCH_SOLVED_IN_PAGE") {
    fetchSolvedProblemsInPage()
      .then((problems) => sendResponse({ success: true, problems }))
      .catch((err) => sendResponse({ success: false, error: err.message }));
    return true;
  }
});
