import time
from typing import Any

import requests
from bs4 import BeautifulSoup

from scrapers.base import BaseScraper
from config import config


class GFGScraper(BaseScraper):
    def __init__(self):
        super().__init__(source="gfg")
        self.api_base = "https://practiceapi.geeksforgeeks.org/api/vr/problems/"
        self.companies = [
            "Amazon", "Microsoft", "Google", "Flipkart", "Adobe", 
            "Walmart", "Atlassian", "Uber", "Salesforce", "TCS"
        ]

    def get_urls(self) -> list[str]:
        urls = []
        limit = config.SCRAPE_LIMIT
        
        for company in self.companies:
            pages_to_fetch = 5 if limit == -1 else max(1, limit // len(self.companies))
            
            for page in range(1, pages_to_fetch + 1):
                url = f"{self.api_base}?pageMode=explore&page={page}&company={company}&sortBy=submissions"
                urls.append(url)
                
        print(f"[gfg] Generated {len(urls)} API pagination URLs for {len(self.companies)} companies.")
        return urls

    def scrape_page(self, url: str) -> list[dict[str, Any]]:
        try:
            response = self.session.get(url, timeout=15)
            response.raise_for_status()
            data = response.json()
        except requests.RequestException as e:
            print(f"[gfg] Failed to fetch API {url}: {e}")
            return []

        results = data.get("results", [])
        if not results:
            return []

        records = []
        requested_company = "Unknown"
        if "company=" in url:
            try:
                requested_company = url.split("company=")[1].split("&")[0]
            except Exception:
                pass

        for item in results:
            tags = item.get("tags", {})
            company_tags = tags.get("company_tags", [])
            topic_tags = tags.get("topic_tags", [])
            
            company_val = company_tags[0] if company_tags else requested_company
            
            record = {
                "id": f"q_gfg_{item.get('slug', item.get('id'))}",
                "source": "gfg",
                "company": company_val,
                "role": "SDE",
                "round": "dsa",
                "question_text": item.get("problem_name", "Unknown"),
                "question_url": item.get("problem_url", ""),
                "difficulty": item.get("difficulty", "medium").lower(),
                "topics": topic_tags,
                "acceptance_rate": item.get("accuracy", ""),
                "solution_count": item.get("all_submissions", 0),
                "frequency_indicator": "unknown" 
            }
            records.append(record)
            
        print(f"[gfg] Extracted {len(records)} questions from API format.")
        return records