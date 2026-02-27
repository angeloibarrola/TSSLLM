from pydantic_settings import BaseSettings
from pathlib import Path

class Settings(BaseSettings):
    github_token: str = ""
    llm_base_url: str = "https://models.inference.ai.azure.com"
    chat_model: str = "gpt-4o"
    embedding_model: str = "text-embedding-3-small"
    database_url: str = "sqlite:///./tssllm.db"  # overridden by DATABASE_URL env var in Azure
    chroma_persist_dir: str = "./chroma_data"
    upload_dir: str = "./uploads"
    azure_client_id: str = "d3590ed6-52b3-4102-aeff-aad2292ab01c"  # Microsoft Office (first-party)
    azure_tenant_id: str = "72f988bf-86f1-41af-91ab-2d7cd011db47"  # Microsoft corp tenant

    class Config:
        env_file = ".env"

settings = Settings()

# Ensure directories exist
Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
Path(settings.chroma_persist_dir).mkdir(parents=True, exist_ok=True)
