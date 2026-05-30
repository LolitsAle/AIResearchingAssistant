# app/routers/auth.py
"""Authentication routes using Supabase Auth."""

from typing import Any, Dict
from fastapi import APIRouter, Depends, HTTPException, Request, status
from supabase import create_client, Client
from app.models.schemas import RegisterRequest, LoginRequest
from pydantic import BaseModel, EmailStr
from app.dependencies import get_current_user, DEV_ADMIN_TOKEN, _role_from_auth_user, _role_from_profile
from app.db.supabase_client import supabase
from app.config import settings
from app.services.google_auth_service import verify_google_credential

# PREFIX khớp với api_contract.md: /api/auth/*
router = APIRouter(prefix="/api/auth", tags=["auth"])




def _supabase_response_data(resp: Any):
    if isinstance(resp, dict):
        return resp.get("data"), resp.get("error")
    return getattr(resp, "data", None), getattr(resp, "error", None)

def _anon_client() -> Client:
    """Tạo client mới dùng anon key cho mỗi request auth.
    Tránh lỗi session bị lưu trong singleton supabase client.
    """
    return create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)




def _user_payload(user_id: str, email: str, role: str = "user", profile: Dict[str, Any] | None = None) -> Dict[str, Any]:
    profile = profile or {}
    display = profile.get("display_name") or profile.get("full_name") or (email.split("@")[0] if "@" in email else email)
    return {
        "id": user_id,
        "user_id": user_id,
        "name": display,
        "email": email,
        "avatar_url": profile.get("avatar_url"),
        "role": role,
    }


class GoogleAuthRequest(BaseModel):
    credential: str


class PasswordResetRequest(BaseModel):
    email: EmailStr


def _profile_for_user(user_id: str) -> Dict[str, Any]:
    try:
        resp = supabase.table("profiles").select("*").eq("id", user_id).limit(1).execute()
        rows, error = _supabase_response_data(resp)
        if not error and rows:
            return rows[0]
    except Exception:
        return {}
    return {}


def _ensure_profile(user_id: str, email: str, values: Dict[str, Any] | None = None) -> Dict[str, Any]:
    payload = {"id": user_id, "email": email, **(values or {})}
    try:
        resp = supabase.table("profiles").upsert(payload, on_conflict="id").execute()
        rows, error = _supabase_response_data(resp)
        if not error and rows:
            return rows[0]
    except Exception as exc:
        print(f"PROFILE UPSERT FAILED: {exc}")
    return _profile_for_user(user_id)


def _is_dev_admin_login(email: str, password: str) -> bool:
    return email.strip() == (settings.SYSTEM_LIBRARY_ADMIN_EMAIL or "admin") and password == (settings.SYSTEM_LIBRARY_ADMIN_PASSWORD or "admin")


def _auth_user_field(user_obj: Any, field: str) -> Any:
    if isinstance(user_obj, dict):
        return user_obj.get(field)
    return getattr(user_obj, field, None)


def _auth_users_from_response(resp: Any) -> list[Any]:
    if isinstance(resp, dict):
        return resp.get("users") or (resp.get("data") or {}).get("users") or []
    return getattr(resp, "users", None) or getattr(resp, "data", None) or []


def _confirm_password_user_email(email: str) -> bool:
    try:
        resp = supabase.auth.admin.list_users()
        for auth_user in _auth_users_from_response(resp):
            if str(_auth_user_field(auth_user, "email") or "").lower() != email.lower():
                continue
            user_id = _auth_user_field(auth_user, "id")
            if not user_id:
                return False
            supabase.auth.admin.update_user_by_id(str(user_id), {"email_confirm": True})
            return True
    except Exception as exc:
        print(f"AUTO EMAIL CONFIRM FAILED: {exc}")
    return False

@router.post("/register")
async def register(payload: RegisterRequest) -> Dict[str, Any]:
    try:
        resp = supabase.auth.admin.create_user({
            "email": payload.email,
            "password": payload.password,
            "email_confirm": True,
            "user_metadata": {"auth_provider": "password"},
        })
    except Exception as e:
        message = str(e)
        print(f"LỖI ĐĂNG KÝ: {e}")
        if "already" in message.lower() or "duplicate" in message.lower() or "registered" in message.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "EMAIL_TAKEN", "message": "Email đã được đăng ký"},
            ) from e
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": "Failed to register user"},
        ) from e

    error = getattr(resp, "error", None) or (resp.get("error") if isinstance(resp, dict) else None)
    user = getattr(resp, "user", None) or (resp.get("data", {}) or {}).get("user")

    if error:
        message = getattr(error, "message", str(error))
        if "already registered" in message.lower() or "duplicate" in message.lower():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={"code": "EMAIL_TAKEN", "message": "Email đã được đăng ký"},
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"code": "INTERNAL_ERROR", "message": message},
        )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": "Unexpected response from auth provider"},
        )

    user_id = getattr(user, "id", None) or (user.get("id") if isinstance(user, dict) else None)
    email = getattr(user, "email", None) or (user.get("email") if isinstance(user, dict) else None)
    _ensure_profile(str(user_id), email, {"password_login_enabled": True, "auth_provider": "password"})
    return {"success": True, "data": {"user_id": user_id, "email": email}}


@router.post("/login")
async def login(payload: LoginRequest) -> Dict[str, Any]:
    if _is_dev_admin_login(payload.email, payload.password):
        return {
            "success": True,
            "data": {
                "access_token": DEV_ADMIN_TOKEN,
                "token_type": "bearer",
                "user": _user_payload("dev-admin", settings.SYSTEM_LIBRARY_ADMIN_EMAIL or "admin", "admin"),
            },
        }

    client = _anon_client()
    try:
        resp = client.auth.sign_in_with_password({"email": payload.email, "password": payload.password})
    except Exception as e:
        print(f"LỖI ĐĂNG NHẬP: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": "Authentication service error"},
        )

    error = getattr(resp, "error", None) or (resp.get("error") if isinstance(resp, dict) else None)
    if error:
        message = getattr(error, "message", str(error))
        if "email not confirmed" in message.lower() and _confirm_password_user_email(payload.email):
            try:
                resp = client.auth.sign_in_with_password({"email": payload.email, "password": payload.password})
                error = getattr(resp, "error", None) or (resp.get("error") if isinstance(resp, dict) else None)
                message = getattr(error, "message", str(error)) if error else ""
            except Exception as e:
                print(f"LỖI ĐĂNG NHẬP SAU XÁC NHẬN EMAIL TỰ ĐỘNG: {e}")
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail={"code": "INTERNAL_ERROR", "message": "Authentication service error"},
                ) from e
        if error:
            if "email not confirmed" in message.lower():
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={"code": "EMAIL_NOT_CONFIRMED", "message": "Email chưa được xác nhận trên hệ thống xác thực. Tài khoản đăng ký mới bằng mật khẩu sẽ được xác nhận tự động; vui lòng đăng ký lại hoặc liên hệ quản trị viên nếu đây là tài khoản cũ."},
                )
            if any(w in message.lower() for w in ["invalid", "wrong", "credentials"]):
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={"code": "INVALID_CREDENTIALS", "message": "Sai email hoặc mật khẩu. Vui lòng thử lại!"},
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail={"code": "INTERNAL_ERROR", "message": message},
            )

    session = getattr(resp, "session", None)
    user = getattr(resp, "user", None)
    if not session or not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail={"code": "INTERNAL_ERROR", "message": "Failed to obtain access token"},
        )

    access_token = getattr(session, "access_token", None)
    user_id = getattr(user, "id", None)
    email = getattr(user, "email", None)
    role = _role_from_auth_user(user) or _role_from_profile(str(user_id)) or "user"

    profile = _ensure_profile(str(user_id), email, {"password_login_enabled": True})
    return {
        "success": True,
        "data": {
            "access_token": access_token,
            "token_type": "bearer",
            "user": _user_payload(str(user_id), email, role, profile),
        },
    }


@router.get("/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    profile = _profile_for_user(user["user_id"])
    return {"success": True, "data": {"user": _user_payload(user["user_id"], user["email"], user.get("role", "user"), profile)}}


@router.post("/logout")
async def logout(request: Request) -> Dict[str, Any]:
    authorization = request.headers.get("Authorization", "")
    if not authorization.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "UNAUTHORIZED", "message": "Missing authorization token"},
        )

    try:
        supabase.auth.sign_out()
    except Exception:
        pass  # sign_out idempotent — luôn trả success

    return {"success": True, "data": {"message": "Đăng xuất thành công"}}

@router.post("/google")
async def google_login(payload: GoogleAuthRequest) -> Dict[str, Any]:
    claims = verify_google_credential(payload.credential)
    email = claims["email"]

    client = _anon_client()
    try:
        resp = client.auth.sign_in_with_id_token({"provider": "google", "token": payload.credential})
    except Exception as exc:
        print(f"LỖI ĐĂNG NHẬP GOOGLE: {exc}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "GOOGLE_AUTH_FAILED", "message": "Không thể xác thực Google."},
        ) from exc

    error = getattr(resp, "error", None) or (resp.get("error") if isinstance(resp, dict) else None)
    if error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "GOOGLE_AUTH_FAILED", "message": "Không thể xác thực Google."},
        )

    session = getattr(resp, "session", None) or (resp.get("session") if isinstance(resp, dict) else None)
    user_obj = getattr(resp, "user", None) or (resp.get("user") if isinstance(resp, dict) else None)
    if not session or not user_obj:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"code": "GOOGLE_AUTH_FAILED", "message": "Không thể xác thực Google."},
        )

    access_token = getattr(session, "access_token", None) or (session.get("access_token") if isinstance(session, dict) else None)
    user_id = getattr(user_obj, "id", None) or (user_obj.get("id") if isinstance(user_obj, dict) else None)
    role = _role_from_auth_user(user_obj) or _role_from_profile(str(user_id)) or "user"
    profile = _ensure_profile(str(user_id), email, {
        "full_name": claims.get("name"),
        "display_name": claims.get("given_name") or claims.get("name"),
        "avatar_url": claims.get("picture"),
        "google_id": claims.get("sub"),
        "auth_provider": "google",
        "is_active": True,
    })
    if profile.get("is_active") is False:
        raise HTTPException(status_code=403, detail={"code": "ACCOUNT_DISABLED", "message": "Tài khoản đã bị vô hiệu hóa."})

    return {"success": True, "data": {"access_token": access_token, "token_type": "bearer", "user": _user_payload(str(user_id), email, role, profile)}}


@router.post("/request-password-reset")
async def request_password_reset(payload: PasswordResetRequest) -> Dict[str, Any]:
    if not (settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD and settings.SMTP_FROM):
        return {"success": True, "data": {"message": "Tính năng gửi email reset cần cấu hình Email SMTP."}}
    try:
        _anon_client().auth.reset_password_email(str(payload.email))
    except Exception as exc:
        print(f"PASSWORD RESET FAILED: {exc}")
        raise HTTPException(status_code=500, detail={"code": "RESET_EMAIL_FAILED", "message": "Không thể gửi email reset mật khẩu."}) from exc
    return {"success": True, "data": {"message": "Nếu email tồn tại, hướng dẫn reset mật khẩu đã được gửi."}}
