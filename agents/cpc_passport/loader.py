"""
Load the canonical Connected Places Catapult capability passport from Supabase.

Single passport row (scope-filtered by mode_or_focus_area), not per-sector splits.
"""
from __future__ import annotations

import re
from typing import Any

from mcps.cpc_corpus.queries import _query

# Canonical CPC capability passport — Connected Places Catapult
CPC_PASSPORT_ID = "67e68525-1da0-4301-8853-04d401107594"
CPC_CAPABILITY_CONTAINER_ID = "3ba1e158-ed57-41a6-9753-c5b550da8332"
CORPUS_TAG = "cpc_v0_1"

# User language → atlas.evidence_containers.mode_or_focus_area
SCOPE_ALIASES: dict[str, str] = {
    "rail": "Rail",
    "highways": "Highways & Integrated Transport",
    "highway": "Highways & Integrated Transport",
    "integrated transport": "Highways & Integrated Transport",
    "aviation": "Aviation & Maritime",
    "maritime": "Aviation & Maritime",
    "aviation & maritime": "Aviation & Maritime",
    "local growth": "Regional & Local Growth",
    "regional": "Regional & Local Growth",
    "international": "International & Trade",
    "trade": "International & Trade",
    "smcp": "SMCP",
    "smart mobility": "SMCP",
    "built environment": "Built Environment & Urbanism",
    "urbanism": "Built Environment & Urbanism",
    "data": "Data & Digital Products",
    "digital": "Data & Digital Products",
    "enterprise": "Enterprise Innovation",
}

_REMOVE_MODE_PREFIX = "(Remove)"


def resolve_scope_from_query(query: str) -> str | None:
    """Best-effort sector scope from user text."""
    q = query.lower()
    # Explicit "in rail" / "for highways"
    for alias, mode in sorted(SCOPE_ALIASES.items(), key=lambda x: -len(x[0])):
        if alias in q:
            return mode
    m = re.search(r"\b(?:in|for|on)\s+([\w\s&]+?)(?:\?|$|,|\band\b)", q, re.I)
    if m:
        fragment = m.group(1).strip().lower()
        for alias, mode in SCOPE_ALIASES.items():
            if alias in fragment or fragment in alias:
                return mode
    return None


def _tier_rank(tier: str | None) -> int:
    return {"Robust": 4, "Supported": 3, "Indicative": 2, "self_reported": 1, "Speculative": 0}.get(
        tier or "", 0
    )


def _map_claim_state(row: dict[str, Any]) -> str:
    review = (row.get("review_status") or "").lower()
    if review == "verified":
        return "stated"
    if row.get("conflict_flag"):
        return "contested"
    if review == "rejected":
        return "contested"
    if review in ("pending", ""):
        reason = row.get("confidence_reason") or ""
        if "inferred" in reason.lower() or "derived" in reason.lower():
            return "inferred"
        if row.get("confidence_tier") == "self_reported":
            return "stated"
        return "inferred"
    return "stated"


def _execute_write(sql: str, params: tuple = ()) -> int:
    """Mutations for match sync — not via read-only MCP query layer."""
    import psycopg2

    from mcps.cpc_corpus.queries import _conn

    conn = _conn()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            conn.commit()
            return cur.rowcount
    finally:
        conn.close()


def _load_passport_row() -> dict[str, Any] | None:
    rows = _query(
        """
        SELECT id, passport_type, title, owner_org, owner_name, summary, context,
               sector_origin, sector_target, domain, corpus_id
        FROM atlas.passports
        WHERE id = %s::uuid AND COALESCE(is_archived, false) = false
        """,
        (CPC_PASSPORT_ID,),
    )
    return rows[0] if rows else None


def _load_atomic_claims(scope: str | None, limit: int = 40) -> list[dict[str, Any]]:
    """Claims from atlas.claims linked to CPC capability container."""
    rows = _query(
        """
        SELECT c.id, c.claim_role, c.claim_domain, c.claim_text, c.claim_level,
               c.confidence_tier, c.confidence_reason, c.review_status,
               c.source_label, c.source_excerpt, c.claim_subtype
        FROM atlas.claims c
        INNER JOIN atlas.profile_claims pc ON pc.claim_id = c.id
        INNER JOIN atlas.evidence_containers ec ON ec.id = pc.container_id
        WHERE ec.corpus_tag = %s
          AND (ec.container_type = 'capability_profile'
               OR ec.id = %s::uuid)
        ORDER BY c.claim_level DESC NULLS LAST, c.created_at DESC
        LIMIT %s
        """,
        (CORPUS_TAG, CPC_CAPABILITY_CONTAINER_ID, limit),
    )
    claims: list[dict[str, Any]] = []
    for r in rows or []:
        domain = r.get("claim_domain") or "general"
        if scope and scope.lower() not in domain.lower() and domain not in ("financial", "evidence", "general"):
            # Keep cross-cutting claims; skip unrelated technical domains when scoped
            if not any(scope.lower() in (r.get("claim_text") or "").lower() for _ in [1]):
                continue
        claims.append({
            "id": str(r["id"]),
            "domain": domain,
            "text": r.get("claim_text") or "",
            "confidence_tier": _normalize_tier(r.get("confidence_tier")),
            "role": r.get("claim_role") or "asserts",
            "claim_state": _map_claim_state(r),
            "source": r.get("source_label") or "cpc_v0_1",
            "subtype": r.get("claim_subtype"),
        })
    return claims


def _normalize_tier(tier: str | None) -> str:
    if not tier:
        return "Indicative"
    if tier == "self_reported":
        return "Indicative"
    if tier in ("Robust", "Supported", "Indicative", "Speculative"):
        return tier
    return "Indicative"


def _load_derived_claims(scope: str | None) -> list[dict[str, Any]]:
    """Aggregate claims from evidence_containers — clearly labelled inferred."""
    params: list[Any] = [CORPUS_TAG]
    scope_clause = ""
    if scope:
        scope_clause = " AND ec.mode_or_focus_area = %s"
        params.append(scope)

    stats = _query(
        f"""
        SELECT ec.mode_or_focus_area,
               COUNT(*) AS project_count,
               COUNT(DISTINCT ec.customer_or_funder) AS funder_count,
               SUM(COALESCE(ec.budget_gbp, 0)) AS total_budget
        FROM atlas.evidence_containers ec
        WHERE ec.corpus_tag = %s
          AND COALESCE(ec.mode_or_focus_area, '') NOT LIKE %s
          {scope_clause}
        GROUP BY ec.mode_or_focus_area
        ORDER BY project_count DESC
        LIMIT 8
        """,
        tuple([CORPUS_TAG, f"{_REMOVE_MODE_PREFIX}%"] + ([scope] if scope else [])),
    )

    derived: list[dict[str, Any]] = []
    for row in stats or []:
        mode = row.get("mode_or_focus_area") or "All sectors"
        n = int(row.get("project_count") or 0)
        budget = float(row.get("total_budget") or 0)
        budget_str = f"£{budget:,.0f} recorded baseline revenue" if budget else "budget not fully mapped"
        derived.append({
            "id": f"derived-{mode.replace(' ', '-').lower()}",
            "domain": mode,
            "text": (
                f"CPC has {n} documented projects in {mode} "
                f"({budget_str}) in the CPC Capability Corpus."
            ),
            "confidence_tier": "Supported" if n >= 10 else "Indicative",
            "role": "asserts",
            "claim_state": "inferred",
            "source": "atlas.evidence_containers aggregate",
        })

    if scope:
        customers = _query(
            """
            SELECT DISTINCT ec.customer_or_funder
            FROM atlas.evidence_containers ec
            WHERE ec.corpus_tag = %s
              AND ec.mode_or_focus_area = %s
              AND ec.customer_or_funder IS NOT NULL
            ORDER BY ec.customer_or_funder
            LIMIT 12
            """,
            (CORPUS_TAG, scope),
        )
        names = [c["customer_or_funder"] for c in (customers or []) if c.get("customer_or_funder")]
        if names:
            derived.append({
                "id": f"derived-customers-{scope.replace(' ', '-').lower()}",
                "domain": scope,
                "text": f"Key CPC customers/funders in {scope}: {', '.join(names[:8])}.",
                "confidence_tier": "Supported",
                "role": "asserts",
                "claim_state": "stated",
                "source": "atlas.evidence_containers",
            })

    return derived


def load_cpc_passport(scope: str | None = None) -> dict[str, Any]:
    """
    Load full CPC passport dict for orchestrator / matcher.

    scope: mode_or_focus_area filter (e.g. 'Rail') or None for org-wide view.
    """
    row = _load_passport_row()
    if not row:
        return {"passport_id": None, "title": "CPC", "claims": [], "error": "passport row missing"}

    atomic = _load_atomic_claims(scope)
    derived = _load_derived_claims(scope)
    claims = derived + atomic

    summary = row.get("summary") or row.get("context") or ""
    if scope:
        summary = f"{summary} Scope: {scope}.".strip()

    return {
        "passport_id": str(row["id"]),
        "passport_type": row.get("passport_type"),
        "title": row.get("title"),
        "owner_org": row.get("owner_org") or "Connected Places Catapult",
        "owner_name": row.get("owner_name"),
        "sector_origin": row.get("sector_origin") or [],
        "sector_target": row.get("sector_target") or [],
        "domain": row.get("domain"),
        "corpus_id": row.get("corpus_id") or CORPUS_TAG,
        "scope": scope,
        "summary": summary[:1200],
        "claims": claims,
        "claim_count": len(claims),
        "project_evidence_count": _project_count(scope),
    }


def _project_count(scope: str | None) -> int:
    if scope:
        rows = _query(
            """
            SELECT COUNT(*) AS n FROM atlas.evidence_containers
            WHERE corpus_tag = %s AND mode_or_focus_area = %s
              AND COALESCE(mode_or_focus_area, '') NOT LIKE %s
            """,
            (CORPUS_TAG, scope, f"{_REMOVE_MODE_PREFIX}%"),
        )
    else:
        rows = _query(
            """
            SELECT COUNT(*) AS n FROM atlas.evidence_containers
            WHERE corpus_tag = %s
              AND COALESCE(mode_or_focus_area, '') NOT LIKE %s
            """,
            (CORPUS_TAG, f"{_REMOVE_MODE_PREFIX}%"),
        )
    return int(rows[0]["n"]) if rows else 0


def load_cpc_passport_for_query(query: str) -> dict[str, Any]:
    """Resolve scope from query text then load passport."""
    scope = resolve_scope_from_query(query)
    # Default CPC queries to org-wide if no sector mentioned but CPC referenced
    q = query.lower()
    if scope is None and any(k in q for k in ("cpc", "catapult", "connected places")):
        scope = None
    return load_cpc_passport(scope)


def sync_cpc_live_call_matches(*, limit: int = 25, scope: str | None = None) -> int:
    """
    Compute top live_call matches for CPC passport and upsert atlas.matches.
    Returns number of rows written.
    """
    import json
    from datetime import datetime, timezone

    passport = load_cpc_passport(scope)
    summary = passport.get("summary") or ""
    claim_text = " ".join(c.get("text", "")[:120] for c in passport.get("claims", [])[:10])

    # Vector search live calls via embedding text composite
    search_text = f"Connected Places Catapult capability {scope or ''} {claim_text[:500]}"
    try:
        from mcps.cpc_corpus import queries as cq

        calls = cq.search_live_calls(search_text, limit=limit) if hasattr(cq, "search_live_calls") else []
    except Exception:
        calls = []

    if not calls:
        calls = _query(
            """
            SELECT id, title, funder, description, tags
            FROM atlas.live_calls
            WHERE status = 'open' OR status IS NULL
            ORDER BY scraped_at DESC NULLS LAST
            LIMIT %s
            """,
            (limit,),
        )

    _execute_write(
        "DELETE FROM atlas.matches WHERE passport_id = %s::uuid AND match_type = 'live_call'",
        (CPC_PASSPORT_ID,),
    )

    written = 0
    for i, call in enumerate(calls or []):
        call_id = call.get("id")
        if not call_id:
            continue
        score = float(call.get("similarity") or call.get("score") or max(0.35, 0.5 - i * 0.01))
        match_summary = call.get("match_summary") or (
            f"Opportunity route for CPC ({scope or 'all sectors'}): "
            f"{call.get('title', 'Live call')[:120]}"
        )
        _execute_write(
            """
            INSERT INTO atlas.matches (
                passport_id, live_call_id, match_score, match_summary,
                match_type, created_at
            )
            VALUES (%s::uuid, %s::uuid, %s, %s, 'live_call', %s)
            """,
            (
                CPC_PASSPORT_ID,
                str(call_id),
                score,
                match_summary,
                datetime.now(timezone.utc),
            ),
        )
        written += 1
    return written


def load_cpc_top_opportunities(scope: str | None = None, limit: int = 5) -> list[dict[str, Any]]:
    """Load precomputed or fresh top matches for Connect outcome."""
    rows = _query(
        """
        SELECT m.id, m.match_score, m.match_summary, m.gaps,
               lc.id AS live_call_id, lc.title, lc.funder, lc.deadline, lc.description
        FROM atlas.matches m
        LEFT JOIN atlas.live_calls lc ON lc.id = m.live_call_id
        WHERE m.passport_id = %s::uuid
        ORDER BY m.match_score DESC NULLS LAST
        LIMIT %s
        """,
        (CPC_PASSPORT_ID, limit),
    )
    if rows:
        return [
            {
                "match_id": str(r["id"]),
                "live_call_id": str(r.get("live_call_id") or ""),
                "title": r.get("title") or "Opportunity",
                "funder": r.get("funder") or "",
                "score": float(r.get("match_score") or 0),
                "summary": r.get("match_summary") or "",
                "description": (r.get("description") or "")[:300],
            }
            for r in rows
        ]

    sync_cpc_live_call_matches(limit=limit, scope=scope)
    return load_cpc_top_opportunities(scope=scope, limit=limit)
