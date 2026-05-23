import httpx

from app.core.config import settings
from app.core.errors import AppError


class OllamaService:
    def __init__(self):
        self.base_url = settings.ollama_base_url.rstrip('/')
        self.chat_model = settings.ollama_chat_model

    def health(self) -> str:
        try:
            r = httpx.get(f'{self.base_url}/api/tags', timeout=5)
            return 'available' if r.status_code == 200 else 'unavailable'
        except Exception:
            return 'unavailable'

    def generate_text(self, prompt: str) -> str:
        payload = {'model': self.chat_model, 'prompt': prompt, 'stream': False}
        try:
            r = httpx.post(f'{self.base_url}/api/generate', json=payload, timeout=120)
            r.raise_for_status()
            return r.json().get('response', '').strip()
        except Exception as exc:
            raise AppError('Ollama is not available. Please start Ollama and pull the configured model.', 503) from exc


ollama_service = OllamaService()
