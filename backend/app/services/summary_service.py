# @deprecated: Ollama/local LLM flow has been replaced by Gemini 1.5 Flash + Google text-embedding-004.

def build_summary(content: str) -> dict:
    return {
        'short_summary': '',
        'detailed_summary': '',
        'research_problem': '',
        'methodology': '',
        'main_contributions': [],
        'key_ideas': [],
        'results': [],
        'limitations': [],
    }
