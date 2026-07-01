"""REST-first corpus transport — search and connect graph over 443."""

from __future__ import annotations

import os

import pytest


@pytest.fixture(autouse=True)
def _rest_first(monkeypatch):
    monkeypatch.setenv("ATLAS_V5_CORPUS_REST_FIRST", "1")
    monkeypatch.setenv("ATLAS_V5_CORPUS_PG_SECONDARY", "0")


@pytest.mark.skipif(
    not os.getenv("NEXT_PUBLIC_SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_KEY"),
    reason="Supabase REST not configured",
)
def test_search_projects_rest_first_returns_hits():
    from dotenv import load_dotenv

    load_dotenv(".env.local", override=True)
    from mcps.cpc_corpus import transport
    from mcps.cpc_corpus.queries import search_projects

    rows = search_projects("rail decarbonisation", limit=3)
    assert len(rows) >= 1
    assert transport.get_last_transport() == "rest_vector"
    assert rows[0].get("id")


@pytest.mark.skipif(
    not os.getenv("NEXT_PUBLIC_SUPABASE_URL") or not os.getenv("SUPABASE_SERVICE_KEY"),
    reason="Supabase REST not configured",
)
def test_connect_graph_rest_returns_nodes():
    from dotenv import load_dotenv

    load_dotenv(".env.local", override=True)
    from agents.atlas_v5.network_corpus import fetch_connect_network_graph

    graph = fetch_connect_network_graph()
    assert len(graph.nodes) >= 2
    assert len(graph.edges) >= 1
