import time
from typing import Any

import requests
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper


class GFGScraper(BaseScraper):
    def __init__(self):
        super().__init__(source="gfg")
        self.base_url = "https://www.geeksforgeeks.org"

        # These are the company interview experience pages on GFG
        # Each entry is (company_name, gfg_slug)
        self.companies = [
            ("Amazon", "amazon"),
            ("Google", "google"),
            ("Microsoft", "microsoft"),
            ("Flipkart", "flipkart"),
            ("Adobe", "adobe"),
            ("Walmart", "walmart-labs"),
            ("Paytm", "paytm"),
            ("Uber", "uber"),
            ("Atlassian", "atlassian"),
            ("Salesforce", "salesforce"),
            ("Goldman Sachs", "goldman-sachs"),
            ("Morgan Stanley", "morgan-stanley"),
            ("Cisco", "cisco"),
            ("Infosys", "infosys"),
            ("TCS", "tcs"),
            ("Wipro", "wipro"),
            ("Zomato", "zomato"),
            ("Swiggy", "swiggy"),
            ("PhonePe", "phonepe"),
            ("Razorpay", "razorpay"),
        ]

    def get_urls(self) -> list[str]:
        """
        Build paginated URLs for each company's interview experience page.
        GFG paginates with ?page=1, ?page=2 etc.
        We collect up to 5 pages per company for now.
        """
        urls = []
        for company_name, slug in self.companies:
            for page in range(1, 6):
                url = (
                    f"{self.base_url}/company/{slug}"
                    f"/interview-experiences/?page={page}"
                )
                urls.append(url)
        return urls

    def scrape_page(self, url: str) -> list[dict[str, Any]]:
        """
        Scrape a single GFG company interview experience listing page.
        Returns a list of raw records, one per interview experience article.
        """
        records = []

        try:
            response = self.session.get(url, timeout=15)
            if response.status_code == 404:
                print(f"[gfg] 404 for {url}, skipping")
                return []
            response.raise_for_status()
        except requests.RequestException as e:
            raise Exception(f"Request failed: {e}")

        soup = BeautifulSoup(response.text, "lxml")

        # Extract company name and page number from URL
        parts = url.split("/")
        company_slug = parts[4] if len(parts) > 4 else "unknown"
        company_name = self._slug_to_company_name(company_slug)

        # GFG lists article links in this container
        article_links = soup.select("a.articleCard")

        if not article_links:
            # Try alternate selector for different page layouts
            article_links = soup.select("div.articleCard a")

        if not article_links:
            print(f"[gfg] No article links found on {url}")
            return []

        for link in article_links:
            href = link.get("href", "")
            if not href:
                continue

            # Make absolute URL
            if href.startswith("/"):
                article_url = self.base_url + href
            else:
                article_url = href

            # Skip if already scraped
            if self.checkpoint.is_scraped(article_url):
                continue

            # Scrape the individual article
            article_data = self._scrape_article(article_url, company_name)
            if article_data:
                records.append(article_data)
                self.checkpoint.mark_scraped(article_url)
                time.sleep(1.0)  # extra delay for individual articles

        return records

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

        # Article title
        title_tag = soup.select_one("h1.article-title") or soup.select_one("h1")
        title = title_tag.get_text(strip=True) if title_tag else "Unknown"

        # Main article content
        content_tag = soup.select_one("div.article--viewer_content")
        if not content_tag:
            content_tag = soup.select_one("div.entry-content")
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

    def _slug_to_company_name(self, slug: str) -> str:
        """
        Convert GFG URL slug back to company name.
        """
        slug_map = {
            "amazon": "Amazon",
            "google": "Google",
            "microsoft": "Microsoft",
            "flipkart": "Flipkart",
            "adobe": "Adobe",
            "walmart-labs": "Walmart",
            "paytm": "Paytm",
            "uber": "Uber",
            "atlassian": "Atlassian",
            "salesforce": "Salesforce",
            "goldman-sachs": "Goldman Sachs",
            "morgan-stanley": "Morgan Stanley",
            "cisco": "Cisco",
            "infosys": "Infosys",
            "tcs": "TCS",
            "wipro": "Wipro",
            "zomato": "Zomato",
            "swiggy": "Swiggy",
            "phonepe": "PhonePe",
            "razorpay": "Razorpay",
        }
        return slug_map.get(slug, slug.replace("-", " ").title())