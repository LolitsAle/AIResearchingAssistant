from pathlib import Path

from app.core.config import settings
from app.db.database import Base, engine


def init_db() -> None:
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
