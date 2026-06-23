import type { CorpusCitation } from "@/lib/atlas5/types";

export interface FunderBreakdownRow {
  lead_funder: string;
  project_count: number;
  null_funding_count: number;
  funding_sum: number;
}

export interface J1T1CorpusStats {
  project_count: number;
  funding_sum: number;
  null_funding_count: number;
  funded_row_count: number;
  org_count: number;
  live_since_2024: number;
  funders: FunderBreakdownRow[];
  top_citations: CorpusCitation[];
  queried_at: string;
}
