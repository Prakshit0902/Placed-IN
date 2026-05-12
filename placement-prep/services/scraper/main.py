import logging
import sys
from datetime import datetime

from pipeline.orchestrator import ScrapingOrchestrator
from pipeline.scheduler import setup_scheduler
from scrapers.gfg import GFGScraper

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s - %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger(__name__)


def run_scraper_once() -> None:
    """
    Run the GFG scraper once immediately without scheduling.
    Useful for testing and manually triggering a scrape.
    """
    logger.info("Running GFG scraper once...")
    scraper = GFGScraper()
    filepath = scraper.run()
    if filepath:
        logger.info(f"Scraper finished. Raw data saved to: {filepath}")
    else:
        logger.info("Scraper finished. No new data found.")


def run_pipeline_once() -> None:
    """
    Run the cleaning and embedding pipeline once immediately.
    Useful for testing after a manual scrape.
    """
    logger.info("Running orchestrator pipeline once...")
    orchestrator = ScrapingOrchestrator()
    orchestrator.run_pipeline()


def run_full_once() -> None:
    """
    Run scraper then pipeline sequentially, once.
    The quickest way to test the entire pipeline end to end.
    """
    logger.info("=== Running full pipeline once ===")
    run_scraper_once()
    run_pipeline_once()
    logger.info("=== Full pipeline run complete ===")

def run_generate_once() -> None:
    """
    Generate weekly preparation templates based on Qdrant data and store them in Supabase.
    """
    from qdrant_client import QdrantClient
    from supabase import create_client, Client
    from config import config
    from pipeline.template_generator import TemplateGenerator

    logger.info("Initializing Generator...")
    qdrant = QdrantClient(url=config.QDRANT_URL)
    supabase: Client = create_client(config.SUPABASE_URL, config.SUPABASE_SERVICE_ROLE_KEY)
    
    generator = TemplateGenerator(qdrant=qdrant, db_conn=supabase)
    logger.info("Running generation...")
    generator.generate_all()
    logger.info("Template generation complete.")



def run_scheduled() -> None:
    """
    Start the scheduler for continuous cron-based operation.
    This is the production mode.
    """
    logger.info("Starting scheduled mode...")
    scheduler = setup_scheduler()
    try:
        scheduler.start()
    except KeyboardInterrupt:
        logger.info("Scheduler stopped by user.")
        scheduler.shutdown()


def print_usage() -> None:
    print(
        """
Usage: python main.py [command]

Commands:
  scrape     Run the GFG scraper once and save to staging
  pipeline   Run the cleaning + embedding pipeline once on staged files
  full       Run scraper then pipeline once (good for first test)
  generate   Generate Supabase prep templates from Qdrant data (run AFTER 'full')
  schedule   Start the scheduler for continuous cron-based operation

Examples:
  python main.py full        # test entire pipeline end to end
  python main.py generate    # build weekly templates into Supabase
  python main.py scrape      # only scrape, inspect staging/ folder after
  python main.py pipeline    # only clean + embed what is already in staging/
  python main.py schedule    # production mode
        """.strip()
    )


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print_usage()
        sys.exit(1)

    command = sys.argv[1].lower()

    commands = {
        "scrape": run_scraper_once,
        "pipeline": run_pipeline_once,
        "full": run_full_once,
        "generate": run_generate_once,
        "schedule": run_scheduled,
    }

    if command not in commands:
        logger.error(f"Unknown command: '{command}'")
        print_usage()
        sys.exit(1)

    logger.info(f"Command: {command}")
    commands[command]()