"""Act / practitioner turn — user's situation + corpus + web candidates."""

from __future__ import annotations

from typing import Any

from agents.atlas_v5.j1t1_assembler import assemble_j1t1_spec
from agents.atlas_v5.j1t1_types import J1T1CorpusStats
from agents.atlas_v5.wide_pass import WidePassResult
from agents.contracts.answer_spec import AnswerSpec


def _build_opportunity_items(wide: WidePassResult) -> list[dict[str, Any]]:
    items: list[dict[str, Any]] = []
    seen: set[str] = set()

    for c in wide.candidates[:5]:
        title = (c.get("title") or "").strip()
        key = title.lower()
        if not title or key in seen:
            continue
        seen.add(key)
        items.append(
            {
                "title": title[:120],
                "source": "web",
                "url": c.get("url") or "",
                "publisher": c.get("publisher") or c.get("funder") or "",
                "fitNote": (c.get("snippet") or "")[:160],
            }
        )

    for hit in wide.corpus_hits[:5]:
        title = (hit.get("project_title") or hit.get("title") or "").strip()
        key = title.lower()
        if not title or key in seen:
            continue
        seen.add(key)
        items.append(
            {
                "title": title[:120],
                "source": "corpus",
                "id": hit.get("id"),
                "organisation": hit.get("lead_org_name") or hit.get("organisation") or "",
                "fitNote": "Corpus analogue / partner signal",
            }
        )

    return items[:8]


def assemble_act_spec(
    stats: J1T1CorpusStats,
    wide: WidePassResult,
    *,
    query: str,
) -> AnswerSpec:
    orient = assemble_j1t1_spec(stats)
    items = _build_opportunity_items(wide)
    web_count = sum(1 for i in items if i.get("source") == "web")

    spec = orient.model_copy(
        update={
            "mode": "Act",
            "scope": f"PRACTITIONER · {len(items)} SIGNALS · ACT",
            "tier": "Indicative" if web_count else orient.tier,
            "tierCapReason": (
                f"Act turn blends {len(items)} opportunity signals "
                f"({web_count} web, rest corpus); practitioner context primary"
            ),
            "verdict": {
                "sentence": (
                    "Your move starts from your situation — corpus and live signals "
                    "below are ranked for fit, not landscape completeness."
                ),
                "tail": (
                    f"Query anchor: “{query[:100]}”. "
                    "Web candidates are ingestion flags until verified in atlas.projects."
                ),
            },
            "instrument": {
                "recipe": "OpportunityList",
                "data": {
                    "items": items,
                    "practitionerQuery": query,
                    "sort": "fit_signals",
                },
                "honesty": {
                    "toScale": False,
                    "label": "candidate list — verify before pursuit",
                },
            },
            "carriedFrom": {
                "turn": 1,
                "of": 4,
                "summary": f"From orient slice: {stats.project_count} projects",
                "fromTurns": [1],
                "evolvedFields": ["mode", "instrument", "verdict"],
            },
            "soWhat": {
                "lookingAt": (
                    f"A practitioner pursuit view — {len(items)} ranked signals "
                    "from corpus + web (where enabled)."
                ),
                "oneDecision": "Which signal is your best next conversation — funding call, corpus partner, or analogue project?",
                "gate": "Verify web candidates exist and fit before outreach; corpus IDs must resolve in Supabase.",
                "primaryAction": "Pick one signal → validate → outreach or bid",
                "turn": "2 / 4",
            },
            "query": query,
        }
    )
    return AnswerSpec.model_validate(spec.model_dump(mode="json"))
