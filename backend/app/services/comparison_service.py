# @deprecated: Ollama/local LLM flow has been replaced by Gemini 1.5 Flash + Google text-embedding-004.

def compare_papers(payload: list[dict]) -> dict:
    return {'overview': '', 'papers': payload, 'comparison_table': [], 'conclusion': ''}
