from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str | None = None
    OPENAI_API_KEY: str
    ANTHROPIC_API_KEY: str | None = None
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]

    class Config:
        env_file = ".env"


settings = Settings()from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str | None = None
    OPENAI_API_KEY: str
    ANTHROPIC_API_KEY: str | None = None
    ALLOWED_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
    
    class Config:
        env_file = ".env"

settings = Settings()
