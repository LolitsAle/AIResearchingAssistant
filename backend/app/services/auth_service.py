from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.errors import AppError
from app.db.database import get_db
from app.db.models import User

pwd_context = CryptContext(schemes=['bcrypt'], deprecated='auto')
security = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed_password: str) -> bool:
    return pwd_context.verify(password, hashed_password)


def create_access_token(user_id: str) -> str:
    if not settings.jwt_secret_key:
        raise AppError('Missing JWT_SECRET_KEY.', 500)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {'sub': user_id, 'exp': expires_at}
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)



def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security), db: Session = Depends(get_db)) -> User:
    if not credentials or credentials.scheme.lower() != 'bearer':
        raise AppError('Unauthorized', 401)
    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id = payload.get('sub')
    except Exception as exc:
        raise AppError('Unauthorized', 401) from exc
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise AppError('Unauthorized', 401)
    return user
