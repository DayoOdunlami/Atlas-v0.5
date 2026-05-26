#!/usr/bin/env python3
"""
Atlas 5 — Tier 2 value evaluation generator.

Runs three sample queries against the live Atlas 5 agents, self-scores
each response against the rubric using claude-sonnet-4-6 as judge, and
writes tier2_output.md.

Run: python eval/tier2_generator.py
Or:  npm run eval:tier2

Pass condition: rubric total >= 45/75 across all three samples.
               Each criterion must score >= 2.
"""

from __future__ import annotations

import io
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

# Force UTF-8 stdout/stderr on Windows (cp1252 cannot encode ✓/✗/⊘)
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

# Ensure repo root on sys.path so dotenv can be loaded
_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

try:
    from dotenv import load_dotenv
    load_dotenv(_root / ".env.local")
    load_dotenv(_root / ".env")
except ImportError:
    pass

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

AGENT_BASE_URL = os.environ.get("PYTHON_AGENTS_URL", "http://localhost:8000")
ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")
JUDGE_MODEL = "claude-sonnet-4-6"

RUBRIC_CRITERIA = [
    "Addresses the question",
    "Citations used in context",
    "Confidence tier justified",
    "No unsupported quantities",
    "Sections not generic filler",
]

SAMPLE_QUERIES = [
    {
        "label": "ATLAS brief — rail decarbonisation",
        "agent": "atlas",
        "query": "Build a business case for a £2m rail decarbonisation demonstrator",
    },
    {
        "label": "JARVIS evidence — maritime autonomy",
        "agent": "jarvis",
        "query": "Maritime autonomy funding 2023-2024",
    },
    {
        "label": "ATLAS brief — EV charging infrastructure",
        "agent": "atlas",
        "query": "Business case for a £5m EV charging infrastructure programme in rural areas",
    },
]

MIN_TOTAL_SCORE = 45  # out of 75
MIN_CRITERION_SCORE = 2  # each criterion must score >= 2

# ---------------------------------------------------------------------------
# Golden-prompt eval configuration
# ---------------------------------------------------------------------------

#: Pass threshold: at least this many graders must pass (skipped graders
#  are excluded from the denominator, so 4/5 → 4/4 if one is skipped).
GOLDEN_PASS_THRESHOLD = 4

GOLDEN_QUERIES = [
    {
        "label": "ATLAS golden — A14 autonomous freight business case",
        "agent": "atlas",
        "query": (
            "What evidence does CPC have for autonomous freight corridors, "
            "and build a business case for a £3m demonstrator on the A14 corridor"
        ),
        # G1: expected recipe name and Five Case Model section keys
        "expected_recipe": "brief_five_case",
        "expected_five_case_keys": [
            "Strategic Case",
            "Economic Case",
            "Commercial Case",
            "Financial Case",
            "Management Case",
        ],
        # G2: required fields in decision_spine
        "expected_decision_spine_fields": [
            "decision",
            "recommendation",
            "confidence_tier",
            "key_assumption",
            "next_action",
        ],
    }
]

# ---------------------------------------------------------------------------
# HTTP helpers
# ---------------------------------------------------------------------------


def post_agent(agent: str, query: str) -> dict:
    """POST query to the live FastAPI agent endpoint. Returns the response dict."""
    try:
        import urllib.request
        import urllib.error

        url = f"{AGENT_BASE_URL}/agents/{agent}"
        payload = json.dumps({"query": query, "context_packet": {}}).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=payload,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=240) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"error": str(e)}


def check_health() -> bool:
    """Check if the agent service is running."""
    try:
        import urllib.request
        url = f"{AGENT_BASE_URL}/health"
        with urllib.request.urlopen(url, timeout=5) as resp:
            data = json.loads(resp.read())
            return data.get("status") == "ok"
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Judge scoring
# ---------------------------------------------------------------------------


def score_with_claude(query: str, agent: str, response: dict) -> dict[str, int]:
    """
    Use claude-sonnet-4-6 to score the agent response against the rubric.
    Returns a dict mapping criterion name → score (0-5).
    """
    if not ANTHROPIC_API_KEY:
        print("  WARNING: ANTHROPIC_API_KEY not set — using heuristic scoring")
        return heuristic_score(response)

    try:
        import anthropic

        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)

        response_text = json.dumps(response, indent=2)
        prompt = f"""You are a rigorous evaluator of AI agent responses for a UK government innovation intelligence platform.

Score the following agent response against each criterion on a scale of 0-5:
  0 = completely absent or actively harmful
  1 = very weak attempt, mostly missing
  2 = partial — requirement partially met
  3 = adequate — requirement met but not strongly
  4 = good — clear, confident fulfilment
  5 = excellent — exemplary

AGENT: {agent.upper()}
QUERY: {query}

RESPONSE:
{response_text}

CRITERIA TO SCORE:
1. Addresses the question — Does the response directly address what was asked?
2. Citations used in context — Are corpus citations specific and relevant (not generic)?
3. Confidence tier justified — Is the confidence_tier appropriate given the evidence quality?
4. No unsupported quantities — Are all numbers/figures grounded or flagged as estimates?
5. Sections not generic filler — Do all content sections contain substantive, specific content?

Respond ONLY with a JSON object like this (no explanation, no markdown):
{{"Addresses the question": 3, "Citations used in context": 2, "Confidence tier justified": 4, "No unsupported quantities": 3, "Sections not generic filler": 2}}"""

        message = client.messages.create(
            model=JUDGE_MODEL,
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )
        content = message.content[0].text.strip()
        # Strip markdown if present
        if "```json" in content:
            content = content.split("```json")[1].split("```")[0]
        elif "```" in content:
            content = content.split("```")[1].split("```")[0]
        scores = json.loads(content.strip())
        # Ensure all criteria present with valid range
        result = {}
        for criterion in RUBRIC_CRITERIA:
            score = scores.get(criterion, 0)
            result[criterion] = max(0, min(5, int(score)))
        return result

    except Exception as e:
        print(f"  WARNING: Claude scoring failed ({e}) — using heuristic scoring")
        return heuristic_score(response)


def heuristic_score(response: dict) -> dict[str, int]:
    """
    Fallback heuristic scorer when Claude is unavailable.
    Checks structural completeness — NOT semantic quality.
    """
    scores: dict[str, int] = {}

    if "error" in response:
        # Errored response — all scores minimum
        return {c: 0 for c in RUBRIC_CRITERIA}

    # 1. Addresses the question — has any non-empty content
    has_content = bool(
        response.get("analysis") or
        (response.get("five_case_model") and
         any(v for v in response.get("five_case_model", {}).values()))
    )
    scores["Addresses the question"] = 3 if has_content else 0

    # 2. Citations used in context — citations present and non-empty
    citations = response.get("corpus_citations", [])
    if len(citations) >= 3:
        scores["Citations used in context"] = 3
    elif len(citations) >= 1:
        scores["Citations used in context"] = 2
    else:
        scores["Citations used in context"] = 0

    # 3. Confidence tier justified — tier is set (non-Speculative = better)
    tier = response.get("confidence_tier", "")
    tier_map = {"Speculative": 2, "Indicative": 3, "Supported": 4, "Robust": 5}
    scores["Confidence tier justified"] = tier_map.get(tier, 0)

    # 4. No unsupported quantities — check npv_value presence for ATLAS
    npv = response.get("npv_value")
    if npv is not None:
        scores["No unsupported quantities"] = 3  # Has an estimate
    elif "five_case_model" not in response:
        scores["No unsupported quantities"] = 3  # JARVIS — no NPV expected
    else:
        scores["No unsupported quantities"] = 1  # ATLAS should have NPV

    # 5. Sections not generic filler — check section lengths
    fcm = response.get("five_case_model", {})
    if fcm:
        min_len = min((len(v) for v in fcm.values() if v), default=0)
        if min_len > 200:
            scores["Sections not generic filler"] = 4
        elif min_len > 50:
            scores["Sections not generic filler"] = 2
        else:
            scores["Sections not generic filler"] = 1
    else:
        # JARVIS — has analysis instead
        analysis = response.get("analysis", "")
        scores["Sections not generic filler"] = 3 if len(analysis) > 100 else 1

    return scores


# ---------------------------------------------------------------------------
# Golden-prompt graders (G1–G5)
# ---------------------------------------------------------------------------


def check_schema(
    artifact: dict,
    expected_recipe: str,
    expected_keys: list[str],
) -> tuple[bool | None, str]:
    """
    G1: Schema check — recipe field matches expected value and all Five Case
    section keys are present in artifact.sections.
    Returns (passed, reason).
    """
    recipe = artifact.get("recipe", "")
    if not recipe:
        return False, "recipe field absent"
    if recipe != expected_recipe:
        return False, f"recipe={recipe!r}, expected {expected_recipe!r}"

    sections = artifact.get("sections", {})
    missing = [k for k in expected_keys if k not in sections]
    if missing:
        return False, f"missing section keys: {missing}"

    return True, f"recipe={recipe!r}, all {len(expected_keys)} Five Case keys present"


def decision_spine_present(
    response: dict,
    required_fields: list[str],
) -> tuple[bool | None, str]:
    """
    G2: Decision Spine structural check — all required fields present and
    non-empty.  Looks at top level and inside artifact_block.
    Returns (passed, reason).
    """
    # Try top-level first; fall back to nested artifact_block
    spine = response.get("decision_spine")
    if spine is None:
        artifact = response.get("artifact_block", {})
        spine = artifact.get("decision_spine")

    if spine is None:
        return False, "decision_spine absent from response"

    missing = [f for f in required_fields if not spine.get(f)]
    if missing:
        return False, f"decision_spine missing fields: {missing}"

    return True, f"decision_spine present with all {len(required_fields)} required fields"


def check_confidence_ceiling(artifact: dict) -> tuple[bool | None, str]:
    """
    G4: Confidence ceiling rule.

    Rules (locked — see CLAUDE.md):
      0 citations          → must be Speculative
      1–2 citations        → max Indicative
      3+ citations, avg score < 0.85  → max Supported
      5+ citations, avg score >= 0.85 → Robust allowed

    Returns (passed, reason).
    """
    TIERS = ["Speculative", "Indicative", "Supported", "Robust"]

    tier = artifact.get("confidence_tier", "")
    if tier not in TIERS:
        return False, f"confidence_tier={tier!r} is not a valid tier value"

    tier_rank = TIERS.index(tier)
    citations = [
        c for c in artifact.get("corpus_citations", []) if isinstance(c, dict)
    ]
    n = len(citations)

    if n == 0:
        max_rank, rule = 0, "0 citations → must be Speculative"
    elif n < 3:
        max_rank, rule = 1, f"{n} citation(s) → max Indicative"
    else:
        scores = [c.get("score", 0.0) for c in citations]
        avg_score = sum(scores) / len(scores) if scores else 0.0
        if n < 5 or avg_score < 0.85:
            max_rank = 2
            rule = f"{n} citations, avg_score={avg_score:.2f} → max Supported"
        else:
            max_rank = 3
            rule = f"{n} citations, avg_score={avg_score:.2f} → Robust allowed"

    if tier_rank > max_rank:
        ceiling = TIERS[max_rank]
        return False, f"confidence_tier={tier!r} exceeds ceiling={ceiling!r} ({rule})"

    return True, f"confidence_tier={tier!r} within ceiling ({rule})"


def verify_citation_ids(ids: list[str]) -> tuple[bool | None, str]:
    """
    G3: Verify that each corpus citation UUID exists in atlas.projects.

    Uses direct PostgreSQL (POSTGRES_URL / DATABASE_URL) — the Supabase REST API
    does NOT expose the atlas schema (only public / graphql_public / hive).

    Returns (None, reason) when DB credentials are absent (grader skipped).
    Returns (passed, reason) otherwise.

    Security: POSTGRES_URL / DATABASE_URL are server-side only env vars.
    They are never returned in API responses or logged.
    """
    if not ids:
        return True, "no citations to verify (passes vacuously)"

    db_url = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL") or ""
    if not db_url:
        return None, "POSTGRES_URL / DATABASE_URL not set — G3 skipped"

    try:
        import re
        import psycopg2
        import psycopg2.extras

        # Strip sslmode from URL if present (handled by kwargs)
        conn_str = re.sub(r"[?&]sslmode=[^&]*", "", db_url)
        is_local = "localhost" in db_url or "127.0.0.1" in db_url
        kwargs: dict = {} if is_local else {"sslmode": "require"}
        conn = psycopg2.connect(conn_str, **kwargs)

        try:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                placeholders = ",".join(["%s"] * len(ids))
                cur.execute(
                    f"SELECT id::text FROM atlas.projects WHERE id = ANY(ARRAY[{placeholders}]::uuid[])",
                    ids,
                )
                found = {str(row["id"]) for row in cur.fetchall()}
        finally:
            conn.close()

        missing = [i for i in ids if i not in found]
        if missing:
            return (
                False,
                f"{len(missing)}/{len(ids)} IDs not found in atlas.projects: {missing[:3]}",
            )

        return True, f"all {len(ids)} citation IDs verified in atlas.projects"

    except ImportError:
        return None, "psycopg2 not installed — G3 skipped"
    except Exception as exc:
        return None, f"DB verification failed ({exc}) — G3 skipped"


def check_tool_call_coverage(response: dict) -> tuple[bool | None, str]:
    """
    G5: Verify that the agent invoked at least one corpus search tool during
    its run.  Looks for tool_calls / tool_trace in the response.

    Expected tool names: search_projects, search_hive, search_govuk, search_exa.
    Returns (None, reason) when the response contains no tool call trace.
    """
    # Match tool names as recorded by agents/atlas/graph.py (and future agents)
    EXPECTED = {
        "search_corpus_projects",
        "search_corpus_live_calls",
        "search_corpus_evidence",
        "search_hive_evidence",
        # Legacy / future Exa+GovUK names (accepted when present)
        "search_projects",
        "search_hive",
    }

    trace = response.get("tool_calls") or response.get("tool_trace") or []
    if not trace:
        return None, "tool_calls/tool_trace absent from response — G5 skipped"

    called: set[str] = set()
    for call in trace:
        if isinstance(call, dict):
            name = call.get("tool") or call.get("name") or call.get("tool_name", "")
            called.add(str(name))
        elif isinstance(call, str):
            called.add(call)

    corpus_called = called & EXPECTED
    if not corpus_called:
        return False, f"no corpus search tools called; got: {sorted(called)}"

    return True, f"corpus tools called: {sorted(corpus_called)}"


def check_external_routing(response: dict) -> tuple[bool | None, str]:
    """
    G6: External search is routed correctly from structured evidence gaps.

    Sub-checks (all must pass):
    1. official_policy gaps (available_tool=govuk_search) triggered govuk_search calls
    2. market_discovery gaps (available_tool=exa_search) triggered exa_search calls
       (EXA_API_KEY absent → skipped trace entry is acceptable)
    3. govuk_search results must not use 'GovUK' as provider when URL path
       identifies a more specific publisher (DfT / CCAV / NationalHighways)
    4. exa_search results must not use 'Exa' as provider when the URL is a
       known government domain (.gov.uk → should map to a real publisher)

    Returns (None, reason) when there are no evidence_gaps and no external tool
    calls to examine — grader not applicable.
    """
    trace = response.get("tool_calls") or response.get("tool_trace") or []
    evidence_gaps = response.get("evidence_gaps") or []
    external_cites = response.get("external_citations") or []

    # Govuk URL path hints → real publisher (mirrors external_search.py)
    _GOVUK_PATH_HINTS: list[tuple[str, str]] = [
        ("department-for-transport", "DfT"),
        ("/transport/", "DfT"),
        ("transport-", "DfT"),
        ("ccav", "CCAV"),
        ("connected-autonomous", "CCAV"),
        ("centre-connected", "CCAV"),
        ("national-highways", "NationalHighways"),
        ("innovate-uk", "InnovateUK"),
        ("ukri", "UKRI"),
        ("uk-research-and-innovation", "UKRI"),
    ]

    if not evidence_gaps and not external_cites and not trace:
        return None, "no evidence_gaps, external_citations, or trace — G6 skipped"

    failures: list[str] = []

    # ── Sub-check 1: govuk_search calls must come from official_policy gaps ──
    # Forward-direction check: if govuk_search fired, verify gap_lane is correct.
    # Also check backward: if a structural official_policy/govuk_search gap exists
    # (type=corpus_gap or retrieval_gap, not landscape_gap), govuk_search should fire.
    policy_gaps_structural = [
        g for g in evidence_gaps
        if g.get("recommended_source_lane") == "official_policy"
        and g.get("available_tool") == "govuk_search"
        and g.get("type") in ("corpus_gap", "retrieval_gap")  # structural only
    ]
    govuk_live = [
        c for c in trace
        if isinstance(c, dict)
        and (c.get("tool") or c.get("name", "")) == "govuk_search"
        and not c.get("skipped")
    ]
    # Verify forward: govuk_search calls come from official_policy/research
    for call in govuk_live:
        gap_lane = call.get("gap_lane", "")
        if gap_lane and gap_lane not in ("official_policy", "research"):
            failures.append(
                f"govuk_search fired for gap_lane={gap_lane!r} — "
                "must only fire for official_policy or research gaps"
            )
    # Verify backward for structural gaps: if structural official_policy/govuk gap exists,
    # govuk_search should have been called
    if policy_gaps_structural and not govuk_live:
        failures.append(
            f"{len(policy_gaps_structural)} structural official_policy/govuk_search gap(s) "
            "but no govuk_search call in trace"
        )

    # ── Sub-check 2: exa_search calls must come from market_discovery gaps ──
    # Forward-direction check: verify that when exa_search fires, it was
    # triggered by a market_discovery or research gap.
    # We do NOT check the reverse (that every market_discovery gap triggered a
    # call) because the LLM may add domain-specific exa_search gaps in
    # build_five_case, after the external_evidence_search node has already run.
    # Only structural gaps (from detect_evidence_gaps) are visible to the router.
    exa_live = [
        c for c in trace
        if isinstance(c, dict)
        and (c.get("tool") or c.get("name", "")) == "exa_search"
        and not c.get("skipped")
    ]
    for call in exa_live:
        gap_lane = call.get("gap_lane", "")
        if gap_lane and gap_lane not in ("market_discovery", "research"):
            failures.append(
                f"exa_search fired for gap_lane={gap_lane!r} — "
                "must only fire for market_discovery or research gaps"
            )

    # ── Sub-check 3: no 'GovUK' provider identity when specific publisher known
    for cite in external_cites:
        if cite.get("retrieval_tool") != "govuk_search":
            continue
        if cite.get("recommended_provider") != "GovUK":
            continue
        url_lower = (cite.get("url") or "").lower()
        for fragment, real_provider in _GOVUK_PATH_HINTS:
            if fragment in url_lower:
                failures.append(
                    f"govuk_search citation uses 'GovUK' as provider but URL hints at "
                    f"'{real_provider}': {cite.get('url', '?')[:80]}"
                )
                break  # one failure per citation is enough

    # ── Sub-check 4: no 'Exa' provider when .gov.uk domain detected ──────────
    for cite in external_cites:
        if cite.get("retrieval_tool") != "exa_search":
            continue
        if cite.get("recommended_provider") != "Exa":
            continue
        url_lower = (cite.get("url") or "").lower()
        if ".gov.uk" in url_lower:
            failures.append(
                f"exa_search result on .gov.uk uses 'Exa' as provider — should map "
                f"to a real publisher: {cite.get('url', '?')[:80]}"
            )

    if failures:
        detail = failures[0]
        if len(failures) > 1:
            detail += f" (+{len(failures) - 1} more)"
        return False, f"external routing violation: {detail}"

    # Build passing summary
    parts: list[str] = []
    if govuk_live:
        lanes = sorted({c.get("gap_lane", "?") for c in govuk_live})
        parts.append(f"{len(govuk_live)} govuk_search call(s) from lanes={lanes}")
    if exa_live:
        lanes = sorted({c.get("gap_lane", "?") for c in exa_live})
        parts.append(f"{len(exa_live)} exa_search call(s) from lanes={lanes}")
    if external_cites:
        providers = sorted({c.get("recommended_provider", "?") for c in external_cites})
        parts.append(f"{len(external_cites)} external citation(s) providers={providers}")
    if not parts:
        return None, "no external routing applicable — G6 skipped"
    return True, "; ".join(parts)


def check_confidence_discipline(response: dict) -> tuple[bool | None, str]:
    """
    G7: Confidence tier is disciplined with external evidence.

    Sub-checks (all must pass):
    1. external_citations are stored separately — corpus_citations must NOT
       contain 'url' fields (external results must not leak into corpus lane)
    2. Background-only evidence cannot lift confidence: if all evidence_gaps have
       can_lift_confidence=False and there are no corpus citations, tier must not
       exceed Indicative
    3. Exa-only evidence cannot lift above Supported: if all external_citations
       come from exa_search and corpus_citations is empty, tier must not be Robust
    4. evidence_coverage.suggested_confidence_tier must not be exceeded by the
       reported confidence_tier (evidence_coverage is the authoritative signal)

    Returns (None, reason) when there is nothing to check.
    """
    TIERS = ["Speculative", "Indicative", "Supported", "Robust"]

    artifact = response.get("artifact_block", response)
    external_cites: list[dict] = (
        response.get("external_citations") or
        artifact.get("external_citations") or
        []
    )
    corpus_cites: list[dict] = (
        artifact.get("corpus_citations") or
        response.get("corpus_citations") or
        []
    )
    tier: str = (
        artifact.get("confidence_tier") or
        response.get("confidence_tier") or
        ""
    )
    evidence_gaps: list[dict] = (
        response.get("evidence_gaps") or
        artifact.get("evidence_gaps") or
        []
    )
    coverage: dict = response.get("evidence_coverage") or {}

    if not external_cites and not corpus_cites and not evidence_gaps:
        return None, "no external_citations, corpus_citations, or evidence_gaps — G7 skipped"

    failures: list[str] = []

    # ── Sub-check 1: no URL fields leaking into corpus_citations ─────────────
    corpus_with_url = [c for c in corpus_cites if isinstance(c, dict) and c.get("url")]
    if corpus_with_url:
        failures.append(
            f"{len(corpus_with_url)} corpus citation(s) contain a 'url' field — "
            "external results must stay in external_citations, not corpus_citations"
        )

    # ── Sub-check 2: background-only gaps cannot lift above Indicative ───────
    if evidence_gaps and not corpus_cites:
        all_background = all(
            not g.get("can_lift_confidence", True)
            for g in evidence_gaps
            if isinstance(g, dict)
        )
        if all_background and tier in TIERS:
            tier_rank = TIERS.index(tier)
            if tier_rank > TIERS.index("Indicative"):
                failures.append(
                    f"confidence_tier={tier!r} with all-background gaps "
                    "(can_lift_confidence=False for all) and no corpus citations — "
                    "must not exceed Indicative"
                )

    # ── Sub-check 3: Exa-only external cannot lift above Supported ───────────
    if external_cites and not corpus_cites:
        exa_only = all(
            isinstance(c, dict) and c.get("retrieval_tool") == "exa_search"
            for c in external_cites
        )
        if exa_only and tier in TIERS:
            if TIERS.index(tier) > TIERS.index("Supported"):
                failures.append(
                    f"confidence_tier={tier!r} with Exa-only external evidence "
                    f"({len(external_cites)} exa_search citation(s), 0 corpus) — "
                    "must not exceed Supported"
                )

    # ── Sub-check 4: confidence_tier must not exceed coverage suggestion ──────
    suggested = coverage.get("suggested_confidence_tier", "")
    if suggested and suggested in TIERS and tier in TIERS:
        if TIERS.index(tier) > TIERS.index(suggested):
            failures.append(
                f"confidence_tier={tier!r} exceeds "
                f"evidence_coverage.suggested_confidence_tier={suggested!r} — "
                "tier must not exceed coverage signal"
            )

    if failures:
        detail = failures[0]
        if len(failures) > 1:
            detail += f" (+{len(failures) - 1} more)"
        return False, f"confidence discipline violation: {detail}"

    # Passing summary
    parts: list[str] = []
    if not corpus_with_url:
        parts.append("corpus_citations contain no url fields")
    if external_cites:
        exa_n = sum(1 for c in external_cites if c.get("retrieval_tool") == "exa_search")
        gov_n = sum(1 for c in external_cites if c.get("retrieval_tool") == "govuk_search")
        label = []
        if gov_n:
            label.append(f"{gov_n} govuk")
        if exa_n:
            label.append(f"{exa_n} exa")
        parts.append(f"external citations: {', '.join(label) or str(len(external_cites))}")
    if suggested:
        parts.append(f"coverage.suggested={suggested!r} consistent with tier={tier!r}")
    else:
        parts.append(f"confidence_tier={tier!r} within discipline rules")
    return True, "; ".join(parts)


# ---------------------------------------------------------------------------
# Golden eval runner + report
# ---------------------------------------------------------------------------


def run_golden_eval() -> int:
    """
    Run the golden-prompt agent eval (A14 autonomous freight query).

    Graders:
      G1 Schema              — recipe=brief_five_case + Five Case keys present
      G2 Decision Spine      — 5 required fields populated
      G3 Citations real      — UUID verification in atlas.projects (Supabase)
      G4 Confidence ceiling  — tier within ceiling for citation count/quality
      G5 Tool call coverage  — corpus search tool recorded in trace
      G6 External controlled — govuk/exa only fires when triggered by evidence_gap
      G7 External ceiling    — confidence not Robust when external-only evidence

    Pass: GOLDEN_PASS_THRESHOLD graders pass; skipped graders excluded from
    denominator (None result = skip).

    Returns exit code: 0 = pass, 1 = fail.
    """
    print()
    print("=" * 60)
    print("Atlas 5 — Golden-prompt agent eval")
    print(f"Run at: {datetime.now(timezone.utc).isoformat()}Z")
    print("=" * 60)
    print()

    if not check_health():
        print(f"ERROR: Agent service not reachable at {AGENT_BASE_URL}")
        print("Start with: cd agents && uvicorn server:app --port 8000")
        print()
        print("Golden eval requires live agents — cannot run offline.")
        return 1

    print(f"Agent service: {AGENT_BASE_URL} ✓")
    print()

    all_results = []

    for golden in GOLDEN_QUERIES:
        q_label = golden["label"]
        agent = golden["agent"]
        query = golden["query"]

        print(f"[{agent.upper()}] {q_label}")
        print(f"  Query: {query[:80]}...")
        print(f"  Posting to /agents/{agent}...")

        response = post_agent(agent, query)

        if "error" in response:
            err_msg = response["error"]
            print(f"  ERROR: {err_msg}")
            grader_results = {
                "G1_schema": (False, f"agent error: {err_msg}"),
                "G2_decision_spine": (False, "skipped — agent error"),
                "G3_citations_real": (False, "skipped — agent error"),
                "G4_confidence_ceiling": (False, "skipped — agent error"),
                "G5_tool_coverage": (False, "skipped — agent error"),
                "G6_external_routing": (False, "skipped — agent error"),
                "G7_confidence_discipline": (False, "skipped — agent error"),
            }
            all_results.append({
                "label": q_label, "query": query, "agent": agent,
                "response": response, "grader_results": grader_results,
                "passed": False, "passing": 0, "denominator": 7,
            })
            print()
            continue

        # Normalize — agent may return artifact nested or at top level
        artifact = response.get("artifact_block", response)

        # Run all five graders
        g1 = check_schema(artifact, golden["expected_recipe"], golden["expected_five_case_keys"])
        g2 = decision_spine_present(response, golden["expected_decision_spine_fields"])
        citation_ids = [
            c["id"] for c in artifact.get("corpus_citations", [])
            if isinstance(c, dict) and c.get("id")
        ]
        g3 = verify_citation_ids(citation_ids)
        g4 = check_confidence_ceiling(artifact)
        g5 = check_tool_call_coverage(response)
        g6 = check_external_routing(response)
        g7 = check_confidence_discipline(response)

        grader_results: dict[str, tuple[bool | None, str]] = {
            "G1_schema": g1,
            "G2_decision_spine": g2,
            "G3_citations_real": g3,
            "G4_confidence_ceiling": g4,
            "G5_tool_coverage": g5,
            "G6_external_routing": g6,
            "G7_confidence_discipline": g7,
        }

        # Decisive graders: skip those returning None
        decisive = [(k, v) for k, v in grader_results.items() if v[0] is not None]
        passing = sum(1 for _, v in decisive if v[0])
        denominator = len(decisive)
        query_pass = passing >= min(GOLDEN_PASS_THRESHOLD, denominator)

        print(f"  Grader results ({passing}/{denominator} decisive):")
        ICONS = {True: "✓", False: "✗", None: "⊘"}
        LABELS = {True: "PASS", False: "FAIL", None: "SKIP"}
        for grader, (result, reason) in grader_results.items():
            print(f"    {ICONS[result]} {grader}: {LABELS[result]} — {reason}")

        print(f"  Golden result: {'PASS ✓' if query_pass else 'FAIL ✗'}")
        print()

        all_results.append({
            "label": q_label, "query": query, "agent": agent,
            "response": response, "grader_results": grader_results,
            "passed": query_pass, "passing": passing, "denominator": denominator,
        })

    overall_passed = all(r["passed"] for r in all_results)
    print("=" * 60)
    print(f"GOLDEN EVAL RESULT: {'PASS ✓' if overall_passed else 'FAIL ✗'}")
    print(f"Pass threshold: {GOLDEN_PASS_THRESHOLD}/7 decisive graders per query")
    print("=" * 60)

    _write_golden_report(all_results, overall_passed)
    print("Report written to eval/golden_output.md")

    return 0 if overall_passed else 1


def _write_golden_report(results: list[dict], overall_passed: bool) -> None:
    """Write golden-prompt eval report to eval/golden_output.md."""
    ICONS = {True: "✓", False: "✗", None: "⊘"}
    LABELS = {True: "PASS", False: "FAIL", None: "SKIP"}

    lines = [
        "# Atlas 5 — Golden-Prompt Agent Eval",
        "",
        f"**Generated:** {datetime.now(timezone.utc).isoformat()}Z",
        f"**Pass threshold:** {GOLDEN_PASS_THRESHOLD}/7 decisive graders per query",
        f"**Overall result:** {'PASS ✓' if overall_passed else 'FAIL ✗'}",
        "",
        "---",
        "",
        "## Grader legend",
        "",
        "| Grader | Description |",
        "|--------|-------------|",
        "| G1_schema | `recipe=brief_five_case` + all Five Case section keys present |",
        "| G2_decision_spine | `decision_spine` present with 5 required fields |",
        "| G3_citations_real | Every corpus citation UUID exists in `atlas.projects` |",
        "| G4_confidence_ceiling | `confidence_tier` within ceiling for citation count/quality |",
        "| G5_tool_coverage | At least one corpus search tool recorded in agent trace |",
        "| G6_external_routing | official_policy→govuk_search; market_discovery→exa_search; no GovUK/Exa identity when real publisher known |",
        "| G7_confidence_discipline | external_citations separate from corpus; background gaps can't lift; Exa-only≤Supported; coverage consistency |",
        "",
        "---",
        "",
    ]

    for r in results:
        grader_results: dict[str, tuple[bool | None, str]] = r["grader_results"]
        lines += [
            f"## {r['label']}",
            "",
            f"**Agent:** {r['agent'].upper()}  ",
            f"**Query:** {r['query']}  ",
            f"**Decisive graders:** {r['passing']}/{r['denominator']}  ",
            f"**Result:** {'PASS ✓' if r['passed'] else 'FAIL ✗'}",
            "",
            "### Grader results",
            "",
            "| Grader | Result | Reason |",
            "|--------|--------|--------|",
        ]
        for grader, (result, reason) in grader_results.items():
            icon = ICONS[result]
            label = LABELS[result]
            lines.append(f"| {grader} | {icon} {label} | {reason} |")

        lines += [
            "",
            "### Agent response",
            "",
            "```json",
            json.dumps(r["response"], indent=2, default=str),
            "```",
            "",
        ]

    lines += [
        "---",
        "",
        "## Confidence ceiling rules",
        "",
        "| Citations | Max tier |",
        "|-----------|----------|",
        "| 0 | Speculative |",
        "| 1–2 | Indicative |",
        "| 3–4, or avg score < 0.85 | Supported |",
        "| 5+, avg score ≥ 0.85 | Robust |",
    ]

    output_path = Path(__file__).parent / "golden_output.md"
    output_path.write_text("\n".join(lines), encoding="utf-8")


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------


def run_evaluation() -> int:
    """
    Run all sample queries, score responses, generate tier2_output.md.
    Returns exit code: 0 = pass, 1 = fail.
    """
    print("=" * 60)
    print("Atlas 5 — Tier 2 value evaluation generator")
    print(f"Run at: {datetime.now(timezone.utc).isoformat()}Z")
    print("=" * 60)
    print()

    # Health check
    if not check_health():
        print(f"ERROR: Agent service not reachable at {AGENT_BASE_URL}")
        print("Start with: cd agents && uvicorn server:app --port 8000")
        print()
        print("Generating scaffold report (service offline)...")
        _write_offline_report()
        return 1

    print(f"Agent service: {AGENT_BASE_URL} ✓")
    print()

    results = []
    total_score = 0

    for sample in SAMPLE_QUERIES:
        label = sample["label"]
        agent = sample["agent"]
        query = sample["query"]

        print(f"[{agent.upper()}] {label}")
        print(f"  Query: {query}")
        print(f"  Posting to /agents/{agent}...")

        response = post_agent(agent, query)

        if "error" in response:
            print(f"  ERROR: {response['error']}")
            scores = {c: 0 for c in RUBRIC_CRITERIA}
        else:
            print("  Scoring response with judge...")
            scores = score_with_claude(query, agent, response)

        sample_total = sum(scores.values())
        total_score += sample_total
        print(f"  Score: {sample_total}/25")
        for criterion, score in scores.items():
            flag = "✓" if score >= MIN_CRITERION_SCORE else "✗"
            print(f"    {flag} {criterion}: {score}/5")
        print()

        results.append({
            "label": label,
            "agent": agent,
            "query": query,
            "response": response,
            "scores": scores,
            "sample_total": sample_total,
        })

    # Determine pass/fail
    all_criteria_pass = all(
        score >= MIN_CRITERION_SCORE
        for r in results
        for score in r["scores"].values()
    )
    passed = total_score >= MIN_TOTAL_SCORE and all_criteria_pass

    print("=" * 60)
    print(f"TOTAL SCORE: {total_score}/{len(SAMPLE_QUERIES) * 25}")
    print(f"PASS THRESHOLD: {MIN_TOTAL_SCORE}/{len(SAMPLE_QUERIES) * 25}")
    print(f"RESULT: {'PASS ✓' if passed else 'FAIL ✗'}")
    print("=" * 60)
    print()

    _write_report(results, total_score, passed)
    print("Report written to eval/tier2_output.md")

    return 0 if passed else 1


def _write_offline_report() -> None:
    """Write a placeholder report when the service is offline."""
    output_path = Path(__file__).parent / "tier2_output.md"
    output_path.write_text(
        "# Atlas 5 — Tier 2 Evaluation Report\n\n"
        "**STATUS: OFFLINE** — Agent service was not reachable.\n\n"
        "Start the agent service and re-run: `python eval/tier2_generator.py`\n"
    )


def _write_report(results: list[dict], total_score: int, passed: bool) -> None:
    """Write full Tier 2 evaluation report to eval/tier2_output.md."""
    lines = [
        "# Atlas 5 — Tier 2 Evaluation Report",
        "",
        f"**Generated:** {datetime.now(timezone.utc).isoformat()}Z",
        f"**Judge model:** {JUDGE_MODEL}",
        f"**Total score:** {total_score}/{len(results) * 25}",
        f"**Result:** {'PASS ✓' if passed else 'FAIL ✗'}",
        f"**Pass threshold:** {MIN_TOTAL_SCORE}/{len(results) * 25} (each criterion ≥ {MIN_CRITERION_SCORE})",
        "",
        "---",
        "",
    ]

    for r in results:
        lines += [
            f"## {r['label']}",
            "",
            f"**Agent:** {r['agent'].upper()}  ",
            f"**Query:** {r['query']}  ",
            f"**Score:** {r['sample_total']}/25",
            "",
            "### Rubric scores",
            "",
            "| Criterion | Score | Pass? |",
            "|-----------|-------|-------|",
        ]
        for criterion, score in r["scores"].items():
            flag = "✓" if score >= MIN_CRITERION_SCORE else "✗"
            lines.append(f"| {criterion} | {score}/5 | {flag} |")

        lines += [
            "",
            "### Response",
            "",
            "```json",
            json.dumps(r["response"], indent=2, default=str),
            "```",
            "",
        ]

    lines += [
        "---",
        "",
        "## Rubric criteria",
        "",
    ]
    for i, c in enumerate(RUBRIC_CRITERIA, 1):
        lines.append(f"{i}. **{c}**")

    output_path = Path(__file__).parent / "tier2_output.md"
    output_path.write_text("\n".join(lines), encoding="utf-8")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> int:
    """
    Usage:
      python eval/tier2_generator.py           — run Tier 2 rubric eval
      python eval/tier2_generator.py --golden  — run golden-prompt agent eval
      python eval/tier2_generator.py --all     — run both
    """
    args = sys.argv[1:]
    run_golden = "--golden" in args or "--all" in args
    run_rubric = "--golden" not in args or "--all" in args

    exit_code = 0
    if run_rubric:
        exit_code |= run_evaluation()
    if run_golden:
        exit_code |= run_golden_eval()
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
