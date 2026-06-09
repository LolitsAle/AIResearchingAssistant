import os
import sys
from pathlib import Path
from types import SimpleNamespace

os.environ.setdefault("GOOGLE_API_KEY", "test-google-key")
os.environ.setdefault("SUPABASE_URL", "https://example.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_KEY", "test-service-key")
os.environ.setdefault("SUPABASE_ANON_KEY", "test-anon-key")
os.environ.setdefault("GROQ_API_KEY", "test-groq-key")

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import embedder


class NotFoundEmbeddingError(Exception):
    status_code = 404


def test_embedding_batch_falls_back_when_configured_model_is_unsupported(monkeypatch):
    calls = []

    class FakeModels:
        def embed_content(self, *, model, contents, config):
            calls.append(model)
            if model == "models/gemini-embedding-002":
                raise NotFoundEmbeddingError("not supported for embedContent")
            return SimpleNamespace(embeddings=[SimpleNamespace(values=[0.1, 0.2, 0.3]) for _ in contents])

    monkeypatch.setattr(embedder, "client", SimpleNamespace(models=FakeModels()))
    monkeypatch.setattr(embedder, "EMBEDDING_MODEL", "models/gemini-embedding-002")
    monkeypatch.setattr(embedder, "EMBEDDING_MODEL_FALLBACKS", ["models/text-embedding-004"])

    vectors = embedder._embed_batch_with_retry(["hello"], "RETRIEVAL_DOCUMENT", retries=1)

    assert calls == ["models/gemini-embedding-002", "models/text-embedding-004"]
    assert vectors == [[0.1, 0.2, 0.3]]
