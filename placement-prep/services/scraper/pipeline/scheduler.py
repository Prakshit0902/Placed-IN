import logging
from datetime import datetime

from apscheduler.schedulers.blocking import BlockingScheduler

from pipeline.orchestrator import ScrapingOrchestrator
from scrapers.gfg import GFGScraper

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def run_gfg_scraper_job():
    """Wrapper function for the GFG scraper task."""
    logger.info("--- Starting GFG scraper job ---")
    try:
        GFGScraper().run()
        logger.info("--- GFG scraper job finished successfully ---")
    except Exception as e:
        logger.error(f"Error in GFG scraper job: {e}", exc_info=True)


def run_orchestrator_job():
    """Wrapper function for the cleaning/embedding pipeline task."""
    logger.info("--- Starting orchestrator job ---")
    try:
        ScrapingOrchestrator().run_pipeline()
        logger.info("--- Orchestrator job finished successfully ---")
    except Exception as e:
        logger.error(f"Error in orchestrator job: {e}", exc_info=True)


def setup_scheduler() -> BlockingScheduler:
    """
    Configures and returns the APScheduler instance.
    """
    scheduler = BlockingScheduler(timezone="UTC")

    # Schedule the scraper. It dumps raw files into the staging directory.
    # Runs once per day at 1 AM UTC.
    scheduler.add_job(
        run_gfg_scraper_job,
        trigger="cron",
        hour=1,
        minute=0,
        id="gfg_scraper_job",
        replace_existing=True,
        # Run immediately on first startup for quick testing
        next_run_time=datetime.now(),
    )

    # Schedule the orchestrator. It processes files from the staging directory.
    # Runs every hour. This decouples it from the scraper's run time.
    scheduler.add_job(
        run_orchestrator_job,
        trigger="interval",
        hours=1,
        id="orchestrator_job",
        replace_existing=True,
        # Run 5 minutes after startup to let the first scrape finish
        next_run_time=datetime.now()
        + datetime.timedelta(minutes=5)
        if not scheduler.get_job("gfg_scraper_job")
        else None,
    )

    logger.info("Scheduler configured. Jobs scheduled:")
    scheduler.print_jobs()

    return scheduler