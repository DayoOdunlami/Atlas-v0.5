"""GATE 2–3 — Atlas v5 chat router and turn response tests."""

from __future__ import annotations

import asyncio
import os

import pytest
from langchain_core.messages import AIMessage, HumanMessage

from agents.atlas_v5.chat_router import (
    build_chat_only_reply,
    classify_follow_up,
)
from agents.atlas_v5.connect_assembler import assemble_connect_spec
from agents.atlas_v5.graph import _extract_query, atlas_v5_graph
from agents.atlas_v5.intent import (
    is_atlas_self_reflection_query,
    is_connect_network_query,
    is_identity_analogy_query,
    is_j1t1_orient_query,
    is_substantive_canvas_query,
)
from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec, format_gbp_compact
from agents.atlas_v5.j1t1_corpus import J1T1_QUERY_PHRASE
from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
from agents.atlas_v5.network_corpus import NetworkGraphData
from agents.atlas_v5.judgement_merge import merge_judgement_onto_skeleton
from agents.atlas_v5.judgement_models import JudgementFieldsOutput
from agents.atlas_v5.run_turn import run_turn, run_turn_response
from agents.atlas_v5.turn_classifier import (
    TurnClassifierOutput,
    classify_turn,
    classify_turn_heuristic,
)
from agents.contracts.answer_spec import SoWhat, Verdict

MOCK_STATS = J1T1CorpusStats(
    project_count=55,
    funding_sum=8_172_702.05,
    null_funding_count=18,
    funded_row_count=37,
    org_count=30,
    live_since_2024=27,
    funders=[
        FunderBreakdownRow("Innovate UK", 36, 1, 7_903_940.05),
        FunderBreakdownRow("EPSRC", 15, 15, 0.0),
    ],
    top_citations=[
        {
            "id": "bb918318-0000-4000-8000-000000000001",
            "title": "25kV Battery Train Charging Station Demonstration",
            "organisation": "Innovate UK",
            "score": 0.95,
        }
    ],
    queried_at="2026-06-17T00:00:00Z",
)

MOCK_SPEC = assemble_j1t1_spec(MOCK_STATS).model_dump(mode="json")


def test_format_gbp_compact():
    assert format_gbp_compact(8_172_702.05) == "£8.17m"
    assert format_gbp_compact(11_700_000_000, approximate=True) == "~£11.7bn"


def test_assemble_j1t1_spec_validates():
    spec = assemble_j1t1_spec(MOCK_STATS)
    assert spec.specVersion == "0.2.1"
    assert spec.stats[0].value == "55"
    assert spec.stats[1].value == "£8.17m"
    assert spec.instrument is not None
    assert spec.instrument.recipe == "IncommensurableMagnitudes"
    assert spec.instrument.honesty is not None
    assert spec.instrument.honesty.toScale is False
    assert spec.blindspot is not None
    assert spec.blindspot.structure is not None
    assert "EPSRC" in spec.blindspot.structure.pattern


def test_assemble_connect_spec_mock():
    graph = NetworkGraphData(
        nodes=[
            {"id": "rail", "label": "Rail", "group": "mode", "x": 100, "y": 100},
            {"id": "highways", "label": "Highways", "group": "mode", "x": 200, "y": 120},
        ],
        edges=[
            {"source": "rail", "target": "highways", "weight": 3.2, "trust": "corpus"},
        ],
        ladder_rung="ego-network",
        edge_density=0.5,
        corpus_count=2,
    )
    spec = assemble_connect_spec(MOCK_STATS, graph, query="map the network")
    assert spec.mode == "Connect"
    assert spec.instrument is not None
    assert spec.instrument.recipe == "NetworkMap"
    assert spec.carriedFrom is not None
    assert spec.carriedFrom.summary.startswith("Orient:")


def test_j1t1_query_detection():
    assert is_j1t1_orient_query(J1T1_QUERY_PHRASE)
    assert is_j1t1_orient_query("state of play on rail decarbonisation")
    assert not is_j1t1_orient_query("what is the weather")


def test_connect_query_detection():
    assert is_connect_network_query("show me the network of rail partners")
    assert is_connect_network_query("who collaborates in this ecosystem?")
    assert not is_connect_network_query("what is the weather")


def test_chat_router_greeting_is_chat_only():
    assert classify_follow_up("hello", MOCK_SPEC) == "chat_only"
    assert classify_follow_up("hllo", MOCK_SPEC) == "chat_only"


def test_extract_query_prefers_latest_message_over_stale_state():
    state = {
        "query": "how are you today?",
        "messages": [
            HumanMessage(content="how are you today?"),
            AIMessage(content="Doing well, thanks for asking!"),
            HumanMessage(content="Map the hydrogen supply chain"),
        ],
    }
    assert _extract_query(state) == "Map the hydrogen supply chain"


def test_substantive_canvas_query_in_domain():
    assert is_substantive_canvas_query("Tell me about aviation decarbonisation")
    assert is_substantive_canvas_query("Map the hydrogen supply chain")
    assert is_substantive_canvas_query(
        "WeWalk rail landscape — what value transfers to UK innovation?"
    )
    assert not is_substantive_canvas_query("whats the weather today?")


def test_persona_analogy_routes_chat_not_orient():
    q = (
        "if CPC was a persona what/ who would they be? "
        "wats the best analogy to help understand who cpc are"
    )
    assert is_identity_analogy_query(q)
    assert not is_substantive_canvas_query(q)
    d = classify_turn_heuristic(q, MOCK_SPEC)
    assert d.route == "chat"
    assert classify_follow_up(q, MOCK_SPEC) == "chat_only"


EXISTENCE_QUERY = (
    "Justify your existence or actually undermine your existence. Should CPC be putting "
    "money into developing you or pivoting what you offer? Or put their money into better "
    "sources. The marketers got plenty of AI elements in there. What makes you different? "
    "Where is your value? are you currently a weak offering that could be made better, "
    "or just a weak offering that's better to be avoided? What is the honest assessment "
    "on your value proposition and opportunities that you present?"
)


def test_atlas_self_reflection_routes_chat_not_orient():
    assert is_atlas_self_reflection_query(EXISTENCE_QUERY)
    assert not is_substantive_canvas_query(EXISTENCE_QUERY)
    d = classify_turn_heuristic(EXISTENCE_QUERY, MOCK_SPEC)
    assert d.route == "chat"
    assert classify_follow_up(EXISTENCE_QUERY, MOCK_SPEC) == "chat_only"


def test_chat_router_in_domain_follow_up_updates_canvas():
    assert classify_follow_up("Map the hydrogen supply chain", MOCK_SPEC) == "canvas_update"
    assert classify_follow_up("Tell me about aviation decarbonisation", MOCK_SPEC) == "canvas_update"
    assert (
        classify_follow_up(
            "update the ui and show me some insights from the corpus",
            MOCK_SPEC,
        )
        == "canvas_update"
    )


def test_classify_turn_overrides_haiku_chat_for_substantive():
    fake = TurnClassifierOutput(route="chat", reasoning="misclassified")
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "agents.atlas_v5.turn_classifier._haiku_classify",
            lambda q, spec=None: fake,
        )
        d = classify_turn("Map the hydrogen supply chain", MOCK_SPEC)
    assert d.route == "substantive"
    assert d.source == "heuristic"


def test_classify_turn_keeps_haiku_chat_for_off_topic():
    fake = TurnClassifierOutput(route="chat", reasoning="weather")
    with pytest.MonkeyPatch.context() as mp:
        mp.setattr(
            "agents.atlas_v5.turn_classifier._haiku_classify",
            lambda q, spec=None: fake,
        )
        d = classify_turn("whats the weather today?", MOCK_SPEC)
    assert d.route == "chat"
    assert d.source == "haiku"


def test_classify_turn_find_path_for_uncertainty():
    q = "I've got a rail idea, not sure what I'm asking"
    d = classify_turn_heuristic(q)
    assert d.route == "substantive"
    assert d.outcome_hint == "find_path"


def test_chat_router_clear_canvas_is_chat_only():
    assert classify_follow_up("clear the canvas / artifact area", MOCK_SPEC) == "chat_only"
    reply = build_chat_only_reply("clear the canvas", MOCK_SPEC)
    assert "cleared" in reply.lower()


@pytest.mark.asyncio
async def test_run_turn_response_clear_canvas():
    from agents.atlas_v5.run_turn import is_clear_canvas_query

    assert is_clear_canvas_query("clear the canvas")
    out = await run_turn_response("clear the canvas", current_spec=MOCK_SPEC)
    assert out.get("clear_canvas") is True
    assert out.get("update_canvas") is True
    assert "spec" not in out


def test_assemble_act_spec_mock():
    from agents.atlas_v5.act_assembler import assemble_act_spec
    from agents.atlas_v5.wide_pass import WidePassResult

    wide = WidePassResult(
        outcome="act",
        query="I have a rail SME idea — what funding fits?",
        stats=MOCK_STATS,
        corpus_hits=MOCK_STATS.top_citations,
        candidates=[{"title": "Innovate UK Smart Grant", "url": "https://example.gov.uk", "snippet": "Open call"}],
    )
    spec = assemble_act_spec(MOCK_STATS, wide, query=wide.query)
    assert spec.mode == "Act"
    assert spec.instrument is not None
    assert spec.instrument.recipe == "OpportunityList"


def test_reconcile_answer_spec_web():
    from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec
    from agents.atlas_v5.reconcile_spec import reconcile_answer_spec
    from agents.orchestrator.retrieval_fabric import EvidenceBag

    skeleton = assemble_j1t1_spec(MOCK_STATS)
    bag = EvidenceBag(
        lane_mode="dual",
        external=[{"title": "DfT Decarbonisation Plan", "url": "https://gov.uk/x", "snippet": "Policy"}],
        candidates=[{"title": "TRIG 2026", "url": "https://gov.uk/trig"}],
    )
    merged = reconcile_answer_spec(skeleton, bag)
    assert len(merged.web_evidence) == 1
    assert merged.reconciliation is not None
    assert merged.reconciliation.retrieval.lane_mode == "dual"


def test_chat_greeting_reply_not_orient_blob():
    reply = build_chat_only_reply("hello", MOCK_SPEC)
    assert "Orient refreshed" not in reply
    assert "IncommensurableMagnitudes" in reply or "orient" in reply.lower()


@pytest.mark.asyncio
async def test_run_turn_response_hello_skips_canvas():
    out = await run_turn_response("hello", current_spec=MOCK_SPEC)
    assert out.get("update_canvas") is False
    assert out.get("route") in ("chat", "clarify")
    assert "spec" not in out
    assert "Hi" in out["reply"] or "Atlas" in out["reply"]


def test_classify_turn_heuristic_substantive_network():
    d = classify_turn_heuristic("map the ecosystem", MOCK_SPEC)
    assert d.route == "substantive"
    assert d.outcome_hint == "connect"


def test_classify_turn_heuristic_chat_greeting():
    d = classify_turn_heuristic("hello", MOCK_SPEC)
    assert d.route == "chat"


def test_merge_judgement_preserves_sql_stats():
    skeleton = assemble_j1t1_spec(MOCK_STATS)
    judgement = JudgementFieldsOutput(
        mode="Orient",
        tier="Supported",
        verdict=Verdict(sentence="Generated verdict from model.", tail="Tail."),
        soWhat=SoWhat(
            lookingAt="Looking",
            oneDecision="Decide",
            gate="Gate",
            primaryAction="Act",
            turn="1 / 4",
        ),
        instrument_recipe="IncommensurableMagnitudes",
        chat_complement="Chat line.",
    )
    merged = merge_judgement_onto_skeleton(skeleton, judgement)
    assert merged.verdict.sentence == "Generated verdict from model."
    assert merged.stats[0].value == "55"
    assert merged.stats[1].value == "£8.17m"
    assert merged.corpus_citations[0].id == skeleton.corpus_citations[0].id


@pytest.mark.skipif(
    not (os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")),
    reason="POSTGRES_URL not set",
)
def test_run_turn_live_connect():
    spec = asyncio.run(run_turn("show the rail decarb network and relationships"))
    assert spec.mode == "Connect"
    assert spec.instrument is not None
    assert spec.instrument.recipe == "NetworkMap"
    assert spec.carriedFrom is not None
    data = spec.instrument.data
    assert isinstance(data.get("nodes"), list)
    assert isinstance(data.get("edges"), list)


@pytest.mark.skipif(
    not (os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL")),
    reason="POSTGRES_URL not set",
)
def test_run_turn_live_j1t1():
    spec = asyncio.run(run_turn(J1T1_QUERY_PHRASE))
    assert spec.mode == "Orient"
    assert spec.stats is not None
    assert spec.stats[0].value == "55"
    assert "8.17" in spec.stats[1].value


def test_graph_emits_envelope():
    config = {"configurable": {"thread_id": "gate2-test"}}
    result = asyncio.run(
        atlas_v5_graph.ainvoke(
            {
                "messages": [HumanMessage(content=J1T1_QUERY_PHRASE)],
                "query": J1T1_QUERY_PHRASE,
                "answer_spec_envelope": {},
                "answer_dev_meta": {},
                "canvas_cleared": False,
                "error": None,
            },
            config=config,
        )
    )
    envelope = result.get("answer_spec_envelope") or {}
    trace = result.get("reasoning_trace") or []
    assert len(trace) >= 3
    assert trace[0].get("node") == "prepare"
    if os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL"):
        assert envelope.get("status") == "final"
        spec = envelope.get("spec") or {}
        assert spec.get("mode") == "Orient"
        assert any(s.get("node") == "gather" for s in trace)
    else:
        assert envelope.get("status") in ("final", "error")
