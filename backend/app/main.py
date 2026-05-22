from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.db.init_db import init_db
from app.routers.health import router as health_router
from app.routers.papers import router as papers_router

# 1. Thay thế cách khởi chạy DB theo chuẩn FastAPI mới (lifespan)
@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(title=settings.app_name, lifespan=lifespan)

# 2. Giữ nguyên cấu hình CORS mặc định cho các request thành công
origins = [o.strip() for o in settings.cors_origins.split(',')]
app.add_middleware(
    CORSMiddleware, 
    allow_origins=origins, 
    allow_credentials=True, 
    allow_methods=['*'], 
    allow_headers=['*']
)

# 3. SỬA TẠI ĐÂY: Ép hàm bắt lỗi phải trả về kèm Header CORS
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    response = JSONResponse(
        status_code=500, 
        content={'error': {'code': 'INTERNAL_ERROR', 'message': str(exc)}}
    )
    
    # Lấy origin từ request gửi lên (nếu nó nằm trong danh sách được phép)
    request_origin = request.headers.get("origin")
    if request_origin in origins or "*" in origins:
        response.headers["Access-Control-Allow-Origin"] = request_origin or "*"
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "*"
        response.headers["Access-Control-Allow-Headers"] = "*"
        
    return response

app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(papers_router, prefix=settings.api_prefix)