"""Unit tests for corpus connectivity probes."""

import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from mcps.cpc_corpus import connectivity
from mcps.cpc_corpus import transport


def test_probe_postgres_retries_then_succeeds(monkeypatch):
    monkeypatch.setenv("POSTGRES_URL", "postgresql://u:p@example.com:6543/postgres")
    monkeypatch.setenv("CORPUS_PG_PROBE_ATTEMPTS", "2")
    monkeypatch.setenv("CORPUS_PG_PROBE_TIMEOUT", "1")

    calls = {"n": 0}

    def fake_connect(*_a, **_k):
        calls["n"] += 1
        if calls["n"] == 1:
            raise OSError("timed out")
        conn = MagicMock()
        cur = MagicMock()
        conn.cursor.return_value.__enter__ = lambda s: cur
        conn.cursor.return_value.__exit__ = lambda *a: None
        return conn

    with patch.object(connectivity, "_connect_postgres", side_effect=fake_connect):
        with patch.object(connectivity.time, "sleep"):
            result = connectivity.probe_postgres()

    assert result["status"] == "ok"
    assert result["attempts"] == 2


def test_probe_postgres_fails_after_attempts(monkeypatch):
    monkeypatch.setenv("POSTGRES_URL", "postgresql://u:p@example.com:6543/postgres")
    monkeypatch.setenv("CORPUS_PG_PROBE_ATTEMPTS", "2")

    with patch.object(
        connectivity,
        "_connect_postgres",
        side_effect=OSError("connection refused"),
    ):
        with patch.object(connectivity.time, "sleep"):
            result = connectivity.probe_postgres()

    assert result["status"] == "fail"
    assert result["attempts"] == 2


def test_corpus_reachable_when_rest_ok_postgres_fail(monkeypatch):
    monkeypatch.setenv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co")
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "test-key")

    with patch.object(
        connectivity,
        "probe_postgres",
        return_value={"configured": True, "status": "fail", "attempts": 2},
    ):
        with patch.object(
            connectivity,
            "probe_rest",
            return_value={"configured": True, "status": "ok", "latency_ms": 42.0},
        ):
            conn = connectivity.probe_corpus_connectivity()

    assert conn["any_reachable"] is True
    assert conn["preferred_transport"] == "rest_https"


def test_corpus_unreachable_when_both_fail(monkeypatch):
    with patch.object(
        connectivity,
        "probe_postgres",
        return_value={"configured": True, "status": "fail", "attempts": 2},
    ):
        with patch.object(
            connectivity,
            "probe_rest",
            return_value={"configured": True, "status": "fail", "attempts": 1},
        ):
            conn = connectivity.probe_corpus_connectivity()

    assert conn["any_reachable"] is False
    assert conn["preferred_transport"] == "unavailable"


def test_probe_rest_skip_when_not_configured(monkeypatch):
    monkeypatch.delenv("NEXT_PUBLIC_SUPABASE_URL", raising=False)
    monkeypatch.delenv("SUPABASE_SERVICE_KEY", raising=False)
    result = connectivity.probe_rest()
    assert result["status"] == "skip"
    assert transport.rest_configured() is False
