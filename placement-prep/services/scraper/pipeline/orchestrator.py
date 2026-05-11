from scrapers.gfg import GFGScraper
from cleaners.llm_cleaner import LLMCleaner
from pipeline.embedder import Embedder
from storage.staging import StagingStorage


class ScrapingOrchestrator:
    """
    Ties the entire pipeline together:
    1. Run scrapers to gather raw data -> Staging
    2. Read pending raw data from Staging
    3. Clean data via LLM
    4. Embed and store in Qdrant
    5. Mark Staging files as done
    """

    def __init__(self):
        # Initialize scrapers (Add more here later: LeetCode, AmbitionBox)
        self.scrapers = [
            GFGScraper(),
        ]
        
        self.staging = StagingStorage()
        self.cleaner = LLMCleaner()
        self.embedder = Embedder()

    def run_scrapers(self) -> None:
        """
        Run all configured scrapers to collect new data.
        """
        print("[Orchestrator] Starting scraper phase")
        for scraper in self.scrapers:
            try:
                scraper.run()
            except Exception as e:
                print(f"[Orchestrator] Scraper '{scraper.source}' failed: {e}")
        print("[Orchestrator] Scraper phase complete")

    def process_pending(self) -> None:
        """
        Process all raw data waiting in the staging area.
        """
        print("[Orchestrator] Starting processing phase")
        pending_files = self.staging.get_all_pending()

        if not pending_files:
            print("[Orchestrator] No pending files to process")
            return

        print(f"[Orchestrator] Found {len(pending_files)} pending files")

        for filepath in pending_files:
            try:
                self._process_single_file(filepath)
            except Exception as e:
                print(f"[Orchestrator] Failed to process {filepath}: {e}")

        # Clean up old data to save disk space
        self.staging.cleanup_old(older_than_days=7)
        print("[Orchestrator] Processing phase complete")

    def _process_single_file(self, filepath: str) -> None:
        """
        Clean -> Embed -> Store -> Mark Done for a single staging file.
        """
        print(f"\n[Orchestrator] Processing file: {filepath}")
        
        # 1. Load raw data
        payload = self.staging.load_raw(filepath)
        raw_records = payload.get("data", [])
        
        if not raw_records:
            print(f"[Orchestrator] File is empty, marking done: {filepath}")
            self.staging.mark_done(filepath)
            return

        # 2. Clean with LLM (skip if already formatted properly)
        if raw_records and "question_text" in raw_records[0]:
            print(f"[Orchestrator] Records already in correct format, skipping LLMCleaner.")
            cleaned_records = raw_records
        else:
            cleaned_records = self.cleaner.clean_batch(raw_records)
        
        if not cleaned_records:
            print(f"[Orchestrator] No records survived cleaning in {filepath}")
            self.staging.mark_done(filepath)
            return

        # 3. Embed and store
        stored_count = self.embedder.embed_and_store(cleaned_records)
        
        # 4. Mark done
        if stored_count > 0:
            self.staging.mark_done(filepath)
            print(f"[Orchestrator] Successfully completed pipeline for {filepath}")
        else:
            print(f"[Orchestrator] Warning: No records stored for {filepath}")

    def run_all(self) -> None:
        """
        Trigger the full end-to-end pipeline.
        This is what the cron job will call.
        """
        print("\n" + "="*50)
        print("[Orchestrator] STARTING FULL PIPELINE RUN")
        print("="*50)
        
        self.run_scrapers()
        self.process_pending()
        
        print("="*50)
        print("[Orchestrator] PIPELINE RUN COMPLETE")
        print("="*50 + "\n")

    def run_pipeline(self) -> None:
        """Compatibility alias for older call sites."""
        return self.run_all()