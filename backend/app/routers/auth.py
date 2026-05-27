from fastapi import APIRouter, Depends
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.db.database import get_db
from app.db.models import User
from app.services.auth_service import create_access_token, get_current_user, hash_password, verify_google_credential, verify_password

router = APIRouter()


class RegisterRequest(BaseModel):
    name: str
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class GoogleLoginRequest(BaseModel):
    credential: str


def _serialize_user(user: User) -> dict:
    return {'id': user.id, 'name': user.name, 'email': user.email, 'avatar_url': user.avatar_url}


@router.post('/auth/register')
def register(payload: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == payload.email.lower()).first():
        raise AppError('Email này đã được đăng ký.', 409)
    user = User(name=payload.name.strip() or 'User', email=payload.email.lower(), hashed_password=hash_password(payload.password), auth_provider='password')
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id)
    return {'user': _serialize_user(user), 'access_token': token}


@router.post('/auth/login')
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if not user or not user.hashed_password or not verify_password(payload.password, user.hashed_password):
        raise AppError('Email hoặc mật khẩu không đúng.', 401)
    return {'user': _serialize_user(user), 'access_token': create_access_token(user.id)}




@router.post('/auth/google')
def login_google(payload: GoogleLoginRequest, db: Session = Depends(get_db)):
    info = verify_google_credential(payload.credential)
    email = (info.get('email') or '').lower()
    if not email:
        raise AppError('Không thể đăng nhập bằng Google.', 401)
    user = db.query(User).filter(User.email == email).first()
    if not user:
        user = User(name=info.get('name') or email.split('@')[0], email=email, avatar_url=info.get('picture'), auth_provider='google', hashed_password=None)
        db.add(user); db.commit(); db.refresh(user)
    return {'user': _serialize_user(user), 'access_token': create_access_token(user.id)}


@router.get('/auth/me')
def me(current_user: User = Depends(get_current_user)):
    return {'user': _serialize_user(current_user)}


@router.post('/auth/logout')
def logout():
    return {'message': 'Logged out'}
