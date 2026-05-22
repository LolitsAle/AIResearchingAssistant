from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


def retrieve_top_chunks(question: str, chunks: list, top_k: int = 5):
    docs = [c.content for c in chunks]
    vect = TfidfVectorizer(stop_words='english')
    m = vect.fit_transform(docs + [question])
    scores = cosine_similarity(m[-1], m[:-1])[0]
    ranked = sorted(list(enumerate(scores)), key=lambda x: x[1], reverse=True)[:top_k]
    results = []
    for i, score in ranked:
        c = chunks[i]
        results.append({'chunk': c, 'score': float(score)})
    return results
