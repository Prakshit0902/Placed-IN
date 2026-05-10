import time
from abc import ABC, abstractmethod
from typing import Any

import requests

from config import config
from storage.checkpoint import CheckpointStorage
from storage.staging import StagingStorage


class BaseScraper(ABC):
    def __init__(self, source: str):
        self.source = source
        self.checkpoint = CheckpointStorage(source)
        self.staging = StagingStorage()
        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
                "Accept-Language": "en-US,en;q=0.9",
            }
        )

    @abstractmethod
    def get_urls(self) -> list[str]:
        """
        Return the list of URLs this scraper should process.
        Each subclass defines its own URL discovery logic.
        """
        pass

    @abstractmethod
    def scrape_page(self, url: str) -> list[dict[str, Any]]:
        """
        Scrape a single page and return a list of raw records.
        Each record is a dict with at minimum:
        {
            "url": str,
            "company": str,
            "raw_text": str,
        }
        """
        pass

    def run(self) -> str | None:
        """
        Main entry point. Orchestrates the full scrape for this source.
        - Gets URLs
        - Skips already scraped ones via checkpoint
        - Scrapes each page with delay and retries
        - Saves results to staging
        - Returns staging filepath or None if nothing new
        """
        print(f"[{self.source}] Starting scrape run")
        urls = self.get_urls()
        print(f"[{self.source}] Found {len(urls)} total URLs")

        new_urls = [u for u in urls if not self.checkpoint.is_scraped(u)]
        print(f"[{self.source}] {len(new_urls)} new URLs to scrape")

        if not new_urls:
            print(f"[{self.source}] Nothing new to scrape, exiting")
            self.checkpoint.update_last_run()
            return None

        # Apply SCRAPE_LIMIT from config (-1 means no limit)
        limit = config.SCRAPE_LIMIT
        if limit != -1:
            to_process = new_urls[:limit]
            print(f"[{self.source}] Limiting to {len(to_process)} URLs (SCRAPE_LIMIT={limit})")
        else:
            to_process = new_urls

        all_records = []

        for i, url in enumerate(to_process):
            print(f"[{self.source}] Scraping {i + 1}/{len(to_process)}: {url}")
            records = self._scrape_with_retry(url)

            if records:
                all_records.extend(records)
                self.checkpoint.mark_scraped(url)
            else:
                print(f"[{self.source}] No records returned for {url}, skipping")

            # Respectful delay between requests
            if i < len(to_process) - 1:
                time.sleep(config.REQUEST_DELAY_SECONDS)

        self.checkpoint.update_last_run()

        if not all_records:
            print(f"[{self.source}] Scrape complete but no records collected")
            return None

        filepath = self.staging.save_raw(self.source, all_records)
        print(f"[{self.source}] Scrape complete. {len(all_records)} records saved")
        return filepath

    def _scrape_with_retry(self, url: str) -> list[dict[str, Any]]:
        """
        Attempt to scrape a URL with retries on failure.
        """
        for attempt in range(1, config.MAX_RETRIES + 1):
            try:
                return self.scrape_page(url)
            except Exception as e:
                print(
                    f"[{self.source}] Attempt {attempt}/{config.MAX_RETRIES} "
                    f"failed for {url}: {e}"
                )
                if attempt < config.MAX_RETRIES:
                    time.sleep(config.REQUEST_DELAY_SECONDS * attempt)
        print(f"[{self.source}] All retries exhausted for {url}")
        return []