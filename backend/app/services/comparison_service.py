import json
from app.services.ollama_service import generate_text


async def compare_papers(payload_text: str, paper_ids: list[str]):
    prompt = f'''Compare these papers using only provided context. Return strict JSON with keys overview, comparison_table, conclusion.
comparison_table is array of objects: aspect, values(object keyed by paper id).
CONTEXT:\n{payload_text[:22000]}'''
    raw = await generate_text(prompt)
    try:
        data = json.loads(raw)
    except Exception:
        data = {'overview': raw[:1000], 'comparison_table': [], 'conclusion': 'Model returned unstructured output.'}
    data['papers'] = [{'paper_id': p, 'title': p} for p in paper_ids]
    return data
