from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    google_api_key: str = ''
    gemini_model: str = 'gemini-1.5-flash'
    google_embedding_model: str = 'text-embedding-004'

    supabase_url: str = ''
    supabase_service_role_key: str = ''
    database_url: str = ''

    upload_dir: str = './storage/uploads'
    cors_origins: str = 'http://localhost:5173'

    @property
    def cors_origins_list(self) -> list[str]:
        return [x.strip() for x in self.cors_origins.split(',') if x.strip()]


settings = Settings()
settings.cors_origins = settings.cors_origins_list
