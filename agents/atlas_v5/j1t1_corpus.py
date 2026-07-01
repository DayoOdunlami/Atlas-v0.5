"""
J1T1 — rail decarbonisation corpus query (GATE 2 brain wide pass).

READ ONLY · atlas.projects via Postgres; HTTPS REST fallback when pooler TCP blocked.
"""

from __future__ import annotations

import datetime
import logging
import re
from collections import Counter, defaultdict
from typing import Any

from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats, ModeThemeRow, StartYearRow
from mcps.cpc_corpus import transport
from mcps.cpc_corpus.queries import _pg_query

logger = logging.getLogger(__name__)

J1T1_WHERE = "'rail' = ANY(cpc_modes) AND 'decarbonisation' = ANY(cpc_themes)"

J1T1_QUERY_PHRASE = "State of play on rail decarbonisation in our corpus"

_REST_SELECT = (
    "id, title, lead_funder, lead_org_name, funding_amount, start_date, end_date, cpc_modes, cpc_themes"
)


def _fetch_corpus_stats_rest(where_clause: str) -> J1T1CorpusStats:
    """Aggregate corpus stats over Supabase REST (443) when Postgres pooler is blocked."""
    from mcps.cpc_corpus import queries_rest

    sb = queries_rest._client()
    q = sb.schema("atlas").from_("projects").select(_REST_SELECT)

    wc = where_clause.strip()
    if wc and wc.upper() != "TRUE":
        mode = re.search(r"'(\w+)'\s*=\s*ANY\(cpc_modes\)", wc)
        theme = re.search(r"'(\w+)'\s*=\s*ANY\(cpc_themes\)", wc)
        if mode and theme:
            q = q.contains("cpc_modes", [mode.group(1)]).contains("cpc_themes", [theme.group(1)])
        elif "hydrogen" in wc.lower():
            q = q.or_("cpc_themes.cs.{hydrogen},cpc_modes.cs.{hydrogen}")

    rows: list[dict[str, Any]] = []
    page_size = 500
    offset = 0
    while True:
        batch = q.range(offset, offset + page_size - 1).execute().data or []
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < page_size:
            break
        offset += page_size

    if not rows:
        raise RuntimeError("REST corpus stats returned no rows for scope")

    funding_vals = [r.get("funding_amount") for r in rows]
    null_funding = sum(1 for v in funding_vals if v is None)
    funded = len(funding_vals) - null_funding
    funding_sum = sum(float(v) for v in funding_vals if v is not None)
    orgs = {r.get("lead_org_name") for r in rows if r.get("lead_org_name")}
    live_since_2024 = 0
    for r in rows:
        end = r.get("end_date")
        if end is None or str(end) >= "2024-01-01":
            live_since_2024 += 1

    funder_acc: dict[str, list[Any]] = defaultdict(list)
    for r in rows:
        funder_acc[r.get("lead_funder") or "Unknown"].append(r.get("funding_amount"))

    funder_rows = sorted(
        (
            FunderBreakdownRow(
                lead_funder=name,
                project_count=len(amounts),
                null_funding_count=sum(1 for a in amounts if a is None),
                funding_sum=sum(float(a) for a in amounts if a is not None),
            )
            for name, amounts in funder_acc.items()
        ),
        key=lambda f: f.project_count,
        reverse=True,
    )

    mode_theme_counter: Counter[tuple[str, str]] = Counter()
    for r in rows:
        modes = r.get("cpc_modes") or []
        themes = r.get("cpc_themes") or []
        for m in modes:
            for t in themes:
                mode_theme_counter[(str(m), str(t))] += 1

    year_counter: Counter[int] = Counter()
    for r in rows:
        sd = r.get("start_date")
        if not sd:
            continue
        yr = int(str(sd)[:4])
        if yr >= 2015:
            year_counter[yr] += 1

    citation_rows = sorted(
        rows,
        key=lambda r: (r.get("funding_amount") is None, -(float(r["funding_amount"]) if r.get("funding_amount") else 0)),
    )[:5]

    logger.info("Corpus stats via REST fallback (%d rows, where=%s)", len(rows), wc[:60])

    return J1T1CorpusStats(
        project_count=len(rows),
        funding_sum=funding_sum,
        null_funding_count=null_funding,
        funded_row_count=funded,
        org_count=len(orgs),
        live_since_2024=live_since_2024,
        funders=funder_rows,
        mode_themes=[
            ModeThemeRow(mode=m, theme=t, project_count=c)
            for (m, t), c in mode_theme_counter.most_common(12)
        ],
        start_years=[
            StartYearRow(year=yr, project_count=c)
            for yr, c in sorted(year_counter.items())
        ],
        top_citations=[
            {
                "id": str(c["id"]),
                "title": c.get("title") or "Untitled project",
                "organisation": c.get("lead_funder") or c.get("lead_org_name") or "Unknown",
                "score": max(0.5, 0.95 - i * 0.05),
            }
            for i, c in enumerate(citation_rows)
        ],
        queried_at=datetime.datetime.now(datetime.UTC).isoformat().replace("+00:00", "Z"),
    )


def fetch_corpus_stats(where_clause: str = J1T1_WHERE) -> J1T1CorpusStats:
    from mcps.cpc_corpus import transport

    if transport.rest_configured() and transport.corpus_rest_first():
        try:
            return _fetch_corpus_stats_rest(where_clause)
        except Exception as exc:
            logger.warning("REST corpus stats failed — trying Postgres: %s", exc)
    try:
        return _fetch_corpus_stats_pg(where_clause)
    except transport.PostgresUnavailable as exc:
        if not transport.rest_configured():
            raise
        logger.warning("Postgres unavailable for corpus stats — REST fallback: %s", exc)
        return _fetch_corpus_stats_rest(where_clause)


def _fetch_corpus_stats_pg(where_clause: str) -> J1T1CorpusStats:
    agg_rows = _pg_query(
        f"""
        SELECT
          COUNT(*)::int AS project_count,
          COALESCE(SUM(funding_amount), 0)::numeric AS funding_sum,
          COUNT(*) FILTER (WHERE funding_amount IS NULL)::int AS null_funding_count,
          COUNT(*) FILTER (WHERE funding_amount IS NOT NULL)::int AS funded_row_count,
          COUNT(DISTINCT lead_org_name)::int AS org_count,
          COUNT(*) FILTER (
            WHERE end_date IS NULL OR end_date >= '2024-01-01'::date
          )::int AS live_since_2024
        FROM atlas.projects
        WHERE {where_clause}
        """
    )
    if not agg_rows:
        raise RuntimeError("J1T1 aggregate query returned no rows")
    row = agg_rows[0]

    funder_rows = _pg_query(
        f"""
        SELECT
          COALESCE(lead_funder, 'Unknown') AS lead_funder,
          COUNT(*)::int AS project_count,
          COUNT(*) FILTER (WHERE funding_amount IS NULL)::int AS null_funding_count,
          COALESCE(SUM(funding_amount), 0)::numeric AS funding_sum
        FROM atlas.projects
        WHERE {where_clause}
        GROUP BY lead_funder
        ORDER BY project_count DESC
        """
    )

    citation_rows = _pg_query(
        f"""
        SELECT id, title, lead_funder, lead_org_name, funding_amount
        FROM atlas.projects
        WHERE {where_clause}
        ORDER BY funding_amount DESC NULLS LAST, title ASC
        LIMIT 5
        """
    )

    mode_theme_rows = _pg_query(
        f"""
        SELECT mode_label AS mode, theme_label AS theme, COUNT(*)::int AS project_count
        FROM (
          SELECT unnest(cpc_modes) AS mode_label, unnest(cpc_themes) AS theme_label
          FROM atlas.projects
          WHERE {where_clause}
        ) expanded
        GROUP BY mode_label, theme_label
        ORDER BY project_count DESC
        LIMIT 12
        """
    )

    year_rows = _pg_query(
        f"""
        SELECT EXTRACT(YEAR FROM start_date)::int AS yr, COUNT(*)::int AS project_count
        FROM atlas.projects
        WHERE {where_clause} AND start_date IS NOT NULL
        GROUP BY yr
        HAVING EXTRACT(YEAR FROM start_date)::int >= 2015
        ORDER BY yr
        """
    )

    funding_sum = float(row["funding_sum"])

    return J1T1CorpusStats(
        project_count=int(row["project_count"]),
        funding_sum=funding_sum,
        null_funding_count=int(row["null_funding_count"]),
        funded_row_count=int(row["funded_row_count"]),
        org_count=int(row["org_count"]),
        live_since_2024=int(row["live_since_2024"]),
        funders=[
            FunderBreakdownRow(
                lead_funder=str(f["lead_funder"]),
                project_count=int(f["project_count"]),
                null_funding_count=int(f["null_funding_count"]),
                funding_sum=float(f["funding_sum"]),
            )
            for f in funder_rows
        ],
        mode_themes=[
            ModeThemeRow(
                mode=str(m["mode"]),
                theme=str(m["theme"]),
                project_count=int(m["project_count"]),
            )
            for m in mode_theme_rows
        ],
        start_years=[
            StartYearRow(year=int(y["yr"]), project_count=int(y["project_count"]))
            for y in year_rows
        ],
        top_citations=[
            {
                "id": str(c["id"]),
                "title": c["title"] or "Untitled project",
                "organisation": c["lead_funder"] or c["lead_org_name"] or "Unknown",
                "score": max(0.5, 0.95 - i * 0.05),
            }
            for i, c in enumerate(citation_rows)
        ],
        queried_at=datetime.datetime.now(datetime.UTC).isoformat().replace("+00:00", "Z"),
    )


def fetch_j1t1_corpus_stats() -> J1T1CorpusStats:
    return fetch_corpus_stats(J1T1_WHERE)
