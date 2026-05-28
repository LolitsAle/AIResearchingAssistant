from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

from app.core.config import settings


PLACEHOLDER_TOKENS = ('<region>', '<project-ref>', '<password>', 'YOUR-PASSWORD')


def normalize_database_url(raw_url: str) -> str:
    """Normalize DATABASE_URL for SQLAlchemy + psycopg2 compatibility."""
    if any(token in raw_url for token in PLACEHOLDER_TOKENS):
        raise RuntimeError(
            'Invalid DATABASE_URL: it contains placeholder values. '
            'Copy the real Supabase connection string from Supabase Dashboard.'
        )

    parsed = urlsplit(raw_url)
    normalized_query_pairs = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if k.lower() != 'pgbouncer']
    normalized_query = urlencode(normalized_query_pairs)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, normalized_query, parsed.fragment))

if not settings.database_url:
    raise RuntimeError('DATABASE_URL is required. Set Supabase Postgres connection string.')

normalized_database_url = normalize_database_url(settings.database_url)
engine = create_engine(normalized_database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
