/**
 * GATE 1 bootstrap — pure AnswerSpec assembly from J1T1 corpus stats.
 * No server-only — safe for vitest and client-side preview.
 */
import {
  validateFinalAnswerSpec,
  type AnswerSpec,
} from "@/lib/atlas/contracts/answer-spec.schema";
import type { J1T1CorpusStats } from "@/lib/atlas/j1t1-types";

/** National programme context — web candidate, not corpus-grounded (GATE 0a locked) */
const WEB_UPPER_GBP = 11_700_000_000;

export function formatGbpCompact(amount: number, opts?: { approximate?: boolean }): string {
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) {
    const bn = abs / 1_000_000_000;
    const label =
      opts?.approximate || bn < 10
        ? bn.toFixed(1).replace(/\.0$/, "")
        : bn.toFixed(0);
    return opts?.approximate ? `~£${label}bn` : `£${label}bn`;
  }
  if (abs >= 1_000_000) {
    return `£${(abs / 1_000_000).toFixed(2)}m`;
  }
  if (abs >= 1_000) {
    return `£${Math.round(abs / 1_000)}k`;
  }
  return `£${Math.round(abs)}`;
}

function formatRatio(upper: number, lower: number): string {
  if (lower <= 0) return "—";
  const ratio = upper / lower;
  if (ratio >= 100) {
    const rounded = Math.round(ratio / 10) * 10;
    return `≈ ${rounded.toLocaleString("en-GB")}×`;
  }
  return `≈ ${Math.round(ratio)}×`;
}

function buildBlindspotStructure(stats: J1T1CorpusStats): {
  pattern: string;
  implication: string;
} {
  const epsrc = stats.funders.find((f) => f.lead_funder === "EPSRC");
  const iuk = stats.funders.find((f) => f.lead_funder === "Innovate UK");
  const epsrcNulls = epsrc?.null_funding_count ?? 0;
  const iukNulls = iuk?.null_funding_count ?? 0;
  const iukCount = iuk?.project_count ?? 0;

  const pattern =
    epsrc && epsrcNulls > 0
      ? `Nulls concentrate in EPSRC research-council awards (${epsrcNulls} of ${stats.null_funding_count} nulls; all ${epsrc.project_count} EPSRC projects at £0 recorded); Innovate UK ${iukNulls} null in ${iukCount}.`
      : `${stats.null_funding_count} of ${stats.project_count} projects carry no funding figure — structured missingness, not random holes.`;

  const iukSum = iuk?.funding_sum ?? 0;
  const implication =
    iuk && iukSum > 0
      ? `${formatGbpCompact(stats.funding_sum, { approximate: false })} ≈ complete Innovate UK innovation spend in this slice — a structured floor, not a random hole.`
      : `Known funding is a floor (${formatGbpCompact(stats.funding_sum)}) — null rows are concentrated by funder, not scattered.`;

  return { pattern, implication };
}

function epsrcCount(stats: J1T1CorpusStats): number {
  return stats.funders.find((f) => f.lead_funder === "EPSRC")?.project_count ?? 0;
}

export function assembleJ1T1Spec(stats: J1T1CorpusStats): AnswerSpec {
  const fundingDisplay = formatGbpCompact(stats.funding_sum);
  const iuk = stats.funders.find((f) => f.lead_funder === "Innovate UK");
  const iukDisplay = iuk ? formatGbpCompact(iuk.funding_sum) : "—";
  const ratioLabel = formatRatio(WEB_UPPER_GBP, stats.funding_sum);
  const blindspotStructure = buildBlindspotStructure(stats);

  const spec: AnswerSpec = {
    specVersion: "0.2.1",
    object: "Rail decarbonisation",
    scope: `CORPUS · ${stats.project_count} OBJECTS · ORIENT`,
    mode: "Orient",
    tier: stats.funded_row_count >= 30 ? "Supported" : "Indicative",
    tierCapReason: `${stats.funded_row_count} funded corpus rows with verified UUIDs; web £ context capped candidate`,
    verdict: {
      sentence:
        "The corpus sees a busy but small-money field — and it's blind to the part that matters most.",
      tail: "A thin, Innovate-UK-funded SME innovation layer sits beneath a national electrification programme the corpus can't see. Any CPC play has to know which tier it's entering.",
    },
    stats: [
      { value: String(stats.project_count), label: "projects", provId: "stat-corpus", tone: "corpus" },
      {
        value: fundingDisplay,
        label: "known funding · a floor",
        provId: "stat-corpus",
        tone: "corpus",
      },
      {
        value: String(stats.live_since_2024),
        label: "live since 2024",
        provId: "stat-corpus",
        tone: "corpus",
      },
      {
        value: String(stats.org_count),
        label: "lead organisations",
        provId: "stat-corpus",
        tone: "corpus",
      },
    ],
    blindspot: {
      sign: "undercount",
      gap: `CPC TRIG grants and national programme spend are absent from the corpus — ${fundingDisplay} is the SME grant tier only.`,
      closable: "Closable by ingestion for CPC-owned rows; national programme remains web context.",
      secondary: `${stats.null_funding_count} of ${stats.project_count} projects carry no funding figure — not random missingness.`,
      structure: blindspotStructure,
    },
    instrument: {
      recipe: "IncommensurableMagnitudes",
      data: {
        upper: {
          label: "National electrification programme",
          display: formatGbpCompact(WEB_UPPER_GBP, { approximate: true }),
          source: "web",
          note: "11,700 single-track-km × ~£1m/km (TDNS)",
        },
        lower: {
          label: "SME innovation layer (corpus)",
          display: fundingDisplay,
          source: "corpus",
          note: `${stats.project_count} projects · ${iuk?.project_count ?? 0} Innovate UK · a floor, not a total`,
        },
        ratioLabel,
        ratioNote: "three orders of magnitude — the gap is the finding",
      },
      honesty: { toScale: false, label: "axis compressed at the gap" },
    },
    claims: [],
    corpus_citations: stats.top_citations,
    hive_citations: [],
    web_evidence: [
      {
        id: "ext-tdns-gbr",
        title: "TDNS / GBR strategy context",
        url: "https://www.gov.uk/",
        publisher: "DfT",
        verification_state: "candidate",
        provenance: "external",
      },
    ],
    provenance: {
      "stat-corpus": {
        ref: "atlas.projects · aggregate",
        scope: "rail + decarbonisation · cpc_modes ∋ rail · cpc_themes ∋ decarbonisation",
        trust: "corpus",
        trustNote: `SUM(funding_amount)=${stats.funding_sum.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} over ${stats.funded_row_count} funded rows; ${stats.null_funding_count}/${stats.project_count} null`,
        row: "corpus aggregate",
      },
      "mag-upper": {
        ref: "web context · TDNS / GBR strategy",
        scope: "national programme",
        trust: "web",
        trustNote: "No atlas.projects.id — candidate only; compressed axis",
        row: "[W1·W2·W3]",
      },
      funder: {
        ref: "atlas.projects · group by lead_funder",
        scope: "rail + decarbonisation",
        trust: "corpus",
        trustNote: iuk
          ? `Innovate UK = ${iuk.project_count} of ${stats.project_count} projects and ${iukDisplay} of ${fundingDisplay}. EPSRC = ${epsrcCount(stats)} projects, £0 recorded.`
          : "Funder breakdown from live aggregate",
        row: "corpus aggregate",
      },
    },
    reconciliation: {
      notes: [],
      retrieval: {
        lane_mode: "corpus_only",
        corpus_count: stats.project_count,
        external_count: 0,
        candidate_count: 0,
        conflict_count: 0,
        errors: [],
        external_skipped: true,
        corpus_thin: stats.project_count < 20,
      },
    },
    soWhat: {
      lookingAt:
        "A two-tier field. The instrument is the whole story — what we fund is a sliver of what's being spent.",
      oneDecision:
        "Which tier are we entering — the SME innovation layer we can see, or the national programme we can't? It changes every downstream move.",
      gate: "Close the TRIG blind-spot before you commit budget. It's the one gap you control.",
      primaryAction: "Diagnose the thinness → Ingest TRIG",
      turn: "1 / 4",
    },
    query: "State of play on rail decarbonisation in our corpus",
  };

  const validated = validateFinalAnswerSpec(spec);
  if (!validated.success) {
    throw new Error(
      `J1T1 spec failed validation: ${validated.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return validated.data;
}

export function buildJ1T1SpecFromStats(stats: J1T1CorpusStats): AnswerSpec {
  return assembleJ1T1Spec(stats);
}
