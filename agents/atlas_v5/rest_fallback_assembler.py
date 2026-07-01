"""AnswerSpec skeleton when corpus search works over HTTPS but SQL stats are blocked."""

from __future__ import annotations

from typing import Any

from agents.atlas_v5.corpus_evidence import citations_from_hits, corpus_hits_from_wide
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import (
    AnswerSpec,
    CorpusCitation,
    SoWhat,
    Stat,
    Verdict,
    WebEvidence,
)
from agents.orchestrator.retrieval_fabric import EvidenceBag


def _corpus_hits(wide: WidePassResult) -> list[dict[str, Any]]:
    return corpus_hits_from_wide(wide)


def _web_rows(bag: EvidenceBag | None) -> list[WebEvidence]:
    if not bag:
        return []
    out: list[WebEvidence] = []
    for i, item in enumerate((bag.external or [])[:8]):
        out.append(
            WebEvidence(
                id=str(item.get("id") or f"web-{i + 1}"),
                title=str(item.get("title") or "Web source")[:200],
                url=str(item.get("url") or ""),
                publisher=item.get("publisher") or item.get("source"),
                snippet=(item.get("snippet") or "")[:400] or None,
                retrieval_tool=item.get("retrieval_tool") or item.get("tool"),
            )
        )
    return out


def _mode_for_outcome(outcome: str) -> str:
    return {
        "connect": "Connect",
        "diagnose": "Diagnose",
        "act": "Act",
        "defend": "Defend",
        "find_path": "FindPath",
    }.get(outcome, "Orient")


def assemble_rest_fallback_spec(wide: WidePassResult) -> AnswerSpec:
    """Corpus via Supabase REST (443) — no SQL aggregate stats."""
    hits = _corpus_hits(wide)
    bag = wide.evidence_bag
    web = _web_rows(bag)
    citations = citations_from_hits(hits)
    n_proj = len(citations)
    label = wide.object_label or "Your question"
    query = wide.query or label
    mode = _mode_for_outcome(wide.outcome)

    tier = "Indicative" if n_proj >= 3 else "Speculative"
    if web and n_proj >= 2:
        tier = "Indicative"

    stat_rows = [
        Stat(
            value=str(n_proj),
            label="Corpus projects matched (semantic search)",
            provId="rest.project_hits",
            tone="corpus",
        ),
    ]
    if web:
        stat_rows.append(
            Stat(
                value=str(len(web)),
                label="Web sources (parallel lane)",
                provId="web.external_count",
                tone="web",
            )
        )

    verdict = (
        f"Semantic corpus search returned {n_proj} verified project match(es) for {label}. "
        "SQL aggregate stats were unavailable (Postgres pooler blocked) — charts may be limited."
    )
    if wide.outcome == "connect":
        verdict = (
            f"Ecosystem view from {n_proj} corpus project match(es) over HTTPS. "
            "Full network graph needs Postgres — relationship map may be partial."
        )

    web_block = ""
    if web:
        lines = "\n".join(
            f"- [{w.title}]({w.url})" if w.url else f"- {w.title}"
            for w in web[:6]
        )
        web_block = f"\n\n### Web lane ({len(web)} source(s))\n{lines}\n"

    return AnswerSpec(
        object=label,
        scope=f"CORPUS SEMANTIC · {n_proj} VERIFIED · {mode.upper()}",
        mode=mode,
        tier=tier,
        tierCapReason=(
            "Corpus citations from REST search — aggregate SQL stats skipped; "
            "tier capped until pooler reachable"
        ),
        verdict=Verdict(
            sentence=verdict,
            tail="Verified atlas.projects UUIDs when returned by semantic/keyword search.",
        ),
        stats=stat_rows,
        corpus_citations=citations,
        web_evidence=[w.model_dump(mode="json") for w in web],
        instrument=None,
        query=query,
        soWhat=SoWhat(
            lookingAt=f"{mode} · {label}",
            oneDecision=(
                "Use matched projects as evidence anchors — web sources listed on canvas when corpus is thin."
                if web
                else "Use matched projects as evidence anchors — reconnect Postgres for full stats/charts."
            ),
            gate="REST corpus · max Indicative without SQL aggregates",
            primaryAction="Review evidence on canvas",
            turn=f"{mode} · REST fallback",
        ),
        canvas={
            "composition_mode": "free_compose",
            "gate_status": "pass",
            "merged_markup": (
                f"## {label}\n\n"
                f"**Corpus via HTTPS** — Postgres pooler unreachable; "
                f"{n_proj} project(s) retrieved via Supabase REST."
                f"{web_block}\n\n"
                f"_{query}_"
            ),
        },
    )
