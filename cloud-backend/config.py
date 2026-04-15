from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # MiniMax (Anthropic SDK compatible)
    minimax_api_key: str = "your-minimax-api-key-here"
    minimax_base_url: str = "https://api.minimaxi.com/anthropic"
    minimax_model: str = "MiniMax-M2.7"

    admin_token: str = "admin-dev-token"
    jwt_secret: str = "dev-secret-change-me-in-production"
    jwt_expire_days: int = 7
    database_url: str = "sqlite:///./licenses.db"


settings = Settings()
