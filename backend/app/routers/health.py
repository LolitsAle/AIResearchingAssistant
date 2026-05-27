from fastapi import APIRouter
from sqlalchemy import text

from app.db.database import engine

router = APIRouter()


@router.get('/health')
def health():
    db_status = 'unavailable'
    try:
        with engine.connect() as conn:
            conn.execute(text('SELECT 1'))
        db_status = 'available'
    except Exception:
        db_status = 'unavailable'
    return {'status': 'ok', 'llm': 'gemini', 'database': db_status}
