from pydantic_settings import BaseSettings
from typing import Optional


class ScraperConfig(BaseSettings):
    # Gemini
    GEMINI_API_KEY: str

    # Qdrant
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION_NAME: str = "placement_questions"

    # Embedding model via Gemini
    EMBEDDING_MODEL: str = "models/text-embedding-004"
    EMBEDDING_DIMENSION: int = 768

    # Gemini cleaning model
    CLEANING_MODEL: str = "gemini-1.5-flash"

    # Storage
    STAGING_DIR: str = "./staging"
    CHECKPOINT_DIR: str = "./checkpoints"

    # Scraper behavior
    REQUEST_DELAY_SECONDS: float = 2.0
    MAX_RETRIES: int = 3
    BATCH_SIZE: int = 50

    class Config:
        env_file = ".env"


config = ScraperConfig()