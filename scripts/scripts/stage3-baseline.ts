#!/usr/bin/env tsx
/**
 * Stage 3 — Phase 6 Baseline Smoke Check
 * Runs Q1 from the Phase 6 seed query pack against the EXISTING retrieval path
 * (searchKnowledgeChunks with Strategy 5 mode+theme filters).
 * The legacy columns on atlas.projects are now populated from Stage 2, so
 * this already benefits from the dual-write even though the code path hasn't changed.
 *
 * Usage: pnpm tsx scripts/stage3-baseline.ts
 */
import "load-env";
import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { searchKnowledgeChunks } from "@/lib/db/pg/repositories/knowledge-repository.pg";
import { writeFileSync } from "node:fs";

const SEED_QUERIES = [
  "How should we think about portable assurance for funding evidence?",
  "What's happening in maritime decarbonisation funding?",
  "What rail innovation funding closes in Q1?",
];

const modeLexicon: Record<string, RegExp> = {
  rail: /\brail|cp7|network rail|orr\b/i,
  aviation: /\baviation|airport|jet zero|saf|caa|flight|aam|evtol\b/i,
  maritime: /\bmaritime\b|\bports?\b|shipping|vessel|mca|harbour/i,
  hit: /\bhighways?|integrated transport|ris3|road|vehicles?|self-driving|automated vehicles?\b/i,
  data_digital:
    /\bdata\b|\bdigital\b|\btestbed britain\b|\binnovation passport(s)?\b|\bjustin anderson\b|\bportable trust\b|\binteroperab/i,
};
const themeLexicon: Record<string, RegExp> = {
  autonomy: /\bautonom|automation|driverless|self-driving|drone|cav\b/i,
  decarbonisation: /\bdecarbon|net zero|hydrogen|saf|electrification|emission/i,
  people_experience: /\bpassenger|accessib|inclusion|safety|customer|people\b/i,
  hubs_clusters: /\bhub|cluster|intermodal|place|placemaking|region\b/i,
  planning_operation:
    /\bplanning|operations?|delivery plan|system integration|resilience\b/i,
  industry: /\bindustry|supply chain|commercial|market|investment|funding\b/i,
};

function inferModes(query: string): string[] {
  const modes = Object.entries(modeLexicon)
    .filter(([, rx]) => rx.test(query))
    .map(([k]) => k);
  if (modes.length > 0) return modes;
  return ["rail", "aviation", "maritime", "hit"];
}

function inferThemes(query: string): string[] {
  return Object.entries(themeLexicon)
    .filter(([, rx]) => rx.test(query))
    .map(([k]) => k);
}

async function main() {
  console.log("Stage 3 — Phase 6 Baseline (Strategy 5: Mode + Theme)\n");

  const lines: string[] = [];
  lines.push("# Stage 3 — Phase 6 Baseline (post-dual-write, old code path)");
  lines.push(
    `**Date:** ${new Date().toISOString()}`
  );
  lines.push(
    "**Strategy:** Strategy 5 (Mode + Theme) — existing searchKnowledgeChunks with mode+theme filters"
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

    const modes = inferModes(q);
    const themes = inferThemes(q);

    console.log(`  Inferred modes: ${modes.join(", ")}`);
    console.log(`  Inferred themes: ${themes.join(", ") || "(none)"}`);

    const results = await searchKnowledgeChunks({
      embeddingLiteral,
      modes: modes.length ? modes : undefined,
      themes: themes.length ? themes : undefined,
      topK: 10,
    });

    lines.push(`## Q${i + 1}: "${q}"`);
    lines.push(`- Inferred modes: ${modes.join(", ")}`);
    lines.push(`- Inferred themes: ${themes.join(", ") || "(none)"}`);
    lines.push(`- Results: ${results.length}`);
    lines.push("");
    lines.push("| Rank | Title | Publisher | Similarity |");
    lines.push("|---|---|---|---|");

    const top5 = results.slice(0, 5);
    for (let j = 0; j < top5.length; j++) {
      const r = top5[j];
      lines.push(
        `| ${j + 1} | ${r.title} | ${r.publisher ?? "—"} | ${r.similarity.toFixed(3)} |`
      );
      console.log(`  ${j + 1}. [${r.similarity.toFixed(3)}] ${r.title}`);
    }
    lines.push("");
  }

  const outPath = "reports/stage3-baseline.md";
  writeFileSync(outPath, lines.join("\n") + "\n", "utf8");
  console.log(`\nWrote ${outPath}`);
}

void main();
