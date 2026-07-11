from urllib.parse import quote_plus, urlparse, urlunparse
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    DATABASE_URL: str

    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    SUPABASE_URL: str
    SUPABASE_SERVICE_ROLE_KEY: str
    SUPABASE_STORAGE_BUCKET: str = "notes-pdfs"

    QDRANT_URL: str = "http://qdrant:6333"
    QDRANT_API_KEY: str | None = None

    GROQ_API_KEY: str
    GROQ_MODEL: str = "llama-3.3-70b-versatile"

    EMBEDDING_MODEL: str = "sentence-transformers/paraphrase-multilingual-mpnet-base-v2"

    FRONTEND_ORIGIN: str = "http://localhost:5173"

    @property
    def safe_database_url(self) -> str:
        """URL-encodes the password portion in case it contains special chars like '@'."""
        parsed = urlparse(self.DATABASE_URL)
        if parsed.password is None:
            return self.DATABASE_URL
        netloc = f"{parsed.username}:{quote_plus(parsed.password)}@{parsed.hostname}"
        if parsed.port:
            netloc += f":{parsed.port}"
        return urlunparse(parsed._replace(netloc=netloc))


settings = Settings()
