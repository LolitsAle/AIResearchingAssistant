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

from app.services import system_library_service as service


class FakeTable:
    def __init__(self, row):
        self.row = row

    def select(self, *_args, **_kwargs):
        return self

    def update(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def single(self):
        return self

    def execute(self):
        return SimpleNamespace(data=self.row, error=None)


class FakeStorageBucket:
    def download(self, _path):
        raise KeyError("error")


class FakeStorage:
    def from_(self, _bucket):
        return FakeStorageBucket()


class FakeSupabase:
    def __init__(self, row):
        self.row = row
        self.storage = FakeStorage()

    def table(self, _name):
        return FakeTable(self.row)


def test_system_document_download_falls_back_to_open_access_url_when_storage_object_missing(monkeypatch):
    row = {
        "id": "doc-1",
        "title": "LLM",
        "filename": "LLM.pdf",
        "storage_path": "system-library/doc-1/LLM.pdf",
        "download_url": "https://example.com/LLM.pdf",
        "access_type": "OPEN_ACCESS",
        "status": "PUBLISHED",
        "download_count": 0,
    }
    monkeypatch.setattr(service, "supabase", FakeSupabase(row))

    result = service.get_system_document_download("doc-1")

    assert result == {"type": "redirect", "url": "https://example.com/LLM.pdf"}
