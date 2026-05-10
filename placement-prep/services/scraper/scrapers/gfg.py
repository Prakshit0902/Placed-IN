import time
from typing import Any

import requests
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from config import config


class GFGScraper(BaseScraper):
    def __init__(self):
        super().__init__(source="gfg")
        self.base_url = "https://www.geeksforgeeks.org"
        self.hub_url = "https://www.geeksforgeeks.org/interview-experiences/company-interview-corner/"

    def get_urls(self) -> list[str]:
        """
        Step 1: Scrape hub page to get all company tag URLs.
        Step 2: For each tag URL, extract article URLs.
        Step 3: Return all article URLs directly — no pagination.
        """
        print("[gfg] Fetching company tag URLs from hub page...")
        tag_urls = self._get_company_tag_urls()
        print(f"[gfg] Found {len(tag_urls)} company tag pages")

        all_article_urls: list[str] = []
        seen = set()

        limit = config.SCRAPE_LIMIT

        for i, tag_url in enumerate(tag_urls):
            company = self._extract_company_from_url(tag_url)
            print(f"[gfg] [{i+1}/{len(tag_urls)}] Extracting articles for: {company}")

            article_urls = self._get_article_urls_from_tag(tag_url)
            print(f"[gfg] Found {len(article_urls)} articles for {company}")

            # Add unique article URLs and stop early if we've hit the limit
            for a in article_urls:
                if a not in seen:
                    seen.add(a)
                    all_article_urls.append(a)
                    if limit != -1 and len(all_article_urls) >= limit:
                        print(f"[gfg] Reached SCRAPE_LIMIT={limit}, stopping discovery")
                        break

            # If limit reached, stop processing more tag pages
            if limit != -1 and len(all_article_urls) >= limit:
                break

            # Polite delay between tag page requests
            time.sleep(1.0)

        # Already built a deduplicated ordered list in all_article_urls
        print(f"[gfg] Total unique article URLs found: {len(all_article_urls)}")
        return all_article_urls

    def _get_company_tag_urls(self) -> list[str]:
        """
        Scrape the hub page and return all /tag/ URLs found.
        """
        try:
            response = self.session.get(self.hub_url, timeout=15)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"[gfg] Failed to fetch hub page: {e}")
            return []

        soup = BeautifulSoup(response.text, "lxml")
        tag_urls = []

        for a in soup.find_all("a", href=True):
            href = a["href"]
            absolute = self._make_absolute(href)
            if "/tag/" in absolute and absolute not in tag_urls:
                tag_urls.append(absolute)

        return tag_urls

    def _get_article_urls_from_tag(self, tag_url: str) -> list[str]:
        """
        Scrape a company tag page and return all interview experience
        article URLs found on it.
        Only keeps URLs that contain /interview-experiences/ in the path.
        """
        try:
            response = self.session.get(tag_url, timeout=15)
            if response.status_code == 404:
                return []
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"[gfg] Failed to fetch tag page {tag_url}: {e}")
            return []

        soup = BeautifulSoup(response.text, "lxml")
        article_urls = []

        for a in soup.find_all("a", href=True):
            href = a["href"]
            absolute = self._make_absolute(href)

            # Only keep interview experience article URLs
            if "/interview-experiences/" not in absolute:
                continue

            # Skip the root listing page itself
            if absolute.rstrip("/") == f"{self.base_url}/interview-experiences":
                continue

            # Skip category/tag/page listing URLs
            skip = ["/tag/", "/category/", "/page/", "/courses/", "/jobs/"]
            if any(s in absolute for s in skip):
                continue

            if absolute not in article_urls:
                article_urls.append(absolute)

        return article_urls

    def scrape_page(self, url: str) -> list[dict[str, Any]]:
        """
        Scrape a single interview experience article.
        url here is a direct article URL like:
        https://www.geeksforgeeks.org/interview-experiences/amazon-sde-interview-experience/
        """
        # Extract company from URL since we store it per article now
        company = self._extract_company_from_article_url(url)
        result = self._scrape_article(url, company)
        if result:
            return [result]
        return []

    def _scrape_article(
        self, url: str, company_name: str
    ) -> dict[str, Any] | None:
        """
        Scrape a single GFG interview experience article page.
        """
        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
        except requests.RequestException as e:
            print(f"[gfg] Failed to fetch article {url}: {e}")
            return None

        soup = BeautifulSoup(response.text, "lxml")

        # Title
        title_tag = (
            soup.select_one("h1.article-title")
            or soup.select_one("div.article-title h1")
            or soup.select_one("h1")
        )
        title = title_tag.get_text(strip=True) if title_tag else "Unknown"

        # Content — try multiple selectors
        content_tag = (
            soup.select_one("div.article--viewer_content")
            or soup.select_one("div.entry-content")
            or soup.select_one("article")
            or soup.select_one("div.text")
        )

        if not content_tag:
            print(f"[gfg] Could not find content in {url}")
            return None

        raw_text = content_tag.get_text(separator="\n", strip=True)

        if len(raw_text) < 100:
            print(f"[gfg] Content too short in {url}, skipping")
            return None

        return {
            "url": url,
            "source": "gfg",
            "company": company_name,
            "title": title,
            "raw_text": raw_text,
        }

    def _extract_company_from_url(self, url: str) -> str:
        """
        Extract company name from tag URL.
        https://www.geeksforgeeks.org/tag/goldman-sachs/ → Goldman Sachs
        """
        try:
            parts = url.rstrip("/").split("/")
            tag_index = parts.index("tag")
            slug = parts[tag_index + 1]
            return slug.replace("-", " ").title()
        except (ValueError, IndexError):
            return "Unknown"

    def _extract_company_from_article_url(self, url: str) -> str:
        """
        Best-effort company extraction from article URL slug.
        https://...interview-experiences/amazon-sde-interview-experience/ → Amazon
        Falls back to Unknown if can't determine.
        """
        try:
            slug = url.rstrip("/").split("/")[-1]
            # Common company names to detect in slug
            companies = [
                "amazon", "google", "microsoft", "flipkart", "adobe",
                "walmart", "paytm", "uber", "atlassian", "salesforce",
                "goldman-sachs", "morgan-stanley", "cisco", "infosys",
                "tcs", "wipro", "zomato", "swiggy", "phonepe", "razorpay",
                "oracle", "samsung", "nvidia", "qualcomm", "intuit",
                "de-shaw", "makemytrip", "snapdeal", "media-net", "1mg",
                "247", "abco", "accolite", "accenture", "byju", "meesho",
                "maq", "directi", "publicis", "sapient", "thoughtworks",
            ]
            for company in companies:
                if company in slug:
                    return company.replace("-", " ").title()
            # Fallback: first word of slug
            return slug.split("-")[0].title()
        except Exception:
            return "Unknown"

    def _make_absolute(self, href: str) -> str:
        if href.startswith("http"):
            return href
        return self.base_url + href