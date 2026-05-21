from fastapi import HTTPException


ERROR_MESSAGES = {
    "FILE_TOO_LARGE": "File vượt quá 20MB",
    "INVALID_FILE_TYPE": "Chỉ chấp nhận file PDF",
    "PARSE_FAILED": "Không thể đọc nội dung PDF",
    "DOC_NOT_FOUND": "Không tìm thấy tài liệu",
    "EMBED_FAILED": "Lỗi khi gọi Gemini Embedding",
    "LLM_FAILED": "Lỗi khi gọi Gemini Flash",
    "INTERNAL_ERROR": "Lỗi server không xác định",
}


def raise_contract_error(status_code: int, code: str, message: str | None = None):
    raise HTTPException(
        status_code=status_code,
        detail={"success": False, "error": {"code": code, "message": message or ERROR_MESSAGES.get(code, "Đã có lỗi xảy ra")}},
    )


def success_response(data: dict):
    return {"success": True, "data": data}
