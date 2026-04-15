import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Cloud backend (license + Claude proxy)
    cloud_base_url: str = "http://127.0.0.1:8090"

    # HeyGem Docker REST endpoints
    heygem_tts_url: str = "http://127.0.0.1:18180"
    heygem_video_url: str = "http://127.0.0.1:8383"

    # SenseVoice
    sensevoice_model: str = "iic/SenseVoiceSmall"
    sensevoice_device: str = "cuda:0"

    # App data root (defaults to ~/.local/share/KingKaid on Linux)
    data_dir: str = os.environ.get(
        "KINGKAID_DATA_DIR",
        str(Path(__file__).resolve().parent / ".data"),
    )


settings = Settings()

# Ensure data subdirectories exist
DATA_ROOT = Path(settings.data_dir)
UPLOADS_DIR = DATA_ROOT / "uploads"
OUTPUTS_DIR = DATA_ROOT / "outputs"
TMP_DIR = DATA_ROOT / "tmp"
LOGS_DIR = DATA_ROOT / "logs"

for _d in [DATA_ROOT, UPLOADS_DIR, OUTPUTS_DIR, TMP_DIR, LOGS_DIR]:
    _d.mkdir(parents=True, exist_ok=True)
