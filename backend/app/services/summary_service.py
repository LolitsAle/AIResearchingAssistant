import json
from app.services.ollama_service import ollama_service


def build_summary(content: str) -> dict:
    prompt = f'''Bạn là trợ lý nghiên cứu. Tạo JSON với keys: short_summary,detailed_summary,research_problem,methodology,main_contributions,key_ideas,results,limitations. Nội dung:\n{content[:12000]}'''
    raw = ollama_service.generate_text(prompt)
    try:
        data = json.loads(raw)
    except Exception:
        data = {
            'short_summary': raw[:300],
            'detailed_summary': raw,
            'research_problem': '',
            'methodology': '',
            'main_contributions': [],
            'key_ideas': [],
            'results': [],
            'limitations': [],
        }
    return data
