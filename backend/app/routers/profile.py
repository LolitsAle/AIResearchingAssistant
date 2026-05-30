"""Current-user profile, security, social-link and data-management routes."""
from __future__ import annotations

import json
from datetime import date, datetime, timezone
from typing import Any, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from app.config import settings
from app.db.supabase_client import supabase
from app.dependencies import get_current_user
from app.services.google_auth_service import verify_google_credential

router = APIRouter(prefix="/api/profile", tags=["profile"])

MAX_AVATAR_BYTES = 5 * 1024 * 1024
ALLOWED_AVATAR_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


def _supabase_response_data(resp: Any):
    if isinstance(resp, dict):
        return resp.get("data"), resp.get("error")
    return getattr(resp, "data", None), getattr(resp, "error", None)


def _user_id(user: dict) -> str:
    return str(user.get("id") or user.get("user_id"))


def _profile_select() -> str:
    return "id,email,role,avatar_url,full_name,display_name,gender,date_of_birth,created_at,google_id,auth_provider,email_2fa_enabled,is_active,preferred_theme,preferred_language,password_login_enabled"


def _safe_profile(row: dict | None, user: dict) -> dict:
    row = row or {}
    email = row.get("email") or user.get("email")
    display = row.get("display_name") or row.get("full_name") or (email.split("@")[0] if email and "@" in email else email)
    return {
        "id": _user_id(user),
        "user_id": _user_id(user),
        "email": email,
        "name": display,
        "role": row.get("role") or user.get("role", "user"),
        "avatar_url": row.get("avatar_url"),
        "full_name": row.get("full_name"),
        "display_name": row.get("display_name"),
        "gender": row.get("gender"),
        "date_of_birth": row.get("date_of_birth"),
        "created_at": row.get("created_at"),
        "google_connected": bool(row.get("google_id")),
        "email_2fa_enabled": bool(row.get("email_2fa_enabled", False)),
        "is_active": row.get("is_active", True),
        "preferred_theme": row.get("preferred_theme") or "system",
        "preferred_language": row.get("preferred_language") or "vi",
        "has_password": bool(row.get("password_login_enabled", False)),
    }


def _get_profile(user: dict) -> dict:
    user_id = _user_id(user)
    try:
        resp = supabase.table("profiles").select(_profile_select()).eq("id", user_id).limit(1).execute()
        rows, error = _supabase_response_data(resp)
        if error:
            raise RuntimeError(error)
        if rows:
            return rows[0]
        created = {
            "id": user_id,
            "email": user.get("email"),
            "role": user.get("role", "user"),
            "is_active": True,
            "preferred_theme": "system",
            "preferred_language": "vi",
        }
        resp = supabase.table("profiles").insert(created).execute()
        rows, _ = _supabase_response_data(resp)
        return rows[0] if rows else created
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"code": "PROFILE_LOAD_FAILED", "message": "Không thể tải hồ sơ."}) from exc


def _update_profile(user: dict, updates: dict) -> dict:
    if not updates:
        return _get_profile(user)
    try:
        resp = supabase.table("profiles").update(updates).eq("id", _user_id(user)).execute()
        rows, error = _supabase_response_data(resp)
        if error:
            raise RuntimeError(error)
        return rows[0] if rows else _get_profile(user)
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"code": "PROFILE_UPDATE_FAILED", "message": "Không thể cập nhật hồ sơ."}) from exc


class ProfileUpdateRequest(BaseModel):
    full_name: str | None = Field(default=None, max_length=160)
    display_name: str | None = Field(default=None, max_length=80)
    gender: Literal["male", "female", "other", "prefer_not_to_say"] | None = None
    date_of_birth: date | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str | None = None
    new_password: str = Field(..., min_length=6, max_length=128)


class GoogleCredentialRequest(BaseModel):
    credential: str


class PreferencesRequest(BaseModel):
    preferred_theme: Literal["light", "dark", "system"]
    preferred_language: Literal["vi", "en"]


def _smtp_configured() -> bool:
    return bool(settings.SMTP_HOST and settings.SMTP_USER and settings.SMTP_PASSWORD and settings.SMTP_FROM)


@router.get("/me")
async def get_me(user: dict = Depends(get_current_user)) -> dict:
    profile = _get_profile(user)
    if profile.get("is_active") is False:
        raise HTTPException(status_code=403, detail={"code": "ACCOUNT_DISABLED", "message": "Tài khoản đã bị vô hiệu hóa."})
    return {"success": True, "data": {"user": _safe_profile(profile, user)}}


@router.patch("/me")
async def update_me(payload: ProfileUpdateRequest, user: dict = Depends(get_current_user)) -> dict:
    updates = payload.model_dump(exclude_unset=True)
    if "date_of_birth" in updates and updates["date_of_birth"] is not None:
        updates["date_of_birth"] = updates["date_of_birth"].isoformat()
    profile = _update_profile(user, updates)
    return {"success": True, "data": {"user": _safe_profile(profile, user)}}


@router.post("/avatar")
async def upload_avatar(avatar: UploadFile = File(...), user: dict = Depends(get_current_user)) -> dict:
    if avatar.content_type not in ALLOWED_AVATAR_TYPES:
        raise HTTPException(status_code=400, detail={"code": "INVALID_AVATAR_TYPE", "message": "Avatar phải là JPEG, PNG hoặc WebP."})
    content = await avatar.read()
    if len(content) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail={"code": "AVATAR_TOO_LARGE", "message": "Avatar tối đa 5MB."})
    ext = ALLOWED_AVATAR_TYPES[avatar.content_type]
    path = f"{_user_id(user)}/avatar-{uuid4().hex}.{ext}"
    try:
        supabase.storage.from_(settings.AVATAR_STORAGE_BUCKET).upload(path, content, {"content-type": avatar.content_type, "upsert": "true"})
        public_url = supabase.storage.from_(settings.AVATAR_STORAGE_BUCKET).get_public_url(path)
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"code": "AVATAR_UPLOAD_FAILED", "message": "Không thể upload avatar lên Supabase Storage."}) from exc
    profile = _update_profile(user, {"avatar_url": public_url})
    return {"success": True, "data": {"avatar_url": public_url, "user": _safe_profile(profile, user)}}


@router.post("/change-password")
async def change_password(payload: ChangePasswordRequest, user: dict = Depends(get_current_user)) -> dict:
    profile = _get_profile(user)
    if profile.get("password_login_enabled"):
        if not payload.current_password:
            raise HTTPException(status_code=400, detail={"code": "CURRENT_PASSWORD_REQUIRED", "message": "Vui lòng nhập mật khẩu hiện tại."})
        try:
            supabase.auth.sign_in_with_password({"email": user["email"], "password": payload.current_password})
        except Exception as exc:
            raise HTTPException(status_code=401, detail={"code": "INVALID_CURRENT_PASSWORD", "message": "Mật khẩu hiện tại không đúng."}) from exc
    else:
        if not _smtp_configured():
            raise HTTPException(status_code=400, detail={"code": "PASSWORD_RESET_REQUIRED", "message": "Tài khoản Google cần xác thực email/reset mật khẩu trước khi đặt mật khẩu."})
    try:
        supabase.auth.admin.update_user_by_id(_user_id(user), {"password": payload.new_password})
    except Exception as exc:
        raise HTTPException(status_code=500, detail={"code": "PASSWORD_UPDATE_FAILED", "message": "Không thể cập nhật mật khẩu."}) from exc
    _update_profile(user, {"password_login_enabled": True})
    return {"success": True, "data": {"message": "Đã cập nhật mật khẩu."}}


@router.post("/2fa/email/enable")
async def enable_email_2fa(user: dict = Depends(get_current_user)) -> dict:
    if not _smtp_configured():
        return {"success": True, "data": {"enabled": False, "message": "Cần cấu hình Email SMTP để bật 2FA."}}
    profile = _update_profile(user, {"email_2fa_enabled": True})
    return {"success": True, "data": {"enabled": True, "user": _safe_profile(profile, user), "message": "Đã bật 2FA email."}}


@router.post("/2fa/email/disable")
async def disable_email_2fa(user: dict = Depends(get_current_user)) -> dict:
    profile = _update_profile(user, {"email_2fa_enabled": False})
    return {"success": True, "data": {"enabled": False, "user": _safe_profile(profile, user), "message": "Đã tắt 2FA email."}}


@router.post("/social/google/connect")
async def connect_google(payload: GoogleCredentialRequest, user: dict = Depends(get_current_user)) -> dict:
    claims = verify_google_credential(payload.credential)
    if claims.get("email", "").lower() != user.get("email", "").lower():
        raise HTTPException(status_code=400, detail={"code": "GOOGLE_EMAIL_MISMATCH", "message": "Email Google phải trùng với email tài khoản hiện tại."})
    profile = _update_profile(user, {"google_id": claims["sub"], "auth_provider": "google", "avatar_url": claims.get("picture")})
    return {"success": True, "data": {"user": _safe_profile(profile, user), "message": "Đã kết nối Google."}}


@router.post("/social/google/disconnect")
async def disconnect_google(user: dict = Depends(get_current_user)) -> dict:
    profile = _get_profile(user)
    if not profile.get("password_login_enabled"):
        raise HTTPException(status_code=400, detail={"code": "PASSWORD_REQUIRED", "message": "Vui lòng đặt mật khẩu trước khi ngắt kết nối Google."})
    profile = _update_profile(user, {"google_id": None, "auth_provider": "password"})
    return {"success": True, "data": {"user": _safe_profile(profile, user), "message": "Đã ngắt kết nối Google."}}


@router.patch("/preferences")
async def update_preferences(payload: PreferencesRequest, user: dict = Depends(get_current_user)) -> dict:
    profile = _update_profile(user, payload.model_dump())
    return {"success": True, "data": {"user": _safe_profile(profile, user)}}


def _select_owned(table: str, columns: str, user_id: str, *, limit: int | None = None, order: bool = False) -> list[dict]:
    q = supabase.table(table).select(columns).eq("user_id", user_id)
    if order:
        q = q.order("created_at", desc=True)
    if limit:
        q = q.limit(limit)
    rows, error = _supabase_response_data(q.execute())
    return [] if error else (rows or [])


@router.get("/activity")
async def activity(user: dict = Depends(get_current_user)) -> dict:
    user_id = _user_id(user)
    profile = _get_profile(user)
    notebooks = _select_owned("notebooks", "id,name,created_at", user_id, limit=10, order=True)
    notebook_ids = [n["id"] for n in notebooks]
    docs: list[dict] = []
    sessions: list[dict] = []
    notes: list[dict] = []
    try:
        if notebook_ids:
            docs, _ = _supabase_response_data(supabase.table("documents").select("id,filename,created_at,notebook_id").in_("notebook_id", notebook_ids).order("created_at", desc=True).limit(10).execute())
            sessions, _ = _supabase_response_data(supabase.table("research_sessions").select("id,title,created_at,notebook_id").in_("notebook_id", notebook_ids).order("created_at", desc=True).limit(10).execute())
            notes, _ = _supabase_response_data(supabase.table("notes").select("id,title,created_at,workspace_id").in_("workspace_id", notebook_ids).order("created_at", desc=True).limit(10).execute())
    except Exception:
        docs, sessions, notes = [], [], []
    recent = []
    for n in notebooks:
        recent.append({"type": "notebook_created", "label": f"Đã tạo notebook {n.get('name') or ''}".strip(), "created_at": n.get("created_at")})
    for d in docs or []:
        recent.append({"type": "document_uploaded", "label": f"Đã tải tài liệu {d.get('filename') or ''}".strip(), "created_at": d.get("created_at")})
    for s in sessions or []:
        recent.append({"type": "research_session_created", "label": f"Đã tạo phiên nghiên cứu {s.get('title') or ''}".strip(), "created_at": s.get("created_at")})
    for n in notes or []:
        recent.append({"type": "note_created", "label": f"Đã tạo note {n.get('title') or ''}".strip(), "created_at": n.get("created_at")})
    recent.sort(key=lambda x: x.get("created_at") or "", reverse=True)
    return {"success": True, "data": {"account_created_at": profile.get("created_at"), "stats": {"notebooks": len(notebooks), "documents": len(docs or []), "research_sessions": len(sessions or []), "notes": len(notes or [])}, "recent_activity": recent[:12]}}


@router.get("/export-data")
async def export_data(user: dict = Depends(get_current_user)) -> JSONResponse:
    user_id = _user_id(user)
    profile = _safe_profile(_get_profile(user), user)
    notebooks = _select_owned("notebooks", "*", user_id, order=True)
    notebook_ids = [n["id"] for n in notebooks]
    payload = {"profile": profile, "notebooks": notebooks, "documents": [], "research_sessions": [], "notes": [], "created_at": datetime.now(timezone.utc).isoformat()}
    try:
        if notebook_ids:
            payload["documents"], _ = _supabase_response_data(supabase.table("documents").select("*").in_("notebook_id", notebook_ids).execute())
            payload["research_sessions"], _ = _supabase_response_data(supabase.table("research_sessions").select("*").in_("notebook_id", notebook_ids).execute())
            payload["notes"], _ = _supabase_response_data(supabase.table("notes").select("*").in_("workspace_id", notebook_ids).execute())
    except Exception:
        pass
    filename = f"user-data-{date.today().isoformat()}.json"
    return JSONResponse(content=json.loads(json.dumps(payload, default=str)), headers={"Content-Disposition": f"attachment; filename={filename}"})


@router.post("/deactivate")
async def deactivate(user: dict = Depends(get_current_user)) -> dict:
    _update_profile(user, {"is_active": False})
    return {"success": True, "data": {"message": "Tài khoản đã được vô hiệu hóa."}}


@router.delete("/account")
async def delete_account(user: dict = Depends(get_current_user)) -> dict:
    anonymized = f"deleted-{_user_id(user)}@deleted.local"
    _update_profile(user, {"is_active": False, "email": anonymized, "full_name": None, "display_name": "Deleted user", "avatar_url": None, "google_id": None})
    try:
        supabase.auth.admin.update_user_by_id(_user_id(user), {"user_metadata": {"deleted": True}})
    except Exception:
        pass
    return {"success": True, "data": {"message": "Tài khoản đã được đánh dấu xóa và ẩn danh hồ sơ."}}
