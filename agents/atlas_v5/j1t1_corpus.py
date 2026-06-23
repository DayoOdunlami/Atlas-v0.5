"""
J1T1 — rail decarbonisation corpus query (GATE 2 brain wide pass).

READ ONLY · atlas.projects via mcps.cpc_corpus Postgres path.
"""

from __future__ import annotations

import datetime

from agents.atlas_v5.j1t1_types import FunderBreakdownRow, J1T1CorpusStats
from mcps.cpc_corpus.queries import _pg_query

J1T1_WHERE = "'rail' = ANY(cpc_modes) AND 'decarbonisation' = ANY(cpc_themes)"

J1T1_QUERY_PHRASE = "State of play on rail decarbonisation in our corpus"


def fetch_corpus_stats(where_clause: str = J1T1_WHERE) -> J1T1CorpusStats:
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
