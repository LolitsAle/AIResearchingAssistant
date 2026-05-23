from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    ollama_base_url: str = 'http://localhost:11434'
    ollama_chat_model: str = 'llama3.1'
    ollama_embed_model: str = 'nomic-embed-text'
    database_url: str = 'sqlite:///./research_assistant.db'
    upload_dir: str = './app/storage/uploads'
    cors_origins: str = 'http://localhost:5173'

    @property
    def cors_origins_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(',') if x.strip()]


settings = Settings()
settings.cors_origins = settings.cors_origins_list
