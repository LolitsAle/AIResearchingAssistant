from fastapi import APIRouter
from app.services.ollama_service import ollama_service

router = APIRouter()


@router.get('/health')
def health():
    return {'status': 'ok', 'ollama': ollama_service.health()}
