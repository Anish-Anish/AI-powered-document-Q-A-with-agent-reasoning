from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    GROQ_API_KEY: str = ""
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "rag_system"
    CHROMA_PERSIST_DIR: str = "./chroma_data"
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    LLM_MODEL: str = "llama-3.1-8b-instant"
    CHUNK_SIZE: int = 500
    CHUNK_OVERLAP: int = 50

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# --- Runtime Settings (mutable, persisted in MongoDB) ---

# Available Groq models the user can switch between
AVAILABLE_MODELS = [
    {"id": "llama-3.1-8b-instant", "name": "Llama 3.1 8B (Fast)", "context": 131072},
    {"id": "llama-3.3-70b-versatile", "name": "Llama 3.3 70B (Powerful)", "context": 131072},
    {"id": "llama-3.1-70b-versatile", "name": "Llama 3.1 70B", "context": 131072},
    {"id": "mixtral-8x7b-32768", "name": "Mixtral 8x7B", "context": 32768},
    {"id": "gemma2-9b-it", "name": "Gemma 2 9B", "context": 8192},
]


class RuntimeSettings:
    """Mutable settings that can be changed at runtime via API.
    These override the static .env settings when present."""

    def __init__(self):
        static = get_settings()
        self.llm_model: str = static.LLM_MODEL
        self.chunk_size: int = static.CHUNK_SIZE
        self.chunk_overlap: int = static.CHUNK_OVERLAP
        self.temperature: float = 0.1

    def update(self, **kwargs):
        for key, value in kwargs.items():
            if hasattr(self, key) and value is not None:
                setattr(self, key, value)

    def to_dict(self) -> dict:
        return {
            "llm_model": self.llm_model,
            "chunk_size": self.chunk_size,
            "chunk_overlap": self.chunk_overlap,
            "temperature": self.temperature,
        }


# Singleton instance
_runtime_settings: RuntimeSettings | None = None


def get_runtime_settings() -> RuntimeSettings:
    global _runtime_settings
    if _runtime_settings is None:
        _runtime_settings = RuntimeSettings()
    return _runtime_settings
