"""
Atlas 5 — Recipe routing stress test.

Tests that classify_intent + is_cpc_inward + select_recipe route each query
to the correct recipe, without running the full LLM pipeline.

Run from atlas5-clone-dashboard/:
    python agents/test_recipe_routing.py
"""

from __future__ import annotations

import sys
from pathlib import Path

_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_root))

from agents.visual_recipe_director import classify_intent, is_cpc_inward, select_recipe, _BID_DECISION

PASS = "[PASS]"
FAIL = "[FAIL]"
_results: list[tuple[str, bool, str]] = []


def check(label: str, ok: bool, note: str = "") -> bool:
    status = PASS if ok else FAIL
    print(f"  {status}  {label}" + (f"  [{note}]" if note else ""))
    _results.append((label, ok, note))
    return ok


def section(title: str) -> None:
    print(f"\n{'-' * 64}")
    print(f"  {title}")
    print(f"{'-' * 64}")


# ---------------------------------------------------------------------------
# S1 — Outward-facing (investment appraisal)
# ---------------------------------------------------------------------------

def s1_outward_investment() -> None:
    section("S1 — Outward investment appraisal -> act")

    cases = [
        "What is the strategic case for EV charging on UK motorways?",
        "Build a Five Case investment brief for smart pedestrian crossings",
        "What is the NPV at 3.5% STPR for autonomous freight corridors?",
        "Make the case for a national hydrogen refuelling network",
        "Investment brief for MaaS in mid-sized English cities",
    ]
    for q in cases:
        r = select_recipe(q)
        check(f"outward: {q[:60]}", r == "act", f"got={r}")


# ---------------------------------------------------------------------------
# S2 — CPC inward: capability
# ---------------------------------------------------------------------------

def s2_cpc_capability() -> None:
    section("S2 — CPC capability queries -> any CPC-inward recipe")

    # These queries are inward-facing; the exact CPC recipe varies by phrasing.
    # "strongest across portfolio" correctly routes to portfolio_comparison;
    # "weakest evidence areas" correctly routes to evidence_gaps.
    # The critical invariant is that they are CPC-inward and NOT brief_five_case.
    cases = [
        "What can CPC evidence support in transport decarbonisation?",
        "Where is CPC strongest across our portfolio?",
        "What are CPC's weakest evidence areas?",
        "Where does CPC have the most evidence?",
        "What is CPC capable of evidencing for a climate adaptation bid?",
    ]
    _CPC_INWARD_RECIPES = {
        "cpc_capability_assessment", "cpc_portfolio_comparison",
        "cpc_evidence_gaps", "cpc_market_alignment",
        "cpc_opportunity_fit", "cpc_funding_flow",
    }
    for q in cases:
        inward = is_cpc_inward(q)
        r = select_recipe(q)
        check(
            f"capability: {q[:60]}",
            inward and r in _CPC_INWARD_RECIPES,
            f"inward={inward}, recipe={r}",
        )


# ---------------------------------------------------------------------------
# S3 — CPC inward: portfolio comparison
# ---------------------------------------------------------------------------

def s3_cpc_portfolio() -> None:
    section("S3 — CPC portfolio queries -> cpc_portfolio_comparison")

    cases = [
        "Compare CPC business units by evidence strength",
        "Which CPC business units are evidence-ready for bids?",
        "Show me the CPC portfolio overview across all themes",
        "Rank our business units by corpus coverage",
        "Which CPC domain has the most L3 claims?",
    ]
    for q in cases:
        inward = is_cpc_inward(q)
        r = select_recipe(q)
        check(
            f"portfolio: {q[:60]}",
            inward and r == "cpc_portfolio_comparison",
            f"inward={inward}, recipe={r}",
        )


# ---------------------------------------------------------------------------
# S4 — CPC inward: market alignment / live calls
# ---------------------------------------------------------------------------

def s4_cpc_market() -> None:
    section("S4 — Market alignment queries -> cpc_market_alignment")

    cases = [
        "Which live funding calls match CPC's evidence base?",
        "Which Innovate UK calls align with our transport corpus?",
        "What funding calls should CPC be looking at this quarter?",
        "Match our portfolio against active UKRI calls",
    ]
    for q in cases:
        inward = is_cpc_inward(q)
        r = select_recipe(q)
        check(
            f"market: {q[:60]}",
            inward and r in ("cpc_market_alignment", "cpc_opportunity_fit"),
            f"inward={inward}, recipe={r}",
        )


# ---------------------------------------------------------------------------
# S5 — Opportunity fit (trade-off quadrant)
# ---------------------------------------------------------------------------

def s5_opportunity_fit() -> None:
    section("S5 — Opportunity fit / quadrant -> cpc_opportunity_fit")

    cases = [
        "High fit but weak evidence — which calls are worth enriching for?",
        "Which calls are worth bidding on vs which need more evidence first?",
        "Should CPC bid on the Innovate UK net-zero transport call?",
        "Which opportunities are bid-ready vs need enrichment?",
        "Trade-off between fit and evidence strength for live calls",
    ]
    for q in cases:
        r = select_recipe(q)
        inward = is_cpc_inward(q)
        ok = r == "cpc_opportunity_fit" if inward or _BID_DECISION.search(q) else r == "connect"
        check(
            f"opp-fit: {q[:60]}",
            ok,
            f"recipe={r}, inward={inward}",
        )


# ---------------------------------------------------------------------------
# S6 — Evidence gaps
# ---------------------------------------------------------------------------

def s6_evidence_gaps() -> None:
    section("S6 — Evidence gaps -> cpc_evidence_gaps")

    cases = [
        "What evidence gaps exist in CPC's climate adaptation portfolio?",
        "Where is our evidence thin for Innovate UK bids?",
        "What should CPC enrich to be more competitive?",
        "Which areas have missing or sparse evidence?",
        "Gap analysis on CPC's transport decarbonisation coverage",
    ]
    for q in cases:
        inward = is_cpc_inward(q)
        r = select_recipe(q)
        check(
            f"gaps: {q[:60]}",
            inward and r == "cpc_evidence_gaps",
            f"inward={inward}, recipe={r}",
        )


# ---------------------------------------------------------------------------
# S7 — Funding flow
# ---------------------------------------------------------------------------

def s7_funding_flow() -> None:
    section("S7 — Funding flow -> cpc_funding_flow")

    cases = [
        "Where is funding flowing in UK urban mobility?",
        "Show me the funding landscape for transport innovation",
        "Which funders are backing autonomous vehicle research?",
        "How does UKRI funding move through the transport ecosystem?",
        "Funding pathway for net-zero freight",
    ]
    for q in cases:
        r = select_recipe(q)
        check(
            f"flow: {q[:60]}",
            r == "cpc_funding_flow",
            f"recipe={r}",
        )


# ---------------------------------------------------------------------------
# S8 — Conversational / off-domain (should not trigger pipeline)
# ---------------------------------------------------------------------------

def s8_conversational() -> None:
    section("S8 — Conversational / off-domain -> not CPC-inward")

    cases = [
        ("hello", False),
        ("what is 2+2?", False),
        ("thanks!", False),
        ("good morning", False),
        ("can you help me?", False),
    ]
    for q, expected_inward in cases:
        inward = is_cpc_inward(q)
        check(
            f"conversational: '{q}'",
            inward == expected_inward,
            f"inward={inward}",
        )


# ---------------------------------------------------------------------------
# S9 — Boundary / ambiguous queries (regression)
# ---------------------------------------------------------------------------

def s9_boundary() -> None:
    section("S9 — Boundary cases (regression)")

    # These should NOT route to brief_five_case by mistake
    inward_should_not_be_five_case = [
        "Where is CPC strongest?",
        "Which business units are evidence-ready?",
        "Compare CPC business units",
        "CPC evidence for smart cities — where are the gaps?",
        "Which CPC projects support a climate resilience bid?",
    ]
    for q in inward_should_not_be_five_case:
        r = select_recipe(q)
        check(
            f"not act: {q[:60]}",
            r != "act",
            f"got={r}",
        )

    # These SHOULD route to act (explicit investment appraisal)
    outward_act = [
        "Build a business case for drone delivery corridors",
        "What is the strategic case for a UK national digital twin?",
        "Investment brief for urban air mobility in London",
    ]
    for q in outward_act:
        r = select_recipe(q)
        check(
            f"act confirmed: {q[:60]}",
            r == "act",
            f"got={r}",
        )


# ---------------------------------------------------------------------------
# S10 — Intent classification sanity checks
# ---------------------------------------------------------------------------

def s10_intent_classification() -> None:
    section("S10 — Intent classification sanity checks")

    intent_cases = [
        ("Where does CPC evidence overlap with net-zero transport?",    "overlap_intersection"),
        ("Funding pathway for electric buses",                          "flow_pathway"),
        ("High fit but weak evidence — best call to bid?",              "trade_off_quadrant"),
        ("Where is evidence thin for MaaS claims?",                    "evidence_coverage"),
        ("How bid-ready is CPC for autonomous vehicle calls?",          "readiness_maturity"),
        ("How has CPC's evidence base grown over the last three years?","timeline_change"),
        ("Show me CPC's full portfolio overview",                       "portfolio_audit"),
        ("Which live calls match our transport corpus?",                "market_alignment"),
        ("How reliable is CPC's smart city evidence?",                  "evidence_quality"),
        ("Which CPC domain has the most projects?",                     "comparison_ranking"),
    ]
    for q, expected in intent_cases:
        got = classify_intent(q)
        check(
            f"intent '{expected}': {q[:55]}",
            got == expected,
            f"expected={expected}, got={got}",
        )


# ---------------------------------------------------------------------------
# Entrypoint
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    s1_outward_investment()
    s2_cpc_capability()
    s3_cpc_portfolio()
    s4_cpc_market()
    s5_opportunity_fit()
    s6_evidence_gaps()
    s7_funding_flow()
    s8_conversational()
    s9_boundary()
    s10_intent_classification()

    total  = len(_results)
    passed = sum(1 for _, ok, _ in _results if ok)
    failed = total - passed

    print(f"\n{'=' * 64}")
    print(f"  Results: {passed}/{total} passed" + (f"  ({failed} FAILED)" if failed else ""))
    print(f"{'=' * 64}\n")

    if failed:
        print("  Failures:")
        for name, ok, note in _results:
            if not ok:
                print(f"    FAIL {name}  [{note}]")
        print()

    sys.exit(0 if passed == total else 1)
