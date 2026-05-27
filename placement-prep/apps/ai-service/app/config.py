from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str | None = None
    QDRANT_COLLECTION_NAME: str = "leetcode_problems"

    GEMINI_API_KEY: str
    GROQ_API_KEY: str | None = None

    SUPABASE_URL: str | None = None
    SUPABASE_SERVICE_KEY: str | None = None

    # Internal key for service-to-service calls (Node API → AI service)
    INTERNAL_SERVICE_KEY: str | None = None

    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001", "http://localhost:4000"]

    class Config:
        env_file = ".env"


settings = Settings()
