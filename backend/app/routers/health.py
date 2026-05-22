from fastapi import APIRouter
from app.services.ollama_service import health_check

router = APIRouter()

@router.get('/health')
async def get_health():
    return {'status': 'ok', 'ollama': 'available' if await health_check() else 'unavailable'}
