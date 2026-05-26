from pathlib import Path

from sqlalchemy import text

from app.core.config import settings
from app.db.database import Base, engine


def init_db() -> None:
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    with engine.begin() as conn:
        conn.execute(text('CREATE EXTENSION IF NOT EXISTS vector;'))
    Base.metadata.create_all(bind=engine)
