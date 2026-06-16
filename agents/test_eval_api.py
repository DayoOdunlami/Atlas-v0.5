"""Phase B API — POST /eval/run smoke test."""
from __future__ import annotations


def test_eval_run_endpoint():
    from fastapi.testclient import TestClient
    from agents.server import app

    client = TestClient(app)
    health = client.get("/eval/health")
    assert health.status_code == 200
    assert health.json()["status"] == "ok"

    resp = client.post(
        "/eval/run",
        json={
            "query": "Explore the UK smart mobility innovation landscape",
            "expected_outcome": "orient",
            "include_judge": False,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["summary"]["outcome"] == "orient"
    assert body["quality"]["overall"] >= 0.6
