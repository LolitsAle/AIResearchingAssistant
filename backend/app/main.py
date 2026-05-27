from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.errors import register_exception_handlers
from app.db.init_db import init_db
from app.routers.auth import router as auth_router
from app.routers.health import router as health_router
from app.routers.workspaces import router as workspaces_router
from app.routers.workspace_features import router as workspace_features_router

app = FastAPI(title='AI Researching Assistant API', version='2.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

register_exception_handlers(app)
app.include_router(auth_router, prefix='/api', tags=['auth'])
app.include_router(health_router, prefix='/api', tags=['health'])
app.include_router(workspaces_router, prefix='/api', tags=['workspaces'])
app.include_router(workspace_features_router, prefix='/api', tags=['workspace'])


@app.on_event('startup')
def on_startup() -> None:
    init_db()
