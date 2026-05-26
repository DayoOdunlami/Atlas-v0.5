#!/usr/bin/env tsx
/**
 * Stage 5 — Test new atlas.search_with_classifications RPC
 * Queries the new RPC with taxonomy_filters={"cpc_system":["Rail"],"cpc_theme":["Decarbonisation"]}
 * for comparison with Stage 3 baseline.
 *
 * Usage: pnpm tsx scripts/stage5-new-rpc.ts
 */
import "load-env";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { pgDb as db } from "@/lib/db/pg/db.pg";
import { sql } from "drizzle-orm";
import { writeFileSync } from "node:fs";

const SEED_QUERIES = [
  "How should we think about portable assurance for funding evidence?",
  "What's happening in maritime decarbonisation funding?",
  "What rail innovation funding closes in Q1?",
];

// Same lexicons as stage3
const modeLexicon: Record<string, RegExp> = {
  Rail: /\brail|cp7|network rail|orr\b/i,
  Aviation: /\baviation|airport|jet zero|saf|caa|flight|aam|evtol\b/i,
  Maritime: /\bmaritime\b|\bports?\b|shipping|vessel|mca|harbour/i,
  "Highways & Integrated Transport":
    /\bhighways?|integrated transport|ris3|road|vehicles?|self-driving|automated vehicles?\b/i,
  "Data & Digital":
    /\bdata\b|\bdigital\b|\btestbed britain\b|\binnovation passport(s)?\b|\bjustin anderson\b|\bportable trust\b|\binteroperab/i,
};

const themeLexicon: Record<string, RegExp> = {
  Autonomy: /\bautonom|automation|driverless|self-driving|drone|cav\b/i,
  Decarbonisation: /\bdecarbon|net zero|hydrogen|saf|electrification|emission/i,
  "People Experience":
    /\bpassenger|accessib|inclusion|safety|customer|people\b/i,
  "Hubs and Clusters": /\bhub|cluster|intermodal|place|placemaking|region\b/i,
  "Planning and Operation":
    /\bplanning|operations?|delivery plan|system integration|resilience\b/i,
  "Sector Shaping":
    /\bindustry|supply chain|commercial|market|investment|funding\b/i,
};

function inferCpcSystemLabels(query: string): string[] {
  const labels = Object.entries(modeLexicon)
    .filter(([, rx]) => rx.test(query))
    .map(([k]) => k);
  if (labels.length > 0) return labels;
  return ["Rail", "Aviation", "Maritime", "Highways & Integrated Transport"];
}

function inferCpcThemeLabels(query: string): string[] {
  return Object.entries(themeLexicon)
    .filter(([, rx]) => rx.test(query))
    .map(([k]) => k);
}

// `db.execute<T>` requires `T extends Record<string, unknown>` in
// drizzle-orm 0.41.x — the named-property interface alone doesn't
// carry the index signature drizzle's generic needs. The `extends`
// clause adds it without changing any field semantics.
//
// Run 5 entry follow-up (Path A per user directive 2026-05-09):
// closes the long-deferred 'out-of-scope, atlas-ingest workstream'
// type error that was blocking the Vercel production build on every
// PR since e2fd2c5 (atlas-ingest landed in main). The 'pre-existing
// unrelated' tag only holds while the work is genuinely separate;
// once it merges, dangling errors become everyone's problem (L8 in
// the cross-run learning spine).
interface SearchResult extends Record<string, unknown> {
  document_id: string;
  title: string;
  publisher: string | null;
  published_on: string | null;
  source_type: string;
  tier: string;
  chunk_index: number;
  body: string;
  token_count: number;
  similarity: number;
}

async function searchWithClassifications(
  taxonomyFilters: Record<string, string[]>,
  embeddingLiteral: string,
  k: number,
  entityTypes: string[] = ["knowledge_doc"],
): Promise<SearchResult[]> {
  const result = await db.execute<SearchResult>(
    sql.raw(`
      SELECT * FROM atlas.search_with_classifications(
        ARRAY[${entityTypes.map((t) => `'${t}'`).join(",")}],
        '${JSON.stringify(taxonomyFilters)}'::jsonb,
        '${embeddingLiteral}'::vector,
        ${k}
      )
    `),
  );
  return result.rows;
}

async function main() {
  console.log("Stage 5 — New RPC: atlas.search_with_classifications\n");

  const lines: string[] = [];
  lines.push("# Stage 5 — New RPC Results (atlas.search_with_classifications)");
  lines.push(`**Date:** ${new Date().toISOString()}`);
  lines.push(
    "**RPC:** atlas.search_with_classifications — classifications-aware retrieval",
  );
  lines.push("");

  for (let i = 0; i < SEED_QUERIES.length; i++) {
    const q = SEED_QUERIES[i];
    console.log(`Q${i + 1}: ${q}`);

    const { embedding } = await embed({
      model: openai.embedding(process.env.EMBEDDINGS_MODEL!), // pragma: allowlist secret
      value: q,
    });
    const embeddingLiteral = `[${embedding.join(",")}]`;

    const cpcSystemLabels = inferCpcSystemLabels(q);
    const cpcThemeLabels = inferCpcThemeLabels(q);

    const taxonomyFilters: Record<string, string[]> = {};
    if (cpcSystemLabels.length > 0)
      taxonomyFilters.cpc_system = cpcSystemLabels;
    if (cpcThemeLabels.length > 0) taxonomyFilters.cpc_theme = cpcThemeLabels;

    console.log(`  cpc_system filters: ${cpcSystemLabels.join(", ")}`);
    console.log(
      `  cpc_theme filters: ${cpcThemeLabels.join(", ") || "(none)"}`,
    );

    const results = await searchWithClassifications(
      taxonomyFilters,
      embeddingLiteral,
      10,
    );

    lines.push(`## Q${i + 1}: "${q}"`);
    lines.push(`- cpc_system filters: ${cpcSystemLabels.join(", ")}`);
    lines.push(`- cpc_theme filters: ${cpcThemeLabels.join(", ") || "(none)"}`);
    lines.push(`- Results: ${results.length}`);
    lines.push("");
    lines.push("| Rank | Title | Publisher | Similarity |");
    lines.push("|---|---|---|---|");

    const top5 = results.slice(0, 5);
    for (let j = 0; j < top5.length; j++) {
      const r = top5[j];
      lines.push(
        `| ${j + 1} | ${r.title} | ${r.publisher ?? "—"} | ${r.similarity.toFixed(3)} |`,
      );
      console.log(`  ${j + 1}. [${r.similarity.toFixed(3)}] ${r.title}`);
    }
    lines.push("");

    if (results.length === 0) {
      console.log("  WARNING: No results from new RPC");
    }
  }

  const outPath = "reports/stage5-new-rpc.md";
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  console.log(`\nWrote ${outPath}`);
}

void main();
