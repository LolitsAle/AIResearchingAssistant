import json
from app.services.ollama_service import ollama_service


def compare_papers(payload: list[dict]) -> dict:
    prompt = 'So sánh các paper sau và trả JSON {overview,papers,comparison_table,conclusion}:\n' + json.dumps(payload, ensure_ascii=False)
    raw = ollama_service.generate_text(prompt)
    try:
        return json.loads(raw)
    except Exception:
        return {'overview': raw, 'papers': payload, 'comparison_table': [], 'conclusion': ''}
