"""Unit tests for corpus transport fallback (Postgres → REST)."""

import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mcps.cpc_corpus import transport
from mcps.cpc_corpus import queries


def test_search_projects_falls_back_to_rest_keyword(monkeypatch):
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "test-key")

    def boom(*_a, **_k):
        raise transport.PostgresUnavailable("connection timed out")

    fake_rows = [
        {
            "id": "uuid-1",
            "title": "Rail Project",
            "organisation": "CPC",
            "abstract": "Test",
            "transport_relevance_score": 0.8,
            "similarity": None,
            "source_type": "project",
        }
    ]

    with patch.object(queries, "_pg_query", side_effect=boom):
        with patch.object(queries, "embed_query", return_value=None):
            with patch.object(queries.queries_rest, "search_projects_keyword", return_value=fake_rows):
                out = queries.search_projects("rail", limit=5)

    assert len(out) == 1
    assert out[0]["id"] == "uuid-1"
    assert transport.get_last_transport() == "rest_keyword"


def test_search_projects_uses_postgres_when_available(monkeypatch):
    pg_row = {
        "id": "uuid-2",
        "title": "Alpha",
        "lead_org_name": "Org",
        "abstract": "Body",
        "transport_relevance_score": 0.9,
        "similarity": 0.88,
    }

    with patch.object(queries, "_pg_query", return_value=[pg_row]):
        with patch.object(queries, "embed_query", return_value="[0.1,0.2]"):
            out = queries.search_projects("rail", limit=3)

    assert out[0]["similarity"] == 0.88
    assert transport.get_last_transport() == "postgres"


def test_human_transport_note_keyword():
    note = transport.human_transport_note("rest_keyword")
    assert "keyword" in note.lower()
    assert "443" in note or "https" in note.lower() or "Postgres" in note


if __name__ == "__main__":
    import pytest
    raise SystemExit(pytest.main([__file__, "-q"]))
