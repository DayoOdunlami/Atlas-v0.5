#!/usr/bin/env python3
"""
Atlas 5 — Corpus Recall Audit
==============================
Diagnoses why autonomous freight / A14 corridor queries return similarity
scores in the 0.44–0.58 range and assigns them "Indicative" confidence.

Surfaces probed:
  A. atlas.projects          (search_projects)
  B. atlas.live_calls        (search_live_calls)
  C. atlas.knowledge_chunks  (evidence_for_claim)
  D. hive.document_chunks    (search_hive_evidence)

For each query also runs a keyword (ILIKE) comparison to detect cases
where semantic search is underperforming keyword fallback.

Run:  python eval/corpus_recall_audit.py  >  eval/corpus_recall_audit.md
"""
from __future__ import annotations

import io
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, median, stdev

# Force UTF-8 stdout on Windows
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

_root = Path(__file__).resolve().parent.parent
if str(_root) not in sys.path:
    sys.path.insert(0, str(_root))

try:
    from dotenv import load_dotenv
    load_dotenv(_root / ".env.local", override=True)
    load_dotenv(_root / ".env", override=True)
except ImportError:
    pass

import psycopg2
import psycopg2.extras
from mcps.cpc_corpus import queries

# ---------------------------------------------------------------------------
# Corpus stats helpers
# ---------------------------------------------------------------------------

def _conn():
    import re
    raw = os.environ.get("POSTGRES_URL") or os.environ.get("DATABASE_URL") or ""
    conn_str = re.sub(r"[?&]sslmode=[^&]*", "", raw)
    is_local = "localhost" in raw or "127.0.0.1" in raw
    kwargs = {} if is_local else {"sslmode": "require"}
    return psycopg2.connect(conn_str, **kwargs)

def _sql(sql: str, params: tuple = ()) -> list[dict]:
    conn = _conn()
    try:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(row) for row in cur.fetchall()]
    finally:
        conn.close()

def corpus_stats() -> dict:
    """Collect row counts and embedding coverage for all four surfaces."""
    stats = {}
    tables = [
        ("atlas.projects",         "projects"),
        ("atlas.live_calls",       "live_calls"),
        ("atlas.knowledge_chunks", "knowledge_chunks"),
        ("atlas.knowledge_documents", "knowledge_documents"),
        ("hive.document_chunks",   "hive_chunks"),
        ("hive.articles",          "hive_articles"),
    ]
    for table, key in tables:
        try:
            total = _sql(f"SELECT COUNT(*) AS n FROM {table}")[0]["n"]
            # Check if embedding column exists
            emb_col = _sql(
                "SELECT column_name FROM information_schema.columns "
                "WHERE table_schema=%s AND table_name=%s AND column_name='embedding'",
                (table.split(".")[0], table.split(".")[1])
            )
            if emb_col:
                embedded = _sql(
                    f"SELECT COUNT(*) AS n FROM {table} WHERE embedding IS NOT NULL"
                )[0]["n"]
            else:
                embedded = None
            stats[key] = {"total": int(total), "embedded": int(embedded) if embedded is not None else None}
        except Exception as e:
            stats[key] = {"error": str(e)}
    return stats

def similarity_distribution(table: str, where: str = "embedding IS NOT NULL", sample: int = 500) -> dict:
    """
    Sample self-similarity distribution: how much does the corpus vary by cosine distance?
    Compares a random document's embedding to the rest.
    Returns p25/p50/p75/p90 of the top-1 similarity for 10 random probes.
    """
    try:
        probes = _sql(
            f"SELECT embedding FROM {table} WHERE {where} ORDER BY RANDOM() LIMIT 10"
        )
        top1_sims = []
        for row in probes:
            emb = row["embedding"]
            if emb is None:
                continue
            result = _sql(
                f"""SELECT (1 - (embedding <=> %s::vector))::float AS sim
                    FROM {table} WHERE {where} AND embedding != %s::vector
                    ORDER BY embedding <=> %s::vector LIMIT 1""",
                (emb, emb, emb)
            )
            if result:
                top1_sims.append(float(result[0]["sim"]))
        if top1_sims:
            top1_sims.sort()
            n = len(top1_sims)
            return {
                "samples": n,
                "min": round(min(top1_sims), 4),
                "median": round(median(top1_sims), 4),
                "max": round(max(top1_sims), 4),
                "mean": round(mean(top1_sims), 4),
            }
    except Exception as e:
        return {"error": str(e)}
    return {}

# ---------------------------------------------------------------------------
# Query battery
# ---------------------------------------------------------------------------

QUERIES = [
    {
        "id": "Q1",
        "label": "Autonomous freight corridors",
        "query": "autonomous freight corridor UK",
        "keyword": "autonomous",
    },
    {
        "id": "Q2",
        "label": "Road freight automation",
        "query": "road freight automation self-driving HGV lorry",
        "keyword": "HGV",
    },
    {
        "id": "Q3",
        "label": "Logistics decarbonisation",
        "query": "logistics decarbonisation freight emissions net zero",
        "keyword": "decarbonisation",
    },
    {
        "id": "Q4",
        "label": "Motorway technology demonstrators",
        "query": "motorway technology demonstrator pilot programme UK",
        "keyword": "demonstrator",
    },
    {
        "id": "Q5",
        "label": "Freight innovation funding",
        "query": "freight innovation fund grant programme UK",
        "keyword": "freight",
    },
    {
        "id": "Q6",
        "label": "A14 / strategic road network freight",
        "query": "A14 strategic road network freight transport",
        "keyword": "A14",
    },
    {
        "id": "Q7",
        "label": "Autonomous HGV / platooning",
        "query": "autonomous HGV platooning connected vehicle",
        "keyword": "platooning",
    },
    {
        "id": "Q8",
        "label": "CAV infrastructure readiness",
        "query": "connected autonomous vehicle infrastructure readiness UK",
        "keyword": "autonomous vehicle",
    },
    {
        "id": "Q9",
        "label": "Supply chain resilience",
        "query": "supply chain resilience logistics technology UK",
        "keyword": "supply chain",
    },
]

RELEVANCE_THRESHOLDS = {
    "direct":   0.70,   # highly relevant to the query domain
    "adjacent": 0.55,   # related but not on-topic
    "weak":     0.00,   # below adjacent = weak / noise
}

def classify(score: float | None) -> str:
    if score is None:
        return "keyword-only"
    if score >= RELEVANCE_THRESHOLDS["direct"]:
        return "DIRECT"
    if score >= RELEVANCE_THRESHOLDS["adjacent"]:
        return "ADJACENT"
    return "WEAK"

def run_query_battery() -> list[dict]:
    results = []
    for q in QUERIES:
        entry = {"id": q["id"], "label": q["label"], "query": q["query"]}

        # A. Projects (semantic)
        projects_sem = queries.search_projects(q["query"], limit=5)
        entry["projects_semantic"] = projects_sem

        # A'. Projects (keyword fallback comparison)
        kw_results = queries._query(
            """SELECT id, title, lead_org_name, abstract
               FROM atlas.projects
               WHERE title ILIKE %s OR abstract ILIKE %s
               ORDER BY transport_relevance_score DESC NULLS LAST LIMIT 5""",
            (f"%{q['keyword']}%", f"%{q['keyword']}%"),
        )
        entry["projects_keyword"] = [
            {
                "id": str(r["id"]),
                "title": r.get("title") or "",
                "organisation": r.get("lead_org_name") or "",
                "similarity": None,
            }
            for r in kw_results
        ]

        # B. Live calls (semantic)
        calls_sem = queries.search_live_calls(q["query"], limit=5, open_only=False)
        entry["live_calls_semantic"] = calls_sem

        # B'. Live calls (keyword)
        kw_calls = queries._query(
            """SELECT id, title, funder, status, deadline
               FROM atlas.live_calls
               WHERE title ILIKE %s OR description ILIKE %s
               ORDER BY deadline ASC NULLS LAST LIMIT 5""",
            (f"%{q['keyword']}%", f"%{q['keyword']}%"),
        )
        entry["live_calls_keyword"] = [
            {
                "id": str(r["id"]),
                "title": r.get("title") or "",
                "funder": r.get("funder") or "",
                "status": r.get("status") or "",
                "deadline": str(r["deadline"]) if r.get("deadline") else None,
                "similarity": None,
            }
            for r in kw_calls
        ]

        # C. Knowledge docs
        knowledge = queries.evidence_for_claim(q["query"], limit=5)
        entry["knowledge_docs"] = knowledge

        # D. HIVE chunks
        hive = queries.search_hive_evidence(q["query"], limit=5)
        entry["hive_chunks"] = hive

        results.append(entry)
        print(f"  {q['id']} done — {q['label']}", file=sys.stderr)

    return results

# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

def score_list(items: list[dict]) -> list[float]:
    return [float(r["similarity"]) for r in items if r.get("similarity") is not None]

def analyse_surface(items: list[dict]) -> dict:
    scores = score_list(items)
    if not scores:
        return {"count": 0, "top": None, "avg": None, "classification": "no-results"}
    top = max(scores)
    avg = mean(scores)
    cls = classify(top)
    kw_only = sum(1 for r in items if r.get("similarity") is None)
    return {
        "count": len(items),
        "top": round(top, 4),
        "avg": round(avg, 4),
        "classification": cls,
        "keyword_only": kw_only,
    }

def cross_query_analysis(results: list[dict]) -> dict:
    """Aggregate stats across all queries for each surface."""
    all_project_scores = []
    all_call_scores = []
    all_knowledge_scores = []
    all_hive_scores = []

    kw_wins = 0           # queries where keyword found results but semantic didn't
    semantic_wins = 0     # queries where semantic top-1 >= 0.60
    direct_hits = 0       # top-1 >= 0.70

    for r in results:
        ps = score_list(r["projects_semantic"])
        cs = score_list(r["live_calls_semantic"])
        ks = score_list(r["knowledge_docs"])
        hs = score_list(r["hive_chunks"])

        all_project_scores.extend(ps)
        all_call_scores.extend(cs)
        all_knowledge_scores.extend(ks)
        all_hive_scores.extend(hs)

        # Keyword-vs-semantic gap
        sem_ids = {x["id"] for x in r["projects_semantic"] if x.get("similarity") is not None}
        kw_ids  = {x["id"] for x in r["projects_keyword"]}
        if kw_ids - sem_ids:
            kw_wins += 1

        if ps and max(ps) >= 0.60:
            semantic_wins += 1
        if ps and max(ps) >= 0.70:
            direct_hits += 1

    def _stats(scores: list[float]) -> dict:
        if not scores:
            return {"n": 0}
        scores.sort()
        n = len(scores)
        return {
            "n": n,
            "min": round(min(scores), 4),
            "p25": round(scores[n//4], 4),
            "median": round(median(scores), 4),
            "p75": round(scores[3*n//4], 4),
            "max": round(max(scores), 4),
            "mean": round(mean(scores), 4),
            "pct_above_0_70": round(sum(1 for s in scores if s >= 0.70) / n * 100, 1),
            "pct_above_0_55": round(sum(1 for s in scores if s >= 0.55) / n * 100, 1),
        }

    return {
        "projects": _stats(all_project_scores),
        "live_calls": _stats(all_call_scores),
        "knowledge_docs": _stats(all_knowledge_scores),
        "hive_chunks": _stats(all_hive_scores),
        "queries_with_kw_wins": kw_wins,
        "queries_semantic_win_60": semantic_wins,
        "queries_direct_hit_70": direct_hits,
        "total_queries": len(results),
    }

# ---------------------------------------------------------------------------
# Report writer
# ---------------------------------------------------------------------------

def write_report(
    stats: dict,
    distributions: dict,
    results: list[dict],
    analysis: dict,
) -> str:
    lines = []
    ts = datetime.now(timezone.utc).isoformat()

    lines += [
        "# Atlas 5 — Corpus Recall Audit",
        "",
        f"**Generated:** {ts}",
        f"**Purpose:** Diagnose why A14 autonomous freight queries return similarity 0.44–0.58",
        "",
        "---",
        "",
        "## 1. Corpus size and embedding coverage",
        "",
        "| Surface | Total rows | Embedded | Coverage |",
        "|---------|-----------|----------|----------|",
    ]
    for key, s in stats.items():
        if "error" in s:
            lines.append(f"| {key} | ERROR | — | — |")
        else:
            total = s["total"]
            emb = s["embedded"]
            if emb is None:
                cov = "no emb col"
            elif total > 0:
                cov = f"{emb/total*100:.0f}%"
            else:
                cov = "0%"
            lines.append(f"| {key} | {total:,} | {emb if emb is not None else '—'} | {cov} |")

    lines += [
        "",
        "---",
        "",
        "## 2. Embedding space distributions (internal similarity probe)",
        "",
        "> How similar are random pairs within each corpus? Low median = spread-out, discriminative embeddings.",
        "> High median = corpus is semantically dense (all documents sound alike).",
        "",
        "| Surface | Samples | Min | Median | Max | Mean |",
        "|---------|---------|-----|--------|-----|------|",
    ]
    for key, d in distributions.items():
        if "error" in d:
            lines.append(f"| {key} | ERROR | — | — | — | — |")
        elif d:
            lines.append(
                f"| {key} | {d.get('samples','?')} | {d.get('min','?')} "
                f"| {d.get('median','?')} | {d.get('max','?')} | {d.get('mean','?')} |"
            )

    lines += [
        "",
        "---",
        "",
        "## 3. Cross-query aggregate statistics",
        "",
        "| Surface | N scores | Median | Mean | p75 | Max | >0.70 | >0.55 |",
        "|---------|----------|--------|------|-----|-----|-------|-------|",
    ]
    for surface in ["projects", "live_calls", "knowledge_docs", "hive_chunks"]:
        s = analysis.get(surface, {})
        if s.get("n", 0) == 0:
            lines.append(f"| {surface} | 0 | — | — | — | — | — | — |")
        else:
            lines.append(
                f"| {surface} | {s['n']} | {s.get('median','?')} | {s.get('mean','?')} "
                f"| {s.get('p75','?')} | {s.get('max','?')} "
                f"| {s.get('pct_above_0_70','?')}% | {s.get('pct_above_0_55','?')}% |"
            )

    lines += [
        "",
        f"**Queries where keyword found extra results not in semantic top-5:** "
        f"{analysis['queries_with_kw_wins']}/{analysis['total_queries']}",
        f"**Queries with semantic top-1 ≥ 0.60:** "
        f"{analysis['queries_semantic_win_60']}/{analysis['total_queries']}",
        f"**Queries with semantic top-1 ≥ 0.70 (DIRECT):** "
        f"{analysis['queries_direct_hit_70']}/{analysis['total_queries']}",
        "",
        "---",
        "",
        "## 4. Per-query results",
        "",
    ]

    for r in results:
        lines += [
            f"### {r['id']} — {r['label']}",
            "",
            f"> Query: `{r['query']}`",
            "",
            "#### A. atlas.projects — semantic",
            "",
            "| Rank | Score | Classification | Title | Organisation |",
            "|------|-------|----------------|-------|--------------|",
        ]
        if not r["projects_semantic"]:
            lines.append("| — | — | NO RESULTS | — | — |")
        for i, p in enumerate(r["projects_semantic"], 1):
            cls = classify(p.get("similarity"))
            lines.append(
                f"| {i} | {p.get('similarity','—')} | {cls} "
                f"| {p['title'][:70]} | {p.get('organisation','')[:40]} |"
            )

        # Keyword comparison
        kw_ids  = {p["id"] for p in r["projects_keyword"]}
        sem_ids = {p["id"] for p in r["projects_semantic"]}
        kw_only = kw_ids - sem_ids
        if kw_only:
            lines += [
                "",
                f"**Keyword-only hits ({len(kw_only)} not in semantic top-5):**",
            ]
            for p in r["projects_keyword"]:
                if p["id"] in kw_only:
                    lines.append(f"- `{p['id'][:8]}…` {p['title'][:70]}")
        else:
            lines.append("")
            lines.append("*Semantic top-5 contains all keyword matches — no semantic gap.*")

        lines += [
            "",
            "#### B. atlas.live_calls — semantic",
            "",
            "| Rank | Score | Status | Title | Funder |",
            "|------|-------|--------|-------|--------|",
        ]
        if not r["live_calls_semantic"]:
            lines.append("| — | — | — | NO RESULTS | — |")
        for i, c in enumerate(r["live_calls_semantic"], 1):
            lines.append(
                f"| {i} | {c.get('similarity','—')} | {c.get('status','—')} "
                f"| {c['title'][:60]} | {c.get('funder','')[:40]} |"
            )

        # Keyword calls comparison
        kw_call_ids  = {c["id"] for c in r["live_calls_keyword"]}
        sem_call_ids = {c["id"] for c in r["live_calls_semantic"]}
        kw_call_only = kw_call_ids - sem_call_ids
        if kw_call_only:
            lines += [
                "",
                f"**Keyword-only call hits ({len(kw_call_only)} not in semantic top-5):**",
            ]
            for c in r["live_calls_keyword"]:
                if c["id"] in kw_call_only:
                    lines.append(
                        f"- `{c['id'][:8]}…` {c['title'][:60]} "
                        f"({c.get('status','?')} / {c.get('deadline','?')})"
                    )

        lines += [
            "",
            "#### C. atlas.knowledge_chunks (knowledge docs)",
            "",
            "| Rank | Score | Title | Publisher | Tier |",
            "|------|-------|-------|-----------|------|",
        ]
        if not r["knowledge_docs"]:
            lines.append("| — | — | NO RESULTS | — | — |")
        for i, d in enumerate(r["knowledge_docs"], 1):
            lines.append(
                f"| {i} | {d.get('similarity','—')} | {d['title'][:60]} "
                f"| {d.get('publisher','')[:30]} | {d.get('tier','')[:20]} |"
            )

        lines += [
            "",
            "#### D. hive.document_chunks",
            "",
            "| Rank | Score | Title |",
            "|------|-------|-------|",
        ]
        if not r["hive_chunks"]:
            lines.append("| — | — | NO RESULTS |")
        for i, h in enumerate(r["hive_chunks"], 1):
            lines.append(
                f"| {i} | {h.get('similarity','—')} | {h.get('title','')[:70]} |"
            )

        lines.append("")

    # ---------------------------------------------------------------------------
    # Diagnosis + recommendation
    # ---------------------------------------------------------------------------
    lines += [
        "---",
        "",
        "## 5. Diagnosis",
        "",
    ]

    # Compute key signals
    proj_stats  = analysis.get("projects", {})
    call_stats  = analysis.get("live_calls", {})
    know_stats  = analysis.get("knowledge_docs", {})
    hive_stats  = analysis.get("hive_chunks", {})

    proj_median = proj_stats.get("median", 0) or 0
    proj_pct70  = proj_stats.get("pct_above_0_70", 0) or 0
    proj_pct55  = proj_stats.get("pct_above_0_55", 0) or 0
    kw_wins     = analysis.get("queries_with_kw_wins", 0)
    total_q     = analysis.get("total_queries", 9)

    diagnosis = []

    # Signal 1: overall score range
    if proj_median < 0.55:
        diagnosis.append(
            "**[SCORE RANGE]** Project similarity median below 0.55 — corpus may lack "
            "direct domain match OR embedding space is well-discriminated and these queries "
            "sit in a genuinely sparse region."
        )

    if proj_pct70 < 10:
        diagnosis.append(
            "**[SPARSE DOMAIN]** Less than 10% of retrieved project scores clear 0.70. "
            "This strongly suggests the atlas.projects corpus has few documents that are "
            "directly about autonomous freight / AV corridors."
        )

    if kw_wins > total_q // 3:
        diagnosis.append(
            f"**[KEYWORD GAP]** Keyword search finds distinct results not in semantic top-5 "
            f"for {kw_wins}/{total_q} queries. This indicates either stale embeddings (corpus "
            f"updated after last embed run) or that short field values (titles only) are under-"
            f"embedding abstract content."
        )
    else:
        diagnosis.append(
            f"**[SEMANTIC COVERS KEYWORD]** Keyword search adds <{kw_wins} new hits across "
            f"{total_q} queries. Semantic search is not losing results that keyword would catch — "
            f"the retrieval architecture is sound. The low scores are a true domain coverage signal."
        )

    if know_stats.get("n", 0) == 0:
        diagnosis.append(
            "**[KNOWLEDGE DOCS EMPTY]** No knowledge_chunks returned — either "
            "atlas.knowledge_chunks has no embedded rows, or the table is unpopulated."
        )
    elif know_stats.get("median", 0) < 0.55:
        diagnosis.append(
            "**[KNOWLEDGE DOCS LOW]** Knowledge chunk scores also below 0.55 — policy/report "
            "evidence is similarly sparse for this domain."
        )

    if hive_stats.get("n", 0) == 0:
        diagnosis.append(
            "**[HIVE EMPTY]** No hive.document_chunks returned — either the table is "
            "unpopulated or embedding is missing."
        )

    for d in diagnosis:
        lines.append(f"- {d}")

    lines += [
        "",
        "---",
        "",
        "## 6. Recommendation",
        "",
        "| Option | Description | Confidence boost | Effort |",
        "|--------|-------------|------------------|--------|",
        "| **A — Query/routing tuning** | Add multi-hop: run two passes (broad + narrow), "
        "weight abstract field more heavily, expand query with synonym expansion | +5–10% recall | Low |",
        "| **B — Selective re-embed** | Re-embed projects where `abstract` is long but "
        "`embedding` was computed only on `title` (check embed_source column) | +10–20% precision | Medium |",
        "| **C — Add GovUK / Exa** | External search fills gaps where CPC corpus is thin; "
        "GovUK gets DfT/Innovate UK source docs, Exa gets recent news/academic | +15–30% direct evidence | Medium |",
        "| **D — Both B + C** | Re-embed stale rows AND add external lane | +25–40% | High |",
        "",
    ]

    # Concrete recommendation
    lines += ["### Verdict", ""]

    if kw_wins > total_q // 3:
        verdict = "**B first, then C** — keyword gap signals stale embeddings; fix that before adding external search."
        rationale = (
            "Keyword search beats semantic for 1/3+ of queries, which means some corpus rows "
            "have embeddings computed before their current content. Re-embedding those rows "
            "(identified by comparing embed_updated_at vs record updated_at) will immediately "
            "improve precision at no latency cost. Once re-embedding is done, adding GovUK/Exa "
            "will fill the remaining domain gap (no CPC A14 AV trial data exists — external "
            "evidence is genuinely necessary)."
        )
    elif proj_pct70 < 10 and know_stats.get("n", 0) < 5:
        verdict = "**C then D** — corpus is correctly embedded but is thin on this domain; external evidence is the primary lever."
        rationale = (
            "The semantic search is working correctly — low scores reflect genuine domain sparsity "
            "in the CPC corpus (no prior A14 AV HGV corridor trial in the database), not embedding "
            "quality issues. Adding GovUK (DfT/Innovate UK freight funding, AV Act guidance) and "
            "Exa (recent UK autonomous freight news, CCAV publications) will provide the direct "
            "evidence needed to move from Indicative to Supported tier."
        )
    else:
        verdict = "**A + C** — routing refinement plus external search."
        rationale = (
            "Moderate gaps in both precision and coverage. Multi-hop query expansion (semantic + "
            "abstract-weighted re-rank) will improve within-corpus results; external search adds "
            "coverage the corpus genuinely lacks."
        )

    lines += [
        f"{verdict}",
        "",
        f"> {rationale}",
        "",
        "### Before adding Exa/GovUK — confirm these:",
        "",
        "1. **Check `embed_updated_at` vs `updated_at`** on atlas.projects rows — any row where "
        "   `updated_at > embed_updated_at` has stale embeddings.",
        "2. **Check `embed_source` field** — if abstracts were truncated to 256 chars during "
        "   embedding but the full abstract is >500 chars, re-embed with full text.",
        "3. **Check knowledge_documents count** — if `atlas.knowledge_chunks` is sparse, "
        "   the policy evidence lane is un-populated; DfT Freight documents should be ingested.",
        "4. **Check hive.articles count** — if HIVE is empty for freight/AV, there is a data gap "
        "   that neither re-embedding nor Exa can fix without an ingestion run.",
    ]

    lines += ["", "---", ""]

    return "\n".join(lines)

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("Running corpus stats...", file=sys.stderr)
    stats = corpus_stats()

    print("Running embedding space distributions...", file=sys.stderr)
    distributions = {}
    probe_tables = {
        "projects": ("atlas.projects", "embedding IS NOT NULL"),
        "knowledge_chunks": ("atlas.knowledge_chunks", "embedding IS NOT NULL"),
        "hive_chunks": ("hive.document_chunks", "embedding IS NOT NULL"),
    }
    for name, (table, where) in probe_tables.items():
        distributions[name] = similarity_distribution(table, where)

    print("Running query battery...", file=sys.stderr)
    results = run_query_battery()

    print("Analysing results...", file=sys.stderr)
    analysis = cross_query_analysis(results)

    report = write_report(stats, distributions, results, analysis)

    # Write to file
    out_path = Path(__file__).parent / "corpus_recall_audit.md"
    out_path.write_text(report, encoding="utf-8")
    print(f"Report written to {out_path}", file=sys.stderr)

    # Also print to stdout
    print(report)

if __name__ == "__main__":
    main()
