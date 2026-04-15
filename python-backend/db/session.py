import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

from .models import Base


def _default_db_path() -> str:
    """Use Tauri app data directory (or fallback to CWD during dev)."""
    env_path = os.environ.get("KINGKAID_DATA_DIR")
    if env_path:
        root = Path(env_path)
    else:
        # Dev fallback: place alongside python-backend/
        root = Path(__file__).resolve().parent.parent / ".data"
    root.mkdir(parents=True, exist_ok=True)
    return str(root / "app.db")


DB_PATH = _default_db_path()
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def get_db() -> Session:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
