from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def retrieve_top_chunks(question: str, chunks: list, top_k: int = 5):
    texts = [c.content for c in chunks]
    if not texts:
        return []
    vec = TfidfVectorizer(stop_words='english')
    matrix = vec.fit_transform(texts + [question])
    q_vec = matrix[-1]
    c_mat = matrix[:-1]
    scores = cosine_similarity(q_vec, c_mat).flatten()
    ranked = sorted(list(enumerate(scores)), key=lambda x: x[1], reverse=True)[:top_k]
    out = []
    for i, score in ranked:
        c = chunks[i]
        out.append({'chunk': c, 'score': float(score)})
    return out
