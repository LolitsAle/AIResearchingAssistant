from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import settings
from app.db.init_db import init_db
from app.routers.health import router as health_router
from app.routers.papers import router as papers_router

app = FastAPI(title=settings.app_name)
app.add_middleware(CORSMiddleware, allow_origins=[o.strip() for o in settings.cors_origins.split(',')], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

@app.on_event('startup')
def startup():
    init_db()

@app.exception_handler(Exception)
async def global_exception_handler(_: Request, exc: Exception):
    return JSONResponse(status_code=500, content={'error': {'code': 'INTERNAL_ERROR', 'message': str(exc)}})

app.include_router(health_router, prefix=settings.api_prefix)
app.include_router(papers_router, prefix=settings.api_prefix)
