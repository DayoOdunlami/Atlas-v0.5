"""GATE 3 — Connect turn AnswerSpec with NetworkMap instrument."""

from __future__ import annotations

from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec
from agents.atlas_v5.j1t1_corpus import fetch_j1t1_corpus_stats
from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.atlas_v5.network_corpus import NetworkGraphData, fetch_connect_network_graph
from agents.contracts.answer_spec import AnswerSpec


def assemble_connect_spec(
    stats: J1T1CorpusStats,
    graph: NetworkGraphData,
    *,
    query: str,
    carried_summary: str | None = None,
) -> AnswerSpec:
    orient = assemble_j1t1_spec(stats)
    node_count = len(graph.nodes)
    edge_count = len(graph.edges)

    verdict_sentence = (
        f"The rail decarb slice connects across {node_count} entities "
        f"and {edge_count} relationships — density selects the honest map shape."
    )
    if graph.ladder_rung == "typed-inventory":
        verdict_sentence = (
            "The network is too sparse to draw a force graph honestly — "
            "typed inventory instead of fabricated edges."
        )

    spec = orient.model_copy(
        update={
            "mode": "Connect",
            "scope": f"CORPUS · {node_count} NODES · {edge_count} EDGES · CONNECT",
            "tier": "Indicative" if edge_count < 4 else "Supported",
            "tierCapReason": f"NetworkMap ladder rung {graph.ladder_rung}; corpus-only edges",
            "verdict": {
                "sentence": verdict_sentence,
                "tail": (
                    "Mode bridges and org↔funder links are corpus-grounded. "
                    "Web actor consortia remain a GATE 3+ dual-lane extension."
                ),
            },
            "instrument": {
                "recipe": "NetworkMap",
                "data": {
                    "nodes": graph.nodes,
                    "edges": graph.edges,
                    "ladderRung": graph.ladder_rung,
                    "edgeDensity": graph.edge_density,
                    "layout": "none",
                },
                "honesty": {
                    "toScale": graph.ladder_rung == "force-graph",
                    "label": (
                        "layout:none · fixed coords"
                        if graph.ladder_rung != "typed-inventory"
                        else "typed inventory — edges too sparse to draw"
                    ),
                },
            },
            "carriedFrom": {
                "turn": 1,
                "of": 4,
                "summary": carried_summary
                or f"Orient: {stats.project_count} projects · £ floor from live aggregate",
                "fromTurns": [1],
                "evolvedFields": ["instrument", "verdict"],
            },
            "soWhat": {
                "lookingAt": (
                    f"A {graph.ladder_rung} view of how rail decarb connects — "
                    f"{edge_count} edges across {node_count} nodes."
                ),
                "oneDecision": (
                    "Which relationship matters for your play — mode bridge, funder monopoly, or org concentration?"
                ),
                "gate": "Verify bridge edges against corpus row IDs before acting on sparse links.",
                "primaryAction": "Diagnose gap → deepen web pass for actor consortia",
                "turn": "2 / 4",
            },
            "reconciliation": {
                "notes": [],
                "retrieval": {
                    "lane_mode": "corpus_only",
                    "corpus_count": graph.corpus_count,
                    "external_count": 0,
                    "candidate_count": 0,
                    "conflict_count": 0,
                    "errors": [],
                    "external_skipped": True,
                    "corpus_thin": edge_count < 2,
                },
            },
            "query": query,
        }
    )
    return AnswerSpec.model_validate(spec.model_dump(mode="json"))


def build_connect_spec_from_corpus(query: str) -> AnswerSpec:
    stats = fetch_j1t1_corpus_stats()
    graph = fetch_connect_network_graph()
    summary = f"Orient: {stats.project_count} projects, {stats.funding_sum:,.0f} floor"
    return assemble_connect_spec(stats, graph, query=query, carried_summary=summary)
