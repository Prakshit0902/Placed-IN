import json
import os
import uuid
from datetime import datetime
from pathlib import Path
from typing import Any

from config import config


class StagingStorage:
    def __init__(self):
        self.staging_dir = Path(config.STAGING_DIR)
        self.staging_dir.mkdir(parents=True, exist_ok=True)

    def save_raw(self, source: str, data: list[dict[str, Any]]) -> str:
        """
        Save raw scraped data to staging directory.
        Returns the file path where data was saved.
        """
        batch_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{source}_{timestamp}_{batch_id}.json"
        filepath = self.staging_dir / filename

        payload = {
            "batch_id": batch_id,
            "source": source,
            "scraped_at": datetime.now().isoformat(),
            "count": len(data),
            "data": data,
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(payload, f, ensure_ascii=False, indent=2)

        print(f"[Staging] Saved {len(data)} records from '{source}' → {filename}")
        return str(filepath)

    def load_raw(self, filepath: str) -> dict[str, Any]:
        """
        Load a staged file back into memory.
        """
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)

    def get_all_pending(self) -> list[str]:
        """
        Return all staged files that haven't been cleaned yet.
        Pending = no corresponding .done marker file exists.
        """
        pending = []
        for filepath in sorted(self.staging_dir.glob("*.json")):
            marker = filepath.with_suffix(".done")
            if not marker.exists():
                pending.append(str(filepath))
        return pending

    def mark_done(self, filepath: str) -> None:
        """
        Mark a staged file as cleaned and processed.
        Creates a .done marker file next to the original.
        """
        marker = Path(filepath).with_suffix(".done")
        marker.touch()
        print(f"[Staging] Marked as done → {marker.name}")

    def cleanup_old(self, older_than_days: int = 7) -> None:
        """
        Delete staging files and their markers older than N days.
        Keeps your staging directory from growing forever.
        """
        cutoff = datetime.now().timestamp() - (older_than_days * 86400)
        deleted = 0
        for filepath in self.staging_dir.glob("*"):
            if filepath.stat().st_mtime < cutoff:
                filepath.unlink()
                deleted += 1
        print(f"[Staging] Cleaned up {deleted} old files")