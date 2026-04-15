from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    anthropic_api_key: str = "sk-ant-placeholder"
    anthropic_model: str = "claude-sonnet-4-6"
    admin_token: str = "admin-dev-token"
    jwt_secret: str = "dev-secret-change-me-in-production"
    jwt_expire_days: int = 7
    database_url: str = "sqlite:///./licenses.db"


settings = Settings()
