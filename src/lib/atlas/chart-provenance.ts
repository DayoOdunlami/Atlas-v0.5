/** Map chart data_keys → AnswerSpec provenance ids (C4). */

const KEY_TO_PROV: Record<string, string> = {
  "stats.project_count": "stat-corpus",
  "stats.funding_floor_gbp": "stat-corpus",
  "stats.null_funding_count": "stat-corpus",
  "stats.live_since_2024": "stat-corpus",
  "stats.org_count": "stat-corpus",
  "web.programme_total_gbp": "mag-upper",
  "web.programme_upper_gbp": "mag-upper",
  "corpus.citation_count": "stat-corpus",
  "research.work_count": "research-lane",
  "research.top_cited_count": "research-lane",
};

export function provIdForChartKey(
  key: string,
  provenance: Record<string, unknown>,
): string | null {
  const mapped = KEY_TO_PROV[key];
  if (mapped && provenance[mapped]) return mapped;
  if (provenance[key]) return key;
  if (key.startsWith("stats.")) return provenance["stat-corpus"] ? "stat-corpus" : null;
  if (key.startsWith("web.")) return provenance["mag-upper"] ? "mag-upper" : null;
  return null;
}
