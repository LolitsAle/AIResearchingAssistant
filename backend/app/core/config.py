from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')
    app_name: str = 'AI Researching Assistant API'
    api_prefix: str = '/api'
    ollama_base_url: str = 'http://localhost:11434'
    ollama_chat_model: str = 'llama3.1'
    ollama_embed_model: str = 'nomic-embed-text'
    database_url: str = 'sqlite:///./research_assistant.db'
    upload_dir: str = './app/storage/uploads'
    cors_origins: str = 'http://localhost:5173'


settings = Settings()
