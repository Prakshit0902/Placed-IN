import logging
import os
from pathlib import Path

# Create logs directory if it doesn't exist
log_dir = Path("logs")
log_dir.mkdir(exist_ok=True)

# Create a custom logger
logger = logging.getLogger("adaptive_engine")
logger.setLevel(logging.INFO)

# Create handlers
f_handler = logging.FileHandler("logs/adaptive_engine.log")
c_handler = logging.StreamHandler()

f_handler.setLevel(logging.INFO)
c_handler.setLevel(logging.INFO)

# Create formatters and add it to handlers
log_format = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(funcName)s] - %(message)s')
f_handler.setFormatter(log_format)
c_handler.setFormatter(log_format)

# Add handlers to the logger
if not logger.handlers:
    logger.addHandler(f_handler)
    logger.addHandler(c_handler)
