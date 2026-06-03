"""
Atlas Visual Recipe Director — Python port.

Mirrors src/lib/atlas/visual-recipe-director.ts exactly.
Call build_chart_specs() from verify_citations (and other agent nodes)
to replace the hard-coded 2-bar-chart output with intent-appropriate visuals.

Three-layer model (same as TS):
    classify_intent(query)         → str (AnalyticalIntent)
    is_cpc_inward(query)           → bool
    select_recipe(query)           → str (recipe ID)
    build_chart_specs(...)         → list[dict]  (chart_spec dicts with embedded data)
"""
from __future__ import annotations

import re
from collections import Counter
from typing import Any

# ---------------------------------------------------------------------------
# Intent taxonomy  (mirrors AnalyticalIntent in TS)
# ---------------------------------------------------------------------------

_INTENT_PATTERNS: list[tuple[str, list[re.Pattern[str]]]] = [
    # ── Checked earliest: high-specificity patterns that would lose to broad ones below ──

    ("overlap_intersection", [
        re.compile(r"overlap|intersect|both.*and|in common|shared|share", re.I),
        re.compile(r"\bvenn\b|\beuler\b", re.I),
    ]),
    ("flow_pathway", [
        re.compile(r"\bflows?\b|pathway|route.*through|channel|sankey|where.*fund|fund.*move|money.*go", re.I),
        # "funding landscape", "funders backing X", "who funds Y" — all want a Sankey
        re.compile(r"fund.*landscape|landscape.*fund|\bfunders?\b|who.*fund|back.*resear", re.I),
    ]),
    # trade_off_quadrant before evidence_coverage/market_alignment:
    # "high fit + weak evidence" and "bid-ready vs needs enrichment" → quadrant, not gap/market
    ("trade_off_quadrant", [
        re.compile(r"high.*low|fit.*evidence|evidence.*fit|trade.off|quadrant|worth.*bid", re.I),
        re.compile(r"priorit.*call|which.*call.*best|best.*call", re.I),
        # "bid-ready vs needs enrichment" TOGETHER = classic opportunity matrix (not readiness alone)
        re.compile(r"bid.?ready.{0,50}(?:enrichment|need.*first|vs)|(?:enrichment|need.*first|vs).{0,50}bid.?ready", re.I),
    ]),
    # market_alignment before portfolio_audit: "match portfolio against calls" → market, not portfolio
    # (specific "match/align + call" beats the generic "\bportfolio\b" in portfolio_audit)
    ("market_alignment", [
        re.compile(r"\bmarket\b|live.*call|fund.*match|\balign\b|opportunit|which.*call.*match", re.I),
        re.compile(r"match.*call|fit.*call|call.*fit|match.*portfolio|align.*portfolio|match.*against.*call|portfolio.*against", re.I),
        # "what/which funding calls should CPC look at" — market scan without explicit "match"
        re.compile(r"(what|which).*fund.*calls?|fund.*calls?.*should|calls?.*should.*look|should.*look.*calls?", re.I),
    ]),
    # evidence_coverage before portfolio_audit: "evidence gaps in portfolio" → gaps, not portfolio
    ("evidence_coverage", [
        re.compile(r"\bthin\b|\bgap\b|missing|weak.*evidence|no evidence|sparse|where.*lack|lack.*evidence|\benrich\b", re.I),
        # "evidence coverage" as a compound phrase (not bare "coverage" — too broad, catches "corpus coverage")
        re.compile(r"evidence gap|gap analysis|what.*gap|where.*gap|evidence.*coverage|lack.*coverage", re.I),
    ]),
    ("readiness_maturity", [
        re.compile(r"\breadiness\b|\bbid.ready\b|maturity|how.*prepared|prepared.*bid", re.I),
        re.compile(r"score.*bid|bid.*score|invest.*ready|five.case|investment brief|business case", re.I),
    ]),
    # portfolio_audit after evidence_coverage: "rank units by corpus coverage" → portfolio
    # ("rank.*unit" + "business unit" do not appear in evidence_coverage so no conflict)
    ("portfolio_audit", [
        re.compile(r"\bportfolio\b|all unit|compare unit|business unit|all.*unit|unit.*all", re.I),
        re.compile(r"full.*picture|overview.*portfolio|portfolio.*overview", re.I),
        # Ranking/comparing units or domains always implies a portfolio view
        re.compile(r"\brank.*unit|\brank.*busines|\brank.*domain|compare.*unit|compare.*domain|which.*unit.*most", re.I),
    ]),
    ("timeline_change", [
        re.compile(r"change.*over|trend|over time|history|timeline|grew|grown|grow\b|expand|increased|decreased|\byears?\b", re.I),
    ]),
    ("evidence_quality", [
        re.compile(r"reliab|quality.*evidence|evidence.*quality|how.*good.*evidence", re.I),
        re.compile(r"\btier\b.*evidence|evidence.*\btier\b|which.*claim.*use|cit.*bid", re.I),
    ]),
    ("defend_challenge", [
        re.compile(r"\bdefend\b|\bdefence\b|\bdefense\b|hold.*up|stand.*up|challenge", re.I),
        re.compile(r"\bboard\b.*\b(pack|presentat|question|scrutin)|scrutin.*board", re.I),
        re.compile(r"\bobjection|\bpush.?back\b|sceptic|skeptic|\bcritique\b|\bchallenged\b", re.I),
        re.compile(r"make.*case.*panel|present.*panel|funding.*panel|investment.*panel", re.I),
    ]),
    ("comparison_ranking", [
        re.compile(r"\bcompar\b|\brank\b|\bmost\b|\bleast\b|highest|lowest|\bversus\b|\bvs\.\b|which.*more|more.*than", re.I),
    ]),
    # orient_explore must come after flow_pathway (which owns "funding landscape")
    # but before the fallback — catches landscape / exploration queries
    ("orient_explore", [
        # explicit exploration verbs
        re.compile(r"\bexplore\b|\bexploration\b|\bsurvey\b|\bmap\b.*\bsector\b|\bmap\b.*\bspace\b", re.I),
        # "innovation landscape", "X landscape", "landscape for Y" (but NOT "funding landscape")
        re.compile(r"\b(?:innovation|sector|market|technology|tech|research|policy|urban|mobility|freight|transport)\s+landscape\b", re.I),
        re.compile(r"\blandscape\s+(?:for|of|in|around)\b", re.I),
        # "what's happening in", "what exists in", "overview of the sector"
        re.compile(r"what['’]?s?\s+happening\s+in|what\s+exists?\s+in|overview\s+of\s+the\s+(?:sector|space|area|field|domain)", re.I),
        # "give me an overview", "paint a picture of", "scan the landscape"
        re.compile(r"give.*overview|scan.*landscape|paint.*picture|state\s+of\s+(?:the\s+)?(?:art|play|sector|market|field)", re.I),
        # "orient me on", terrain, landscape overview as standalone phrase
        re.compile(r"\borient\s+(?:me|us)\b|\bterrain\b|landscape\s+overview|innovation\s+in\s+(?:the\s+)?uk\b", re.I),
    ]),
]

# CPC-inward markers — query is about CPC's own evidence, not an external programme
_CPC_INWARD_PATTERNS: list[re.Pattern[str]] = [
    # Explicit CPC mention + capability/evidence keyword
    # "strong" matches "strongest"; stems without trailing \b to catch inflections
    re.compile(
        r"\bcpc\b.*\b(can|has|have|evidence|capabilit|portfolio|project|corpus|"
        r"strength|strong|weak|gap|support|bid|ready|enrich|clos|prioriti|"
        r"compare|rank|domain|theme|area|unit)",
        re.I,
    ),
    re.compile(r"\b(cpc|catapult)\b.*\b(bid|claim|prove|demonstrate|show)\b", re.I),
    re.compile(r"\b(our|cpc'?s?)\s+(evidence|portfolio|project|capabilit)", re.I),
    # "business unit(s)" always refers to CPC's own portfolio in the Atlas context
    re.compile(r"\bbusiness.unit", re.I),
    # Implicit inward: questions about call fit / bid readiness without naming CPC
    # still presuppose CPC as the bidder in the Atlas context.
    re.compile(r"which.*call.*fit|call.*fit.*evidence|fit.*call|high fit|weak evidence.*call|call.*weak evidence", re.I),
    # UK funders CPC regularly bids to — mentioning them implies CPC is the applicant
    re.compile(r"\b(innovate.?uk|ukri|innovateuk)\b", re.I),
    # "our X" constructions always refer to CPC's own resources in the Atlas context
    re.compile(r"\bour\s+(evidence|corpus|portfolio|capability|capabilit|project|bid|gap)", re.I),
    # Enriching the corpus implies CPC's own knowledge base
    re.compile(r"\benrich\b", re.I),
    # Gap analysis / evidence audit without explicit CPC still implies CPC in Atlas context
    re.compile(r"gap.anal\w*|evidence.gap|evidence.audit", re.I),
    # Bid readiness / "should we bid" always refers to CPC as the potential bidder
    re.compile(r"\bbid.read\w*|\bbid-read\w*|should.*\bbid\b|\bworth.*bid\b|\bbid.*worth\b", re.I),
    # "funding calls" (without CPC) — in Atlas context CPC is always the potential applicant
    re.compile(r"\bfunding.calls?\b", re.I),
    # "which areas have missing/sparse evidence" — evidence audit always about CPC corpus
    re.compile(r"\bareas?\b.{0,30}\b(miss|gap|sparse|thin|weak)\b|\b(miss|gap|sparse|thin)\b.{0,30}\bareas?\b", re.I),
]


def classify_intent(query: str) -> str:
    """Classify analytical intent from query text. Mirrors classifyIntent() in TS."""
    for intent, patterns in _INTENT_PATTERNS:
        if any(p.search(query) for p in patterns):
            return intent
    return "unknown"


def is_cpc_inward(query: str) -> bool:
    """True when the query is about CPC's own capabilities/evidence, not an external brief."""
    return any(p.search(query) for p in _CPC_INWARD_PATTERNS)


# Explicit bid-decision markers: "should CPC bid on X" → always opportunity fit
_BID_DECISION = re.compile(r"should.*\bbid\b|should.*we.*bid|\bbid.*on.*call|\bbid.*against\b", re.I)

# ---------------------------------------------------------------------------
# Compound query markers — used by select_recipes() to detect blended intent
# ---------------------------------------------------------------------------

_INVESTMENT_ASK = re.compile(
    r"five.case|investment brief|business case|strategic case|npv|stpr|public value|"
    r"investment appraisal|economic case|make.*case for|build a case",
    re.I,
)
_CPC_EVIDENCE_REF = re.compile(
    r"draw.*on.*cpc|cpc.*evidence|our evidence|based on.*cpc|cpc.*support|"
    r"using.*cpc|leverage.*cpc|draw on our|using our evidence",
    re.I,
)

# Decision 3 Rule B — comparison queries blend internal + external sources
_COMPARISON_QUERY = re.compile(
    r"\bcompar\b|\bversus\b|\bvs\.?\b|relative to|how does.*compare|compare.*to|"
    r"compare.*with|compare.*against|sit relative|where does.*sit",
    re.I,
)


def is_comparison_query(query: str) -> bool:
    """True when query explicitly compares CPC to external landscape (Decision 3 Rule B)."""
    return bool(_COMPARISON_QUERY.search(query))


def select_recipe(query: str) -> str:
    """
    Map query intent + CPC-inward flag to the correct artifact recipe ID.
    Mirrors the AGENT_DESCRIPTIONS routing table in dashboard.tsx.
    """
    intent = classify_intent(query)
    inward = is_cpc_inward(query)

    # Defend/challenge queries → Defend mode regardless of inward/outward.
    if intent == "defend_challenge":
        return "defend"

    # Funding flow: Sankey is the right primary visual regardless of inward/outward.
    # "Funding landscape" queries are always about flows, not Five Case structure.
    if intent == "flow_pathway":
        return "cpc_funding_flow"

    # Trade-off quadrant: in Atlas every bidding decision refers to CPC.
    if intent == "trade_off_quadrant":
        return "cpc_opportunity_fit" if inward else "connect"

    # Explicit bid decision ("should CPC bid on X") → opportunity fit even when
    # the default inward routing would pick capability_assessment.
    if inward and _BID_DECISION.search(query):
        return "cpc_opportunity_fit"

    if inward:
        if intent == "evidence_coverage":
            return "cpc_evidence_gaps"
        if intent in ("portfolio_audit", "comparison_ranking"):
            # Comparison/ranking within CPC domain → portfolio view
            return "cpc_portfolio_comparison"
        if intent == "market_alignment":
            return "cpc_market_alignment"
        if intent == "readiness_maturity":
            return "cpc_opportunity_fit"
        # Default inward: capability assessment
        return "cpc_capability_assessment"

    # --- Outward-facing modes (Decision 1 + 4) ---
    # Act / Five Case ONLY on explicit investment language — never unprompted.
    if _INVESTMENT_ASK.search(query):
        return "act"

    if intent == "evidence_coverage":
        return "diagnose"

    if intent == "market_alignment":
        return "connect"

    if intent == "orient_explore":
        return "orient"

    if intent == "readiness_maturity":
        return "connect"

    # Decision 4: ambiguous outward queries default to Orient, not Five Case.
    return "orient"


def select_recipes(query: str) -> tuple[str, list[str]]:
    """
    Returns (primary_recipe, secondary_recipes) for compound queries.

    A compound query spans both an outward investment case AND CPC's own evidence
    readiness — e.g. "Five Case for smart freight that draws on CPC evidence".
    Secondary recipes produce additional panels in a composite ArtifactBlock.
    """
    primary = select_recipe(query)
    secondaries: list[str] = []

    inward = is_cpc_inward(query)
    has_investment_ask = bool(_INVESTMENT_ASK.search(query))
    has_cpc_evidence_ref = bool(_CPC_EVIDENCE_REF.search(query))

    if primary == "act" and (has_cpc_evidence_ref or inward):
        # "Five Case for X using CPC evidence" → Five Case primary + capability readiness panel
        secondaries.append("cpc_capability_assessment")

    elif primary in ("cpc_capability_assessment", "cpc_opportunity_fit") and has_investment_ask:
        # "Is CPC ready to bid AND what's the public investment case?" → capability primary + five case panel
        secondaries.append("act")

    elif primary == "cpc_opportunity_fit" and not has_investment_ask:
        # Opportunity fit always benefits from showing evidence gaps alongside the quadrant
        secondaries.append("cpc_evidence_gaps")

    return primary, secondaries


# ---------------------------------------------------------------------------
# Confidence tier → 0-100 score
# ---------------------------------------------------------------------------

_TIER_SCORES: dict[str, int] = {
    "Speculative": 15,
    "Indicative":  42,
    "Supported":   68,
    "Robust":      90,
}


def _tier_score(tier: str) -> int:
    return _TIER_SCORES.get(tier, 30)


# ---------------------------------------------------------------------------
# Chart spec builders — one per visual family
# ---------------------------------------------------------------------------

# FIVE CASE RADAR -----------------------------------------------------------

_FIVE_CASE_AXES = [
    "Strategic Case",
    "Economic Case",
    "Commercial Case",
    "Financial Case",
    "Management Case",
]


def _five_case_radar(
    sections: dict[str, str],
    tier: str,
    section_scores: dict[str, int] | None = None,
) -> dict[str, Any]:
    """
    Radar chart: Five Case Model coverage, scored 0-100 per axis.

    Score priority:
      1. LLM self-assessment via section_scores (accurate, reflects content quality)
      2. Word-count heuristic (fallback — weaker, use only when LLM scores absent)
    """
    data = []

    if section_scores and all(ax in section_scores for ax in _FIVE_CASE_AXES):
        for axis in _FIVE_CASE_AXES:
            score = max(10, min(95, int(section_scores[axis])))
            data.append({"case": axis, "score": score})
    else:
        base = _tier_score(tier)
        word_counts = {
            k: len(str(v).split())
            for k, v in sections.items()
            if k in _FIVE_CASE_AXES
        }
        mean_wc = (sum(word_counts.values()) / len(word_counts)) if word_counts else 1
        for axis in _FIVE_CASE_AXES:
            if axis not in sections or not sections[axis]:
                score = 10
            else:
                wc = word_counts.get(axis, 0)
                ratio = wc / mean_wc if mean_wc > 0 else 1.0
                score = int(min(95, max(10, base + (ratio - 1.0) * 20)))
            data.append({"case": axis, "score": score})

    # "So what?" insight
    if data:
        weakest = min(data, key=lambda d: d["score"])
        strongest = max(data, key=lambda d: d["score"])
        if weakest["score"] < 35:
            insight = (
                f"{weakest['case'].replace(' Case', '')} case is critically weak "
                f"({weakest['score']}%) — address this before advancing the brief."
            )
        elif weakest["score"] < 55:
            insight = (
                f"{strongest['case'].replace(' Case', '')} case is strongest. "
                f"Prioritise enriching {weakest['case'].replace(' Case', '')} "
                f"to improve overall confidence."
            )
        else:
            insight = (
                f"All five cases score above 55% — balanced evidence base suitable "
                f"for {tier} tier submission."
            )
    else:
        insight = ""

    return {
        "type": "radar",
        "title": "Five Case Coverage",
        "axis": "case",
        "value": "score",
        "max": 100,
        "data": data,
        "insight": insight,
    }


# CONFIDENCE GAUGE ----------------------------------------------------------

_TIER_INSIGHTS: dict[str, str] = {
    "Speculative": "Thin evidence — indicative only. Do not cite in bids without further research.",
    "Indicative":  "Partial evidence — sufficient for exploratory discussion but not a formal bid.",
    "Supported":   "Good evidence base — suitable for programme-level submission with caveats noted.",
    "Robust":      "Strong corpus — ready to cite in competitive bids and policy submissions.",
}


def _confidence_gauge(tier: str, label: str | None = None) -> dict[str, Any]:
    """Gauge: confidence tier as 0-100 score."""
    return {
        "type": "gauge",
        "title": label or f"Confidence - {tier}",
        "value": _tier_score(tier),
        "data": [],
        "insight": _TIER_INSIGHTS.get(tier, ""),
    }


# EVIDENCE SCORES BAR -------------------------------------------------------

def _evidence_scores_bar(citations: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Bar chart: top citations sorted by similarity score."""
    if not citations:
        return None
    sorted_c = sorted(citations, key=lambda c: float(c.get("score", 0.0)), reverse=True)
    data = [
        {
            "source": (c.get("title") or "Unknown")[:35],
            "score": round(float(c.get("score", 0.0)) * 100),
        }
        for c in sorted_c[:8]
    ]
    top = data[0]["score"] if data else 0
    if top >= 80:
        insight = f"Top citation scores {top}% — high semantic match. These sources directly support the case."
    elif top >= 60:
        insight = f"Top citation at {top}% — moderate relevance. Review each for precision before citing in bids."
    else:
        insight = f"Top match only {top}% — evidence is tangentially related. Corpus enrichment recommended."
    return {
        "type": "bar",
        "title": "Evidence Similarity Scores",
        "x": "source",
        "y": "score",
        "data": data,
        "insight": insight,
    }


# EVIDENCE QUALITY PIE ------------------------------------------------------

_SOURCE_LABELS = {
    "project":        "R&D Projects",
    "live_call":      "Live Funding Calls",
    "knowledge_doc":  "Policy Documents",
    "knowledge_chunk":"Policy Documents",
    "hive_chunk":     "HIVE Case Studies",
    "hive_article":   "HIVE Case Studies",
}


def _evidence_quality_pie(citations: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Pie chart: evidence distribution by source type."""
    if not citations:
        return None
    counts: Counter[str] = Counter()
    for c in citations:
        raw = c.get("source_type", "project")
        label = _SOURCE_LABELS.get(str(raw), str(raw).replace("_", " ").title())
        counts[label] += 1
    if len(counts) < 2:
        return None
    data = [{"type": k, "count": v} for k, v in counts.most_common()]
    n_types = len(counts)
    if n_types >= 3:
        insight = f"{n_types} source types — diversified evidence base strengthens confidence tier."
    else:
        insight = "Two source types found. Adding policy docs or HIVE case studies would broaden the evidence base."
    return {
        "type": "pie",
        "title": "Evidence by Source Type",
        "x": "type",
        "y": "count",
        "data": data,
        "insight": insight,
    }


# NPV BAR -------------------------------------------------------------------

def _npv_bar(npv_value: float, optimism_bias: float | None) -> dict[str, Any]:
    """Bar chart: NPV decomposition at HMT STPR."""
    gross = abs(npv_value)
    bias_adj = gross * float(optimism_bias or 0.0)
    net = round(float(npv_value) / 1_000_000, 1)
    data = [
        {"component": "Gross Benefits",    "value_m": round(gross / 1_000_000, 1)},
        {"component": "Optimism Bias Adj", "value_m": round(bias_adj / 1_000_000, 1)},
        {"component": "Net Present Value", "value_m": net},
    ]
    if float(npv_value) > 0:
        insight = f"NPV is positive at £{net}m — investment delivers net public benefit at 3.5% STPR."
    else:
        insight = f"NPV is negative at £{net}m — economic case requires revision before formal appraisal."
    return {
        "type": "bar",
        "title": "NPV at 3.5% STPR (£m)",
        "x": "component",
        "y": "value_m",
        "data": data,
        "insight": insight,
    }


# EVIDENCE GAP BAR ----------------------------------------------------------

_GAP_SEVERITY_ORDER = {"high": 3, "medium": 2, "low": 1}


def _evidence_gap_bar(evidence_gaps: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Bar chart: evidence gaps grouped by severity."""
    if not evidence_gaps:
        return None
    counts: Counter[str] = Counter()
    for g in evidence_gaps:
        sev = str(g.get("severity", "low")).lower()
        counts[sev] += 1
    data = sorted(
        [{"severity": k, "count": v} for k, v in counts.items()],
        key=lambda d: _GAP_SEVERITY_ORDER.get(d["severity"], 0),
        reverse=True,
    )
    high = counts.get("high", 0)
    med = counts.get("medium", 0)
    if high > 0:
        insight = f"{high} high-severity gap{'s' if high > 1 else ''} — these block a Robust confidence rating and must be closed before bid."
    elif med > 0:
        insight = f"No critical gaps, but {med} medium-severity gap{'s' if med > 1 else ''} weaken the case. Address before formal submission."
    else:
        insight = "Only low-severity gaps remain — evidence base is solid for this query."
    return {
        "type": "bar",
        "title": "Evidence Gaps by Severity",
        "x": "severity",
        "y": "count",
        "data": data,
        "insight": insight,
    }


# LIVE CALLS RADIAL ---------------------------------------------------------

def _live_calls_radial(citations: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Radial-bar: live funding calls ranked by semantic fit score."""
    calls = [c for c in citations if c.get("source_type") == "live_call"]
    if not calls:
        return None
    sorted_calls = sorted(calls, key=lambda c: float(c.get("score", 0.0)), reverse=True)
    data = [
        {
            "call": (c.get("title") or "Call")[:40],
            "fit": round(float(c.get("score", 0.0)) * 100),
        }
        for c in sorted_calls[:6]
    ]
    n_strong = sum(1 for d in data if d["fit"] >= 70)
    top_fit = data[0]["fit"] if data else 0
    if n_strong > 0:
        insight = f"{n_strong} call{'s' if n_strong > 1 else ''} at 70%+ fit — prioritise these for bid preparation."
    else:
        insight = f"Top call fit is {top_fit}% — below 70% threshold. Enrich evidence before submitting to any call."
    return {
        "type": "radial-bar",
        "title": "Live Call Fit Scores",
        "x": "call",
        "y": "fit",
        "data": data,
        "insight": insight,
    }


# EVIDENCE HEATMAP (source_type × tier) -------------------------------------

def _evidence_heatmap(citations: list[dict[str, Any]], tier: str) -> dict[str, Any] | None:
    """
    Heatmap: evidence density by source_type × confidence tier bucket.
    Approximates tier distribution: top-third of scores = Supported,
    middle = Indicative, bottom = Speculative.
    """
    if len(citations) < 4:
        return None

    sorted_c = sorted(citations, key=lambda c: float(c.get("score", 0.0)), reverse=True)
    n = len(sorted_c)
    tier_buckets: dict[tuple[str, str], int] = {}

    for i, c in enumerate(sorted_c):
        src = _SOURCE_LABELS.get(str(c.get("source_type", "project")), "Other")
        if i < n // 3:
            t = "Supported"
        elif i < 2 * n // 3:
            t = "Indicative"
        else:
            t = "Speculative"
        tier_buckets[(src, t)] = tier_buckets.get((src, t), 0) + 1

    data = [
        {"source_type": src, "tier": t, "count": cnt}
        for (src, t), cnt in tier_buckets.items()
    ]
    if len(data) < 4:
        return None

    return {
        "type": "heatmap",
        "title": "Evidence Coverage Matrix",
        "x": "source_type",
        "y": "tier",
        "value": "count",
        "data": data,
        "insight": "Gaps in the Supported/Robust rows show where corpus enrichment would most lift confidence.",
    }


# FUNDING FLOW SANKEY -------------------------------------------------------

def _build_sankey_flows(citations: list[dict[str, Any]]) -> list[dict[str, Any]] | None:
    """
    Build sankey flow rows: funder/org → evidence-type target.

    Works with live calls (funder), corpus projects (organisation), and
    CPC internal rows — so Connect runs are not blocked when live_calls = 0.
    """
    flow: dict[tuple[str, str], int] = {}

    for c in citations:
        st = c.get("source_type") or "project"
        if st == "live_call":
            funder = str(c.get("funder") or "Unknown funder").strip()[:30]
            if funder:
                key = (funder, "Live funding calls")
                flow[key] = flow.get(key, 0) + 1
        elif st == "project":
            org = str(
                c.get("organisation") or c.get("lead_org_name") or ""
            ).strip()[:30]
            if org:
                key = (org, "Corpus projects")
                flow[key] = flow.get(key, 0) + 1
        elif st in ("cpc_internal", "cpc_claim"):
            bu = str(
                c.get("business_unit") or c.get("organisation") or "CPC internal"
            ).strip()[:30]
            key = (bu, "CPC capability evidence")
            flow[key] = flow.get(key, 0) + 1

    if len(flow) < 3 or sum(flow.values()) < 3:
        return None

    return [
        {"source": src, "target": tgt, "value": cnt}
        for (src, tgt), cnt in sorted(flow.items(), key=lambda x: -x[1])
    ]


def _funding_flow_sankey(citations: list[dict[str, Any]]) -> dict[str, Any] | None:
    """
    Sankey chart_spec (legacy chart_specs path).

    Only generated when enough funder/org → type flows exist.
    """
    flows = _build_sankey_flows(citations)
    if not flows:
        return None

    n_funders = sum(
        1 for c in citations
        if c.get("source_type") == "live_call" and c.get("funder")
    )
    insight = (
        f"{n_funders} funder{'s' if n_funders != 1 else ''} map to your evidence profile — "
        "follow the thickest flows to prioritise bid activity."
        if n_funders
        else "Organisation and evidence-type flows — follow the thickest paths for bid priority."
    )
    return {
        "type": "sankey",
        "title": "Evidence Flow - Funder to Type",
        "source": "source",
        "target": "target",
        "value": "value",
        "data": flows,
        "insight": insight,
    }


# COVERAGE SCORE GAUGE ------------------------------------------------------

def _coverage_gauge(evidence_gaps: list[dict[str, Any]], tier: str) -> dict[str, Any]:
    """
    Gauge: evidence coverage score.
    Base = tier score; penalised by -8 per high-severity gap and -3 per medium.
    """
    base = _tier_score(tier)
    high = sum(1 for g in evidence_gaps if str(g.get("severity", "")).lower() == "high")
    med  = sum(1 for g in evidence_gaps if str(g.get("severity", "")).lower() == "medium")
    score = max(10, base - high * 8 - med * 3)
    if score >= 70:
        cov_insight = "Good coverage — evidence base is sufficient for programme-level engagement."
    elif score >= 40:
        cov_insight = "Partial coverage — address high-severity gaps before advancing to formal bid."
    else:
        cov_insight = "Poor coverage — significant enrichment needed before this query is bid-ready."
    return {
        "type": "gauge",
        "title": "Evidence Coverage Score",
        "value": score,
        "data": [],
        "insight": cov_insight,
    }


# ---------------------------------------------------------------------------
# Main entry point
# ---------------------------------------------------------------------------

def build_chart_specs(
    query: str,
    verified: list[dict[str, Any]],
    sections: dict[str, str],
    confidence_tier: str,
    npv_value: float | None,
    optimism_bias: float | None,
    evidence_gaps: list[dict[str, Any]],
    section_scores: dict[str, int] | None = None,
    recipe_override: str | None = None,
) -> tuple[str, list[dict[str, Any]]]:
    """
    Select the correct recipe and build intent-appropriate chart_specs.

    Returns:
        (recipe_id, chart_specs)  — both are set on artifact_block.

    recipe_override: when provided (set by select_recipe_intent node), skip query
        re-classification and use this recipe directly. Ensures the node that
        selected the recipe is the single authoritative source of truth.
    section_scores: LLM self-assessed evidence strength per Five Case section (0-100).
        When provided, replaces the word-count heuristic in _five_case_radar().

    Recipe routing mirrors the AGENT_DESCRIPTIONS table in dashboard.tsx.
    Chart selection mirrors selectVisuals() in visual-recipe-director.ts.
    """
    recipe = recipe_override if recipe_override else select_recipe(query)
    intent = classify_intent(query)

    specs: list[dict[str, Any]] = []

    # ── brief_five_case ─────────────────────────────────────────────────────
    if recipe == "brief_five_case":
        # Primary: Radar — Five Case coverage (shows which case is strongest/weakest)
        if all(k in sections for k in _FIVE_CASE_AXES[:3]):
            specs.append(_five_case_radar(sections, confidence_tier, section_scores))

        # Supporting: Confidence gauge
        specs.append(_confidence_gauge(confidence_tier))

        # Supporting: NPV decomposition (only when available)
        if npv_value is not None:
            specs.append(_npv_bar(npv_value, optimism_bias))

        # Supporting: Evidence scores bar (top citations)
        bar = _evidence_scores_bar(verified)
        if bar:
            specs.append(bar)

        # Supporting: Evidence quality pie (when diverse sources available)
        pie = _evidence_quality_pie(verified)
        if pie:
            specs.append(pie)

        return recipe, specs

    # ── cpc_evidence_gaps ───────────────────────────────────────────────────
    if recipe == "cpc_evidence_gaps":
        # Primary: gap severity bar
        gap_bar = _evidence_gap_bar(evidence_gaps)
        if gap_bar:
            specs.append(gap_bar)

        # Coverage gauge
        specs.append(_coverage_gauge(evidence_gaps, confidence_tier))

        # Evidence quality pie
        pie = _evidence_quality_pie(verified)
        if pie:
            specs.append(pie)

        # Evidence scores bar as supporting
        bar = _evidence_scores_bar(verified)
        if bar:
            specs.append(bar)

        return recipe, specs

    # ── cpc_market_alignment ────────────────────────────────────────────────
    if recipe == "cpc_market_alignment":
        # Primary: live calls radial (fit scores ranked)
        radial = _live_calls_radial(verified)
        if radial:
            specs.append(radial)
        else:
            # Fallback: evidence scores bar
            bar = _evidence_scores_bar(verified)
            if bar:
                specs.append(bar)

        # Supporting: confidence gauge
        specs.append(_confidence_gauge(confidence_tier, "Corpus Alignment Score"))

        # Supporting: evidence quality pie
        pie = _evidence_quality_pie(verified)
        if pie:
            specs.append(pie)

        return recipe, specs

    # ── cpc_funding_flow ────────────────────────────────────────────────────
    if recipe == "cpc_funding_flow":
        # Primary: Sankey (evidence flow)
        sankey = _funding_flow_sankey(verified)
        if sankey:
            specs.append(sankey)

        # Supporting: evidence quality pie (stacked breakdown)
        pie = _evidence_quality_pie(verified)
        if pie:
            specs.append(pie)

        # Supporting: confidence gauge
        specs.append(_confidence_gauge(confidence_tier))

        return recipe, specs

    # ── cpc_portfolio_comparison ────────────────────────────────────────────
    if recipe == "cpc_portfolio_comparison":
        # Evidence heatmap (source × tier density)
        hm = _evidence_heatmap(verified, confidence_tier)
        if hm:
            specs.append(hm)

        # Evidence scores bar
        bar = _evidence_scores_bar(verified)
        if bar:
            specs.append(bar)

        # Confidence gauge
        specs.append(_confidence_gauge(confidence_tier))

        return recipe, specs

    # ── cpc_capability_assessment (and any other CPC-inward) ────────────────
    # Primary: confidence gauge (capability readiness)
    specs.append(_confidence_gauge(confidence_tier, "Capability Readiness"))

    # Evidence scores bar
    bar = _evidence_scores_bar(verified)
    if bar:
        specs.append(bar)

    # Evidence quality pie
    pie = _evidence_quality_pie(verified)
    if pie:
        specs.append(pie)

    return recipe, specs


# ---------------------------------------------------------------------------
# Art Director — build_visual_blocks
#
# Produces visual_blocks[] for the new block vocabulary system.
# Called from verify_citations alongside build_chart_specs.
# Each block type matches a BLOCK_VOCABULARY entry in block-vocabulary.ts.
# Rules mirror skills/data-visualization.md > Default Visual Per Surface Intent.
# ---------------------------------------------------------------------------

# Orient: show heatmap + graph together only when corpus is rich (≥8 sources)
_ORIENT_RICH_CORPUS = 8
# Knowledge graph: lowered from 6 → 4 citations (Sprint 3)
_ORIENT_GRAPH_MIN_CITATIONS = 4


def _enrich_citations(
    verified: list[dict[str, Any]],
    raw_search_results: list[dict[str, Any]] | None,
) -> list[dict[str, Any]]:
    """Merge raw search metadata (source_type, funder) into verified citations."""
    if not raw_search_results:
        return verified
    by_id = {str(r["id"]): r for r in raw_search_results if r.get("id")}
    enriched: list[dict[str, Any]] = []
    for c in verified:
        base = by_id.get(str(c.get("id")), {})
        merged = {**base, **c}
        merged["organisation"] = (
            c.get("organisation")
            or base.get("organisation")
            or base.get("lead_org_name")
            or ""
        )
        merged["source_type"] = c.get("source_type") or base.get("source_type") or "project"
        if base.get("funder"):
            merged["funder"] = base.get("funder")
        if base.get("business_unit"):
            merged["business_unit"] = base.get("business_unit")
        enriched.append(merged)
    return enriched


def _vb_domain_heatmap(verified: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Group verified citations by organisation → domain_heatmap block."""
    counts: dict[str, int] = {}
    scores: dict[str, list[float]] = {}
    for c in verified:
        org = (c.get("organisation") or c.get("publisher") or "").strip()
        if not org:
            continue
        counts[org] = counts.get(org, 0) + 1
        scores.setdefault(org, []).append(float(c.get("score", 0.5)))

    domains = sorted(
        [
            {
                "domain": org,
                "project_count": cnt,
                "avg_score": round(sum(scores[org]) / len(scores[org]), 2),
            }
            for org, cnt in counts.items()
        ],
        key=lambda d: -d["project_count"],
    )[:8]

    if len(domains) < 3:
        return None

    return {
        "type": "domain_heatmap",
        "title": f"Evidence density across {len(domains)} organisations",
        "data": {"domains": domains},
        "source_count": len(verified),
    }


def _vb_knowledge_graph(verified: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Build knowledge_graph block from citation org/funder ↔ project links."""
    if len(verified) < 3:
        return None

    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []
    org_to_node: dict[str, str] = {}

    for i, c in enumerate(verified[:12]):
        node_id = f"p{i}"
        title = (c.get("title") or "")[:40]
        nodes.append({
            "id": node_id,
            "label": title,
            "group": "project",
            "value": max(3, int(float(c.get("score", 0.5)) * 10)),
        })
        org = (
            c.get("organisation")
            or c.get("funder")
            or c.get("publisher")
            or c.get("business_unit")
            or ""
        ).strip()
        if org and org not in org_to_node:
            org_node_id = f"o{len(org_to_node)}"
            org_to_node[org] = org_node_id
            nodes.append({
                "id": org_node_id,
                "label": org[:30],
                "group": "funder",
                "value": 6,
            })
        if org and org in org_to_node:
            edges.append({"source": org_to_node[org], "target": node_id, "weight": 0.7})

    if len(edges) < 2:
        return None

    return {
        "type": "knowledge_graph",
        "title": "Who connects to what in this evidence set",
        "data": {"nodes": nodes, "edges": edges},
        "source_count": len(verified),
    }


def _vb_sankey(verified: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Sankey visual block — funding / org → evidence-type flows."""
    flows = _build_sankey_flows(verified)
    if not flows:
        return None
    n_live = sum(1 for c in verified if c.get("source_type") == "live_call")
    title = (
        "Funding flows into live opportunities"
        if n_live >= 2
        else "Evidence flows across organisations and types"
    )
    return {
        "type": "sankey",
        "title": title,
        "data": {"flows": flows},
        "source_count": len(verified),
    }


def _vb_evidence_bar(verified: list[dict[str, Any]], max_items: int = 8) -> dict[str, Any] | None:
    """Top-scored verified citations → evidence_bar block."""
    items = []
    for c in sorted(verified, key=lambda x: x.get("score", 0), reverse=True)[:max_items]:
        items.append({
            "label": (c.get("title") or "Unknown")[:55],
            "value": round(float(c.get("score", 0.5)) * 100),
            "claim_state": c.get("claim_state", "unknown"),
        })
    if len(items) < 3:
        return None
    return {
        "type": "evidence_bar",
        "title": f"Top {len(items)} sources by relevance",
        "data": {"items": items},
        "source_count": len(verified),
    }


def _vb_radar(
    sections: dict[str, str],
    tier: str,
    section_scores: dict[str, int] | None,
) -> dict[str, Any]:
    """Five Case Model coverage → radar block."""
    AXES = ["Strategic Case", "Economic Case", "Commercial Case", "Financial Case", "Management Case"]
    dims = []
    for ax in AXES:
        if section_scores and ax in section_scores:
            score = max(10, min(95, int(section_scores[ax])))
        elif ax in sections and sections[ax]:
            wc = len(str(sections[ax]).split())
            base = _TIER_SCORES.get(tier, 30)
            score = int(min(95, max(10, base + min(30, wc // 25))))
        else:
            score = 10
        dims.append({"dimension": ax, "score": score})

    weakest = min(dims, key=lambda d: d["score"])
    insight = (
        f"{weakest['dimension'].replace(' Case', '')} case is weakest at "
        f"{weakest['score']}% — prioritise enrichment."
        if weakest["score"] < 50
        else f"Balanced evidence base at {tier} tier."
    )
    return {
        "type": "radar",
        "title": "Five Case Model coverage",
        "data": {"dimensions": dims, "insight": insight},
    }


def _vb_npv_waterfall(npv: float, discount_rate: float) -> dict[str, Any]:
    """NPV decomposition → npv_waterfall block."""
    gross = abs(npv) * 1.35
    costs = gross - npv
    return {
        "type": "npv_waterfall",
        "title": f"NPV: £{round(npv / 1e6, 1)}m @ {round(discount_rate * 100, 1)}% STPR",
        "data": {
            "components": [
                {"label": "Total Benefits", "value": round(gross / 1e6, 1), "type": "positive"},
                {"label": "Costs", "value": round(-costs / 1e6, 1), "type": "negative"},
                {"label": "Net Present Value", "value": round(npv / 1e6, 1), "type": "total"},
            ],
            "discount_rate": discount_rate,
        },
    }


def _vb_gap_matrix(gaps: list[dict[str, Any]]) -> dict[str, Any] | None:
    """Evidence/routing gaps → gap_matrix block."""
    rows = []
    for g in gaps[:8]:
        if not isinstance(g, dict):
            continue
        severity = str(g.get("severity", "medium")).lower()
        fit = "Gap" if severity == "high" else "Partial" if severity == "medium" else "Met"
        rows.append({
            "criterion": g.get("area") or g.get("topic") or "Unknown",
            "response": g.get("description") or g.get("reason") or "",
            "claim_state": "unknown" if severity == "high" else "inferred",
            "fit": fit,
            "evidence_strength": "None" if severity == "high" else "Weak",
            "action": g.get("recommended_action") or "",
        })
    if not rows:
        return None
    gaps_count = sum(1 for r in rows if r["fit"] == "Gap")
    return {
        "type": "gap_matrix",
        "title": f"{gaps_count} critical gap{'s' if gaps_count != 1 else ''}" if gaps_count else "Evidence gap analysis",
        "data": {"rows": rows},
    }


def build_visual_blocks(
    recipe_id: str,
    verified: list[dict[str, Any]],
    sections: dict[str, str],
    confidence_tier: str,
    npv_value: float | None,
    discount_rate: float,
    evidence_gaps: list[dict[str, Any]],
    section_scores: dict[str, int] | None = None,
    raw_search_results: list[dict[str, Any]] | None = None,
) -> list[dict[str, Any]]:
    """
    Art Director — deterministic visual block selection.

    Produces visual_blocks[] matching BLOCK_VOCABULARY types in block-vocabulary.ts.
    Rules are the Python mirror of skills/data-visualization.md default-per-surface table.
    No LLM call — pure data-shape inspection.
    """
    blocks: list[dict[str, Any]] = []
    cites = _enrich_citations(verified, raw_search_results)

    if recipe_id in ("brief_five_case", "act"):
        if any(k in sections for k in _FIVE_CASE_AXES[:3]):
            blocks.append(_vb_radar(sections, confidence_tier, section_scores))
        if npv_value is not None:
            blocks.append(_vb_npv_waterfall(npv_value, discount_rate))

    elif recipe_id == "orient":
        heatmap = _vb_domain_heatmap(cites)
        if heatmap:
            blocks.append(heatmap)
        # Graph at ≥4 citations; both heatmap + graph only when corpus is rich (≥8)
        show_graph = len(cites) >= _ORIENT_GRAPH_MIN_CITATIONS
        if heatmap and len(cites) < _ORIENT_RICH_CORPUS:
            show_graph = False
        if show_graph:
            graph = _vb_knowledge_graph(cites)
            if graph:
                blocks.append(graph)
        if not blocks:
            bar = _vb_evidence_bar(cites)
            if bar:
                blocks.append(bar)

    elif recipe_id in ("diagnose", "cpc_evidence_gaps"):
        gap_block = _vb_gap_matrix(evidence_gaps)
        if gap_block:
            blocks.append(gap_block)
        bar = _vb_evidence_bar(cites)
        if bar:
            blocks.append(bar)

    elif recipe_id in ("defend", "cpc_defend"):
        bar = _vb_evidence_bar(cites)
        if bar:
            blocks.append(bar)

    elif recipe_id in ("connect", "cpc_opportunity_fit", "cpc_market_alignment", "cpc_funding_flow"):
        sankey = _vb_sankey(cites)
        if sankey:
            blocks.append(sankey)
        bar = _vb_evidence_bar(cites)
        if bar:
            blocks.append(bar)

    elif recipe_id in ("cpc_capability_assessment", "cpc_portfolio_comparison"):
        heatmap = _vb_domain_heatmap(cites)
        if heatmap:
            blocks.append(heatmap)
        elif len(cites) >= _ORIENT_GRAPH_MIN_CITATIONS:
            graph = _vb_knowledge_graph(cites)
            if graph:
                blocks.append(graph)
        else:
            bar = _vb_evidence_bar(cites)
            if bar:
                blocks.append(bar)

    else:
        bar = _vb_evidence_bar(cites)
        if bar:
            blocks.append(bar)

    return blocks
