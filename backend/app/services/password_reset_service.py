"""Password reset OTP storage and validation helpers."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Any

from passlib.context import CryptContext

from app.config import settings
from app.db.supabase_client import supabase
from app.services.email_service import is_smtp_configured, send_password_reset_otp

OTP_EXPIRES_MINUTES = 10
MAX_OTP_ATTEMPTS = 5
GENERIC_RESET_REQUEST_MESSAGE = "Nếu email tồn tại, mã xác thực đã được gửi."
OTP_SENT_MESSAGE = "Mã xác thực đã được tạo. Vui lòng kiểm tra email."
OTP_VALID_MESSAGE = "Mã xác thực hợp lệ."
PASSWORD_UPDATED_MESSAGE = "Đã cập nhật mật khẩu."
OTP_INVALID_MESSAGE = "Mã xác thực không đúng hoặc đã hết hạn."
OTP_EXPIRED_MESSAGE = "Mã xác thực đã hết hạn. Vui lòng yêu cầu mã mới."
SMTP_NOT_CONFIGURED_MESSAGE = "Chưa cấu hình dịch vụ gửi email."

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def is_dev_auth_bypass_enabled() -> bool:
    return (
        settings.APP_ENV.lower() == "development"
        and settings.ENABLE_DEV_AUTH_BYPASS is True
    )


def _supabase_response_data(resp: Any):
    if isinstance(resp, dict):
        return resp.get("data"), resp.get("error")
    return getattr(resp, "data", None), getattr(resp, "error", None)


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _parse_dt(value: Any) -> datetime | None:
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    if not value:
        return None
    try:
        normalized = str(value).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(normalized)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _hash_otp(email: str, otp: str) -> str:
    return pwd_context.hash(f"{_normalize_email(email)}:{otp}")


def _verify_otp_hash(email: str, otp: str, otp_hash: str) -> bool:
    try:
        return pwd_context.verify(f"{_normalize_email(email)}:{otp}", otp_hash)
    except Exception:
        return False


def generate_otp() -> str:
    return f"{secrets.randbelow(10000):04d}"


def create_password_reset_otp(email: str) -> str:
    normalized_email = _normalize_email(email)
    otp = generate_otp()
    expires_at = _now() + timedelta(minutes=OTP_EXPIRES_MINUTES)

    resp = supabase.table("password_reset_otps").insert(
        {
            "email": normalized_email,
            "otp_hash": _hash_otp(normalized_email, otp),
            "expires_at": expires_at.isoformat(),
        }
    ).execute()
    _, error = _supabase_response_data(resp)
    if error:
        raise RuntimeError(str(error))
    return otp


def send_or_allow_dev_otp(email: str, otp: str) -> None:
    if is_smtp_configured():
        send_password_reset_otp(email, otp)
        return

    if is_dev_auth_bypass_enabled():
        print("DEV OTP bypass enabled")
        return

    raise RuntimeError(SMTP_NOT_CONFIGURED_MESSAGE)


def get_latest_active_otp(email: str) -> dict | None:
    resp = (
        supabase.table("password_reset_otps")
        .select("*")
        .eq("email", _normalize_email(email))
        .is_("used_at", "null")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows, error = _supabase_response_data(resp)
    if error:
        raise RuntimeError(str(error))
    return rows[0] if rows else None


def mark_otp_used(otp_id: str) -> None:
    supabase.table("password_reset_otps").update(
        {"used_at": _now().isoformat()}
    ).eq("id", otp_id).execute()


def increment_otp_attempts(row: dict) -> None:
    try:
        supabase.table("password_reset_otps").update(
            {"attempts": int(row.get("attempts") or 0) + 1}
        ).eq("id", row["id"]).execute()
    except Exception:
        pass


def verify_password_reset_otp(email: str, otp: str, *, mark_used: bool = False) -> tuple[bool, str]:
    normalized_email = _normalize_email(email)
    otp = str(otp or "").strip()

    if is_dev_auth_bypass_enabled() and otp == "8888":
        return True, OTP_VALID_MESSAGE

    row = get_latest_active_otp(normalized_email)
    if not row:
        return False, OTP_INVALID_MESSAGE

    expires_at = _parse_dt(row.get("expires_at"))
    if not expires_at or expires_at <= _now():
        return False, OTP_EXPIRED_MESSAGE

    if int(row.get("attempts") or 0) >= MAX_OTP_ATTEMPTS:
        return False, OTP_INVALID_MESSAGE

    if not _verify_otp_hash(normalized_email, otp, str(row.get("otp_hash") or "")):
        increment_otp_attempts(row)
        return False, OTP_INVALID_MESSAGE

    if mark_used:
        mark_otp_used(str(row["id"]))

    return True, OTP_VALID_MESSAGE
