import json
from app.services.ollama_service import generate_text


SUMMARY_SCHEMA = {
    'short_summary': '', 'detailed_summary': '', 'research_problem': '', 'methodology': '',
    'main_contributions': [], 'key_ideas': [], 'results': [], 'limitations': []
}


async def generate_structured_summary(context: str):
    prompt = f'''You are a research assistant. Based only on CONTEXT, return strict JSON with keys: {list(SUMMARY_SCHEMA.keys())}.
If missing info, use empty string/list.\nCONTEXT:\n{context[:18000]}'''
    raw = await generate_text(prompt)
    try:
        data = json.loads(raw)
        for k, v in SUMMARY_SCHEMA.items():
            data.setdefault(k, v)
        return data
    except Exception:
        return {**SUMMARY_SCHEMA, 'detailed_summary': raw, 'short_summary': raw[:500]}
