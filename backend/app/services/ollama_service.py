import httpx
from app.core.config import settings

# Có thể giữ lại hoặc xóa biến này, nhưng trong hàm generate_text ta sẽ không dùng nó nữa
TIMEOUT = 90.0 

async def health_check() -> bool:
    try:
        async with httpx.AsyncClient(timeout=None) as client:
            r = await client.get(f"{settings.ollama_base_url}/api/tags")
            return r.status_code == 200
    except Exception:
        return False


async def generate_text(prompt: str) -> str:
    payload = {'model': settings.ollama_chat_model, 'prompt': prompt, 'stream': False}
    
    # SỬA TẠI ĐÂY: Thay timeout=TIMEOUT bằng timeout=None để cho phép đợi vô hạn
    async with httpx.AsyncClient(timeout=None) as client:
        r = await client.post(f"{settings.ollama_base_url}/api/generate", json=payload)
        
    if r.status_code != 200:
        raise RuntimeError('Ollama is not available. Please start Ollama and pull the configured model.')
        
    return r.json().get('response', '').strip()