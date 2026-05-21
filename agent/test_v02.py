"""
Atlas v0.2 Hardening Validation
Checks H1 (citation verifier), H2 (confidence ceiling), H4 (corpus stats).
Run from agent/ directory:  python test_v02.py
Requires POSTGRES_URL and OPENAI_API_KEY in .env (or environment).
"""
from dotenv import load_dotenv
load_dotenv()

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from tools import _cap_tier, _verify_citation
from corpus_queries import get_corpus_stats, evidence_coverage_summary, _query

PASS = "PASS"
FAIL = "FAIL"
errors: list[str] = []


def check(label: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  {PASS} {label}" + (f" — {detail}" if detail else ""))
    else:
        msg = f"  {FAIL} FAIL: {label}" + (f" — {detail}" if detail else "")
        print(msg)
        errors.append(msg)


# ---------------------------------------------------------------------------
# H2: _cap_tier logic
# ---------------------------------------------------------------------------
print("\n=== H2: Confidence ceiling (_cap_tier) ===")

check("Robust capped at Indicative ceiling",
      _cap_tier("Robust", "Indicative") == "Indicative")
check("Indicative not inflated to Robust ceiling",
      _cap_tier("Indicative", "Robust") == "Indicative")
check("Equal tiers unchanged",
      _cap_tier("Supported", "Supported") == "Supported")
check("Speculative stays below Robust ceiling",
      _cap_tier("Speculative", "Robust") == "Speculative")
check("Robust stays at Robust ceiling",
      _cap_tier("Robust", "Robust") == "Robust")


# ---------------------------------------------------------------------------
# H2: evidence_coverage_summary tier thresholds
# ---------------------------------------------------------------------------
print("\n=== H2: evidence_coverage_summary tier thresholds ===")

r = evidence_coverage_summary([])
check("Empty -> Speculative", r["suggested_confidence_tier"] == "Speculative")

r = evidence_coverage_summary([{"source_type": "project", "similarity": 0.5}])
check("1 weak result -> Speculative", r["suggested_confidence_tier"] == "Speculative")

r = evidence_coverage_summary([
    {"source_type": "project", "similarity": 0.7},
    {"source_type": "project", "similarity": 0.65},
])
check("2 results, 1 source -> Indicative", r["suggested_confidence_tier"] == "Indicative")

r = evidence_coverage_summary([
    {"source_type": "project", "similarity": 0.8},
    {"source_type": "live_call", "similarity": 0.75},
    {"source_type": "knowledge_doc", "similarity": 0.7},
])
check("3 results, 3 sources -> Supported", r["suggested_confidence_tier"] == "Supported")

r = evidence_coverage_summary([
    {"source_type": "project", "similarity": 0.85},
    {"source_type": "live_call", "similarity": 0.82},
    {"source_type": "knowledge_doc", "similarity": 0.81},
    {"source_type": "hive_chunk", "similarity": 0.80},
    {"source_type": "project", "similarity": 0.79},
])
check("5 results, 4 sources, high sim -> Robust",
      r["suggested_confidence_tier"] == "Robust")

# Also test with "score" key (verified citations use score)
r = evidence_coverage_summary([
    {"source_type": "project", "score": 0.85},
    {"source_type": "live_call", "score": 0.82},
    {"source_type": "knowledge_doc", "score": 0.81},
    {"source_type": "hive_chunk", "score": 0.80},
    {"source_type": "project", "score": 0.79},
])
check("score key accepted (verified citation format) -> Robust",
      r["suggested_confidence_tier"] == "Robust")


# ---------------------------------------------------------------------------
# H4: get_corpus_stats — real table counts
# ---------------------------------------------------------------------------
print("\n=== H4: get_corpus_stats — real table counts ===")

try:
    stats = get_corpus_stats()
    check("Returns non-empty dict", bool(stats))
    check("projects_total present", "projects_total" in stats)
    pt = stats.get("projects_total", 0)
    check(f"projects_total={pt} is NOT ~2847 (was live_calls bug)",
          pt < 1500, f"actual={pt}")
    check(f"projects_total={pt} > 0",
          pt > 0)
    lct = stats.get("live_calls_total", 0)
    check(f"live_calls_total={lct} > 0", lct > 0)
    kct = stats.get("knowledge_chunks_total", 0)
    check(f"knowledge_chunks_total={kct} > 0", kct > 0)
    print(f"  Stats: projects={pt}, live_calls={lct}, "
          f"knowledge_chunks={kct}, "
          f"hive_chunks={stats.get('hive_chunks_total', '?')}")
except Exception as e:
    errors.append(f"  {FAIL} get_corpus_stats raised: {e}")
    print(f"  {FAIL} get_corpus_stats raised: {e}")


# ---------------------------------------------------------------------------
# H1: _verify_citation — real UUID + fabricated UUID
# ---------------------------------------------------------------------------
print("\n=== H1: _verify_citation — DB lookup ===")

try:
    # Get a real project UUID
    rows = _query("SELECT id FROM atlas.projects WHERE embedding IS NOT NULL LIMIT 1")
    if not rows:
        print("  SKIP: no projects in DB")
    else:
        real_id = str(rows[0]["id"])
        result = _verify_citation({"id": real_id, "source_type": "project", "score": 0.85})
        check("Real project UUID verified", result is not None)
        if result:
            check("Verified result has 'id'", "id" in result)
            check("Verified result has 'score'", "score" in result)
            check("Verified result has 'similarity'", "similarity" in result)
            check("Verified result has 'title'", "title" in result)
            check(f"ID matches: {real_id[:8]}...",
                  result["id"] == real_id)

    # Fabricated UUID must be rejected
    fake = _verify_citation({
        "id": "00000000-0000-0000-0000-000000000000",
        "source_type": "project",
        "title": "Fabricated Project",
        "score": 0.99,
    })
    check("Fabricated UUID rejected (returns None)", fake is None)

    # Unknown source_type must be rejected
    unknown = _verify_citation({
        "id": real_id if rows else "00000000-0000-0000-0000-000000000000",
        "source_type": "unknown_type",
        "score": 0.5,
    })
    check("Unknown source_type rejected", unknown is None)

    # Live call verification
    lc_rows = _query("SELECT id FROM atlas.live_calls LIMIT 1")
    if lc_rows:
        lc_id = str(lc_rows[0]["id"])
        lc_result = _verify_citation({"id": lc_id, "source_type": "live_call", "score": 0.7})
        check(f"Real live_call UUID verified", lc_result is not None)

    # Knowledge chunk verification
    kc_rows = _query(
        "SELECT id FROM atlas.knowledge_chunks WHERE embedding IS NOT NULL LIMIT 1"
    )
    if kc_rows:
        kc_id = str(kc_rows[0]["id"])
        kc_result = _verify_citation({
            "chunk_id": kc_id, "source_type": "knowledge_doc",
            "title": "Test Policy Doc", "score": 0.6,
        })
        check(f"Real knowledge_chunk UUID (via chunk_id) verified", kc_result is not None)

except Exception as e:
    errors.append(f"  {FAIL} _verify_citation raised: {e}")
    print(f"  {FAIL} _verify_citation raised: {e}")


# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
print(f"\n{'=' * 50}")
if errors:
    print(f"FAILED — {len(errors)} check(s) failed:")
    for e in errors:
        print(e)
    sys.exit(1)
else:
    print(f"ALL CHECKS PASSED")
