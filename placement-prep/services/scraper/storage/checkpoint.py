import json
from datetime import datetime
from pathlib import Path

from config import config


class CheckpointStorage:
    def __init__(self, source: str):
        """
        Each scraper source gets its own checkpoint file.
        e.g. gfg.json, leetcode.json, ambitionbox.json
        """
        self.checkpoint_dir = Path(config.CHECKPOINT_DIR)
        self.checkpoint_dir.mkdir(parents=True, exist_ok=True)
        self.filepath = self.checkpoint_dir / f"{source}.json"
        self.source = source
        self._data = self._load()

    def _load(self) -> dict:
        """
        Load existing checkpoint file or return empty state.
        """
        if self.filepath.exists():
            with open(self.filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        return {
            "source": self.source,
            "scraped_urls": [],
            "last_run": None,
            "total_scraped": 0,
        }

    def _save(self) -> None:
        with open(self.filepath, "w", encoding="utf-8") as f:
            json.dump(self._data, f, ensure_ascii=False, indent=2)

    def is_scraped(self, url: str) -> bool:
        """
        Check if a URL has already been scraped before.
        """
        return url in self._data["scraped_urls"]

    def mark_scraped(self, url: str) -> None:
        """
        Mark a URL as scraped so we never process it twice.
        Persists immediately to disk.
        """
        if url not in self._data["scraped_urls"]:
            self._data["scraped_urls"].append(url)
            self._data["total_scraped"] += 1
            self._save()

    def mark_batch_scraped(self, urls: list[str]) -> None:
        """
        Mark multiple URLs at once. More efficient than
        calling mark_scraped in a loop for large batches.
        """
        new_urls = [u for u in urls if u not in self._data["scraped_urls"]]
        self._data["scraped_urls"].extend(new_urls)
        self._data["total_scraped"] += len(new_urls)
        self._save()
        print(f"[Checkpoint] Marked {len(new_urls)} new URLs for '{self.source}'")

    def update_last_run(self) -> None:
        """
        Call this at the end of every scraper run.
        """
        self._data["last_run"] = datetime.now().isoformat()
        self._save()

    def get_stats(self) -> dict:
        return {
            "source": self.source,
            "total_scraped": self._data["total_scraped"],
            "last_run": self._data["last_run"],
        }

    def reset(self) -> None:
        """
        Nuclear option — clears all checkpoints for this source.
        Only use if you want to re-scrape everything from scratch.
        """
        self._data = {
            "source": self.source,
            "scraped_urls": [],
            "last_run": None,
            "total_scraped": 0,
        }
        self._save()
        print(f"[Checkpoint] Reset all checkpoints for '{self.source}'")