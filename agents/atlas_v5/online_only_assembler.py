"""Minimal AnswerSpec skeleton for online-only turns (no corpus stats)."""

from __future__ import annotations

from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import AnswerSpec, WebEvidence
from agents.orchestrator.retrieval_fabric import EvidenceBag


def _web_rows(bag: EvidenceBag | None) -> list[WebEvidence]:
    if not bag:
        return []
    out: list[WebEvidence] = []
    for i, item in enumerate((bag.external or bag.candidates or [])[:8]):
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


def assemble_online_only_spec(wide: WidePassResult) -> AnswerSpec:
    bag = wide.evidence_bag
    web = _web_rows(bag)
    ext_n = len(web)
    label = wide.object_label or "Your question"
    query = wide.query or label

    return AnswerSpec.model_validate(
        {
            "specVersion": "0.2.1",
            "object": label,
            "scope": f"ONLINE ONLY · {ext_n} WEB SOURCE(S) · ORIENT",
            "mode": "Orient",
            "tier": "Indicative" if ext_n >= 2 else "Speculative",
            "tierCapReason": (
                "Corpus database unreachable — web candidates only; no atlas.projects UUIDs"
            ),
            "verdict": {
                "sentence": (
                    f"Online-only mode — corpus unavailable; answering from web lane for {label}."
                ),
                "tail": (
                    "Treat sources as candidates until corpus connectivity returns. "
                    "No verified CPC project citations on this turn."
                ),
            },
            "stats": [],
            "blindspot": {
                "sign": "absence",
                "gap": "CPC corpus not queried — Postgres/Supabase unreachable.",
                "closable": "Restore corpus connection or ingest relevant projects.",
                "secondary": f"{ext_n} web source(s) retrieved for this turn.",
            },
            "instrument": None,
            "claims": [],
            "corpus_citations": [],
            "hive_citations": [],
            "web_evidence": [w.model_dump(mode="json") for w in web],
            "provenance": {
                "online-only": {
                    "ref": "web lane · Exa/GovUK",
                    "scope": query[:120],
                    "trust": "web",
                    "trustNote": "Online-only mode — corpus bypassed",
                    "row": f"{ext_n} sources",
                },
            },
            "reconciliation": {
                "notes": [],
                "retrieval": {
                    "lane_mode": "external_primary",
                    "corpus_count": 0,
                    "external_count": ext_n,
                    "candidate_count": len(bag.candidates) if bag else 0,
                    "conflict_count": 0,
                    "errors": bag.errors if bag else ["corpus_unavailable"],
                    "external_skipped": False,
                    "corpus_thin": True,
                },
            },
            "soWhat": {
                "lookingAt": f"Web-only synthesis for: {query[:100]}",
                "oneDecision": "Verify key claims against primary sources before committing.",
                "gate": "Reconnect corpus for CPC-backed citations when available.",
                "primaryAction": "Review web sources listed below",
                "turn": "1 / 4",
            },
            "query": query,
            "canvas": {
                "composition_mode": "free_compose",
                "markup": (
                    f"## {label}\n\n"
                    "**Online-only mode** — the CPC corpus could not be reached. "
                    "This canvas is composed from web retrieval and model synthesis only.\n\n"
                    f"_{query}_"
                ),
            },
        }
    )
