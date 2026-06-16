"""
Passport loader — query-time passport construction for Diagnose mode (Decision 2).

Loads structured entity context from atlas.passports when a query matches,
or returns None for transient inference-only runs.
"""
from __future__ import annotations

import re
from typing import Any, Optional

from mcps.cpc_corpus.queries import _query


def _normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text.lower().strip())


def load_passport_for_query(query: str, limit: int = 1) -> Optional[dict[str, Any]]:
    """
    Match query text to atlas.passports by title / project_name / tags.
    Returns passport row + claims summary, or None if no confident match.
    """
    q = _normalise(query)
    if any(k in q for k in ("cpc", "catapult", "connected places", "good at", "swot")):
        try:
            from agents.cpc_passport.loader import load_cpc_passport_for_query

            return load_cpc_passport_for_query(query)
        except Exception:
            pass

    if len(q) < 8:
        return None

    # Extract likely entity tokens (long words, skip stopwords)
    stop = frozenset({
        "what", "which", "where", "when", "does", "have", "that", "this",
        "with", "from", "about", "evidence", "blocks", "gaps", "diagnose",
        "assess", "build", "case", "five", "green", "book",
    })
    tokens = [
        w for w in re.findall(r"[a-z0-9]{4,}", q)
        if w not in stop
    ][:6]
    if not tokens:
        return None

    pattern = "%" + "%".join(tokens[:3]) + "%"
    rows = _query(
        """
        SELECT p.id, p.title, p.project_name, p.project_description, p.summary,
               p.owner_org, p.trl_level, p.sector_origin, p.sector_target, p.tags
        FROM atlas.passports p
        WHERE COALESCE(p.is_archived, false) = false
          AND (
            lower(p.title) LIKE lower(%s)
            OR lower(p.project_name) LIKE lower(%s)
            OR lower(coalesce(p.summary, '')) LIKE lower(%s)
          )
        ORDER BY p.updated_at DESC
        LIMIT %s
        """,
        (pattern, pattern, pattern, min(int(limit), 3)),
    )
    if not rows:
        return None

    passport = rows[0]
    pid = str(passport["id"])
    claims = _query(
        """
        SELECT claim_domain, claim_text, confidence_tier, claim_role
        FROM atlas.passport_claims
        WHERE passport_id = %s::uuid AND rejected IS NOT TRUE
        ORDER BY confidence_tier DESC, claim_domain
        LIMIT 20
        """,
        (pid,),
    )

    return {
        "passport_id": pid,
        "title": passport.get("title") or passport.get("project_name"),
        "project_name": passport.get("project_name"),
        "owner_org": passport.get("owner_org"),
        "trl_level": passport.get("trl_level"),
        "sector_origin": passport.get("sector_origin"),
        "sector_target": passport.get("sector_target"),
        "summary": (passport.get("summary") or passport.get("project_description") or "")[:800],
        "claims": [
            {
                "domain": c.get("claim_domain"),
                "text": (c.get("claim_text") or "")[:200],
                "confidence_tier": c.get("confidence_tier"),
                "role": c.get("claim_role"),
            }
            for c in claims
        ],
    }
