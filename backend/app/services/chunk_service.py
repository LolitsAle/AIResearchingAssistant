def chunk_pages(pages: list[dict], chunk_size: int = 1200, overlap: int = 200) -> list[dict]:
    chunks = []
    idx = 0
    for page in pages:
        words = page['text'].split()
        start = 0
        while start < len(words):
            end = min(len(words), start + chunk_size)
            content = ' '.join(words[start:end]).strip()
            if content:
                chunks.append({
                    'chunk_index': idx,
                    'section': page.get('section', 'Unknown'),
                    'page_start': page['page'],
                    'page_end': page['page'],
                    'content': content,
                })
                idx += 1
            if end >= len(words):
                break
            start = max(0, end - overlap)
    return chunks
