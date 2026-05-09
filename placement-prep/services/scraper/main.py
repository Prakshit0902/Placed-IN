from pipeline.orchestrator import ScrapingOrchestrator
from pipeline.scheduler import setup_scheduler
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    scheduler = setup_scheduler()
    scheduler.start()
    logger.info("Scraper scheduler started")
    try:
        import time

        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        scheduler.shutdown()from pipeline.orchestrator import ScrapingOrchestrator
from pipeline.scheduler import setup_scheduler
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    scheduler = setup_scheduler()
    scheduler.start()
    logger.info("Scraper scheduler started")
    try:
        import time
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        scheduler.shutdown()
