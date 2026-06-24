"""Session case file — declared user_situation claims (Increment 0).

In-memory store by default; Supabase `atlas.claims` when ATLAS_V5_CASEFILE_PERSIST=1.
"""

from __future__ import annotations

import logging
import os
import re
import uuid
from dataclasses import dataclass, field
from typing import Literal

from agents.contracts.answer_spec import Claim, ConfidenceTier

logger = logging.getLogger(__name__)

CaseClaimKind = Literal["fact", "domain", "constraint", "hypothesis", "uncertainty"]

ENTITY_TYPE = "user_situation"
SOURCE_DECLARED = "declared"

_MEMORY: dict[str, list["CaseClaim"]] = {}

_UNCERTAINTY_RE = re.compile(
    r"\b("
    r"not\s+sure\s+what\s+i'?m\s+asking|"
    r"don'?t\s+know\s+what\s+i'?m\s+asking|"
    r"don'?t\s+know\s+where\s+to\s+start|"
    r"help\s+me\s+figure\s+out|"
    r"half.?formed|"
    r"working\s+through"
    r")\b",
    re.I,
)

_HYPOTHESIS_RE = re.compile(
    r"\b(might|may|could|think|hope|believe|probably)\b.*\b(fund|innovate|partner|grant)\b",
    re.I,
)

_CONSTRAINT_RE = re.compile(
    r"\b(no\s+trial\s+partner|without\s+a\s+partner|can'?t\s+find|lack\s+of|no\s+budget)\b",
    re.I,
)


def casefile_persist_enabled() -> bool:
    return os.getenv("ATLAS_V5_CASEFILE_PERSIST", "0").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def default_thread_id(thread_id: str | None) -> str:
    return (thread_id or "").strip() or "default-session"


@dataclass
class CaseClaim:
    id: str
    text: str
    kind: CaseClaimKind
    confidence_tier: str = "self_reported"
    claim_role: str = "asserts"
    source: str = SOURCE_DECLARED

    def to_db_row(self, thread_id: str) -> dict:
        return {
            "id": self.id,
            "claim_text": self.text[:2000],
            "claim_subtype": self.kind,
            "claim_role": self.claim_role,
            "confidence_tier": self.confidence_tier,
            "confidence_reason": f"declared:{self.kind}",
            "entity_type": ENTITY_TYPE,
            "entity_id": thread_id,
            "source": SOURCE_DECLARED,
            "source_label": "user_situation",
            "review_status": "pending",
            "corpus_tag": "atlas_v5_session",
        }

    @classmethod
    def from_db_row(cls, row: dict) -> CaseClaim:
        return cls(
            id=str(row["id"]),
            text=str(row.get("claim_text") or ""),
            kind=_normalize_kind(row.get("claim_subtype")),
            confidence_tier=str(row.get("confidence_tier") or "self_reported"),
            claim_role=str(row.get("claim_role") or "asserts"),
            source=str(row.get("source") or SOURCE_DECLARED),
        )


def _normalize_kind(raw: str | None) -> CaseClaimKind:
    key = (raw or "fact").strip().lower()
    if key in ("fact", "domain", "constraint", "hypothesis", "uncertainty"):
        return key  # type: ignore[return-value]
    return "fact"


def _confidence_for_kind(kind: CaseClaimKind) -> str:
    if kind == "hypothesis":
        return "ai_inferred"
    return "self_reported"


def _answer_tier_for_kind(kind: CaseClaimKind) -> ConfidenceTier:
    if kind == "hypothesis":
        return "Speculative"
    return "Indicative"


def load_case_file(thread_id: str | None) -> list[CaseClaim]:
    tid = default_thread_id(thread_id)
    if tid in _MEMORY:
        return list(_MEMORY[tid])
    if casefile_persist_enabled():
        try:
            rows = _load_from_db(tid)
            _MEMORY[tid] = rows
            return list(rows)
        except Exception as exc:
            logger.warning("case file DB load failed: %s", exc)
    return []


def save_case_file(thread_id: str | None, claims: list[CaseClaim]) -> None:
    tid = default_thread_id(thread_id)
    _MEMORY[tid] = list(claims)
    if casefile_persist_enabled():
        try:
            _save_to_db(tid, claims)
        except Exception as exc:
            logger.warning("case file DB save failed: %s", exc)


def merge_case_claims(
    prior: list[CaseClaim],
    updates: list[CaseClaim],
) -> list[CaseClaim]:
    """Model write-back: replace by id where present, append new ids."""
    by_id = {c.id: c for c in prior}
    for item in updates:
        cid = item.id or str(uuid.uuid4())
        by_id[cid] = CaseClaim(
            id=cid,
            text=item.text.strip(),
            kind=item.kind,
            confidence_tier=_confidence_for_kind(item.kind),
            source=SOURCE_DECLARED,
        )
    return list(by_id.values())[:12]


def bootstrap_declared_claims_heuristic(query: str) -> list[CaseClaim]:
    """No-LLM fallback — minimal declared rows from utterance."""
    q = query.strip()
    if not q or len(q.split()) < 4:
        return []
    out: list[CaseClaim] = []
    if _UNCERTAINTY_RE.search(q):
        out.append(
            CaseClaim(
                id=str(uuid.uuid4()),
                text=q[:400],
                kind="uncertainty",
            )
        )
    if _CONSTRAINT_RE.search(q):
        out.append(
            CaseClaim(
                id=str(uuid.uuid4()),
                text=_CONSTRAINT_RE.search(q).group(0)[:200],  # type: ignore[union-attr]
                kind="constraint",
            )
        )
    if _HYPOTHESIS_RE.search(q):
        out.append(
            CaseClaim(
                id=str(uuid.uuid4()),
                text=q[:240],
                kind="hypothesis",
                confidence_tier="ai_inferred",
            )
        )
    return out[:6]


def case_claims_from_model_items(items: list[dict]) -> list[CaseClaim]:
    out: list[CaseClaim] = []
    for raw in items:
        text = str(raw.get("text") or "").strip()
        if not text:
            continue
        kind = _normalize_kind(raw.get("kind"))
        cid = str(raw.get("id") or uuid.uuid4())
        out.append(
            CaseClaim(
                id=cid,
                text=text,
                kind=kind,
                confidence_tier=_confidence_for_kind(kind),
            )
        )
    return out


def to_answer_spec_claims(claims: list[CaseClaim]) -> list[Claim]:
    spec_claims: list[Claim] = []
    for c in claims:
        spec_claims.append(
            Claim(
                id=c.id,
                text=c.text,
                source="declared",
                trust="declared",
                tier=_answer_tier_for_kind(c.kind),
                caveat=f"Stated by user · {c.kind} · max Indicative",
                provId=f"declared-{c.id[:8]}",
            )
        )
    return spec_claims


def prepend_declared_markup(markup: str | None, claims: list[CaseClaim]) -> str | None:
    if not markup or not claims:
        return markup
    return declared_markup_block(claims) + markup


def declared_markup_block(claims: list[CaseClaim]) -> str:
    if not claims:
        return ""
    items = "".join(
        f'<li data-material="declared" data-claim-id="{c.id}" '
        f'data-claim-kind="{c.kind}">{_esc(c.text)}</li>'
        for c in claims[:6]
    )
    return (
        f'<section data-testid="declared-situation" data-material="declared" '
        f'style="margin-bottom:16px;padding:12px;border:1px dashed #B8860B;'
        f'border-radius:8px;background:#FBF8F0">'
        f'<div style="font-family:ui-monospace,monospace;font-size:10px;'
        f'letter-spacing:0.08em;color:#8B6914;margin-bottom:8px">'
        f"STATED BY USER · DECLARED · MAX INDICATIVE</div>"
        f"<ul style=\"margin:0;padding-left:16px;font-size:12.5px;"
        f'line-height:1.45;color:#2E2A24">{items}</ul></section>'
    )


def _esc(text: str) -> str:
    return (
        text.replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace('"', "&quot;")
    )


def _load_from_db(thread_id: str) -> list[CaseClaim]:
    from mcps.cpc_corpus.queries import _pg_query

    rows = _pg_query(
        """
        SELECT id, claim_text, claim_subtype, claim_role, confidence_tier, source
        FROM atlas.claims
        WHERE entity_type = %s AND entity_id = %s AND source = %s
        ORDER BY created_at ASC
        LIMIT 20
        """,
        (ENTITY_TYPE, thread_id, SOURCE_DECLARED),
    )
    return [CaseClaim.from_db_row(r) for r in rows]


def _save_to_db(thread_id: str, claims: list[CaseClaim]) -> None:
    import psycopg2

    from mcps.cpc_corpus.queries import _conn

    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                """
                DELETE FROM atlas.claims
                WHERE entity_type = %s AND entity_id = %s AND source = %s
                """,
                (ENTITY_TYPE, thread_id, SOURCE_DECLARED),
            )
            for claim in claims:
                row = claim.to_db_row(thread_id)
                cur.execute(
                    """
                    INSERT INTO atlas.claims (
                      id, claim_text, claim_subtype, claim_role, confidence_tier,
                      confidence_reason, entity_type, entity_id, source, source_label,
                      review_status, corpus_tag
                    ) VALUES (
                      %s::uuid, %s, %s, %s, %s,
                      %s, %s, %s, %s, %s,
                      %s, %s
                    )
                    """,
                    (
                        row["id"],
                        row["claim_text"],
                        row["claim_subtype"],
                        row["claim_role"],
                        row["confidence_tier"],
                        row["confidence_reason"],
                        row["entity_type"],
                        row["entity_id"],
                        row["source"],
                        row["source_label"],
                        row["review_status"],
                        row["corpus_tag"],
                    ),
                )
        conn.commit()
    finally:
        conn.close()
