import httpx
from app.core.config import settings

TIMEOUT = 90.0

async def health_check() -> bool:
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            r = await client.get(f"{settings.ollama_base_url}/api/tags")
            return r.status_code == 200
    except Exception:
        return False


async def generate_text(prompt: str) -> str:
    payload = {'model': settings.ollama_chat_model, 'prompt': prompt, 'stream': False}
    async with httpx.AsyncClient(timeout=TIMEOUT) as client:
        r = await client.post(f"{settings.ollama_base_url}/api/generate", json=payload)
    if r.status_code != 200:
        raise RuntimeError('Ollama is not available. Please start Ollama and pull the configured model.')
    return r.json().get('response', '').strip()
