def chunk_pages(pages: list[dict], chunk_words: int = 1100, overlap_words: int = 120):
    chunks = []
    idx = 0
    for p in pages:
        words = p['text'].split()
        start = 0
        while start < len(words):
            end = min(len(words), start + chunk_words)
            content = ' '.join(words[start:end])
            if content:
                chunks.append({
                    'chunk_index': idx,
                    'section': p.get('section') or f"Page {p['page']}",
                    'page_start': p['page'],
                    'page_end': p['page'],
                    'content': content,
                })
                idx += 1
            if end == len(words):
                break
            start = max(0, end - overlap_words)
    return chunks
