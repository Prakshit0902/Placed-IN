from pathlib import Path
from pydantic_settings import BaseSettings
from typing import Optional

# This ensures .env is always found relative to config.py itself
# regardless of where you run the script from
ENV_PATH = Path(__file__).parent / ".env"


class ScraperConfig(BaseSettings):
    # Gemini (optional fallback)
    GEMINI_API_KEY: Optional[str] = None

    # Groq (primary LLM provider)
    GROQ_API_KEY: Optional[str] = None
    GROQ_MODEL: str = "meta-llama/llama-4-scout-17b-16e-instruct"

    # Qdrant
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: Optional[str] = None
    QDRANT_COLLECTION_NAME: str = "placement_questions"

    # Embedding model via Gemini
    EMBEDDING_MODEL: str = "models/embedding-001"
    EMBEDDING_DIMENSION: int = 768

    # Gemini cleaning model (use a currently supported model)
    CLEANING_MODEL: str = "gemini-2.5-flash"

    # Storage
    STAGING_DIR: str = "./staging"
    CHECKPOINT_DIR: str = "./checkpoints"

    # Supabase (PostgreSQL)
    SUPABASE_URL: str = ""
    SUPABASE_SERVICE_ROLE_KEY: str = ""

    # Scraper behavior
    REQUEST_DELAY_SECONDS: float = 2.0
    MAX_RETRIES: int = 3
    BATCH_SIZE: int = 50
    SCRAPE_LIMIT: int = 2
    # Local LLM removed; using Groq API as primary and Gemini as optional fallback

    class Config:
        env_file = str(ENV_PATH)


config = ScraperConfig()