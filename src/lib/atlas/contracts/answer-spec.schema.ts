/**
 * Atlas v5 — AnswerSpec contract (mouth / GATE 0a)
 *
 * Canonical Zod schema for brain↔mouth seam on `/atlas`.
 * Python mirror: agents/contracts/answer_spec.py
 *
 * Validate at GATE boundaries:
 *   AnswerSpecEnvelopeSchema.parse(payload)
 */

import { z } from "zod";
import { sanitizeAnswerSpecForMouth } from "@/lib/atlas/sanitize-answer-spec";
import {
  ConfidenceTierSchema,
  CorpusCitationSchema,
  HiveCitationSchema,
  ClaimStateSchema,
} from "@/lib/atlas5/artifact-schema";

// ---------------------------------------------------------------------------
// Enums (repo-aligned)
// ---------------------------------------------------------------------------

export const OutcomeModeSchema = z.enum([
  "Orient",
  "Connect",
  "Diagnose",
  "Act",
  "Defend",
]);

export const TrustScopeSchema = z.enum([
  "corpus",
  "web",
  "synthesized",
  "declared",
]);

export const BlindspotSignSchema = z.enum(["undercount", "absence"]);

export const ReconciliationNoteTypeSchema = z.enum([
  "corroborate",
  "conflict",
  "discover",
  "external_primary",
]);

export const LaneModeSchema = z.enum([
  "corpus_only",
  "corpus_primary",
  "dual",
  "external_primary",
]);

export const AnswerSpecStatusSchema = z.enum(["partial", "final", "error"]);

// ---------------------------------------------------------------------------
// Citations & claims
// ---------------------------------------------------------------------------

export const WebEvidenceSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  url: z.string().url().optional().or(z.literal("")),
  publisher: z.string().optional(),
  snippet: z.string().optional(),
  retrieval_tool: z.string().optional(),
  source_tier: z
    .enum(["primary_gov", "funder", "publisher", "news", "other"])
    .optional(),
  verification_state: z.literal("candidate").default("candidate"),
  provenance: z.literal("external").default("external"),
});

export const ClaimSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  source: TrustScopeSchema,
  trust: z.string().min(1),
  tier: ConfidenceTierSchema,
  caveat: z.string().optional(),
  claim_state: ClaimStateSchema.optional(),
  /** Links to provenance[id] and/or corpus_citations / web_evidence */
  provId: z.string().optional(),
  corpus_id: z.string().uuid().optional(),
  web_id: z.string().optional(),
});

export const ProvenanceEntrySchema = z.object({
  ref: z.string().min(1),
  scope: z.string().min(1),
  trust: TrustScopeSchema,
  trustNote: z.string().min(1),
  row: z.string().min(1),
  url: z.string().optional().nullable(),
});

// ---------------------------------------------------------------------------
// Retrieval + reconciliation (Phase F — live repo shapes)
// ---------------------------------------------------------------------------

export const RetrievalMetaSchema = z.object({
  lane_mode: LaneModeSchema,
  corpus_count: z.number().int().nonnegative(),
  external_count: z.number().int().nonnegative(),
  candidate_count: z.number().int().nonnegative().default(0),
  corpus_ms: z.number().nonnegative().optional(),
  external_ms: z.number().nonnegative().optional(),
  errors: z.array(z.string()).default([]),
  external_skipped: z.boolean().default(false),
  govuk_count: z.number().int().nonnegative().optional(),
  exa_count: z.number().int().nonnegative().optional(),
  conflict_count: z.number().int().nonnegative().default(0),
  corpus_thin: z.boolean().optional(),
  external_led: z.boolean().optional(),
});

export const ReconciliationNoteSchema = z.object({
  type: ReconciliationNoteTypeSchema,
  message: z.string().optional(),
  corpus_signal: z.string().optional(),
  external_signal: z.string().optional(),
  note: z.string().optional(),
});

export const ReconciliationSchema = z.object({
  notes: z.array(ReconciliationNoteSchema).default([]),
  retrieval: RetrievalMetaSchema,
});

// ---------------------------------------------------------------------------
// Instruments (recipes)
// ---------------------------------------------------------------------------

export const InstrumentSchema = z.object({
  recipe: z.string().min(1),
  data: z.record(z.string(), z.unknown()),
  honesty: z
    .object({
      toScale: z.boolean(),
      label: z.string().optional(),
    })
    .optional(),
});

export const GateStatusSchema = z.enum([
  "pass",
  "reject",
  "fallback_recipe",
  "degrade_prose",
]);

export const ChartBlockSchema = z.object({
  engine: z.literal("echarts").default("echarts"),
  kind: z.enum(["bar", "line", "pie", "network"]).default("bar"),
  title: z.string().optional(),
  option: z.record(z.string(), z.unknown()).default({}),
  data_keys: z.array(z.string()).default([]),
  gate_status: GateStatusSchema.optional(),
  gate_errors: z.array(z.string()).default([]),
});

export const CanvasBlockSchema = z.object({
  markup: z.string().default(""),
  merged_markup: z.string().optional(),
  trust_map: z.record(z.string(), z.string()).optional(),
  scale_bindings: z
    .record(z.string(), z.object({ key: z.string(), policy: z.string() }))
    .optional(),
  gate_status: GateStatusSchema.optional(),
  gate_errors: z.array(z.string()).default([]),
});

// ---------------------------------------------------------------------------
// Turn accretion
// ---------------------------------------------------------------------------

export const CarriedFromSchema = z.object({
  turn: z.number().int().positive(),
  of: z.number().int().positive().optional(),
  summary: z.string().min(1),
  fromTurns: z.array(z.number().int().positive()).default([]),
  evolvedFields: z
    .array(z.enum(["verdict", "tier", "instrument", "stats", "blindspot"]))
    .optional(),
});

// ---------------------------------------------------------------------------
// AnswerSpec core
// ---------------------------------------------------------------------------

export const VerdictSchema = z.object({
  sentence: z.string().min(1),
  tail: z.string().optional(),
});

export const StatSchema = z.object({
  value: z.string().min(1),
  label: z.string().min(1),
  provId: z.string().optional(),
  tone: z.enum(["corpus", "web", "neutral"]).optional(),
});

export const BlindspotStructureSchema = z.object({
  /** Why the gap is shaped — e.g. nulls concentrate in EPSRC awards */
  pattern: z.string().min(1),
  /** What the shape implies for interpretation — e.g. floor ≈ complete IUK spend */
  implication: z.string().min(1),
});

export const BlindspotSchema = z.object({
  sign: BlindspotSignSchema,
  gap: z.string().min(1),
  closable: z.string().optional(),
  secondary: z.string().optional(),
  structure: BlindspotStructureSchema.optional(),
});

export const SoWhatSchema = z.object({
  lookingAt: z.string().min(1),
  oneDecision: z.string().min(1),
  gate: z.string().min(1),
  primaryAction: z.string().min(1),
  turn: z.string().min(1),
});

/** Fields required when envelope.status === 'final' */
export const AnswerSpecSchema = z.object({
  specVersion: z.literal("0.2.1").default("0.2.1"),
  object: z.string().min(1),
  scope: z.string().min(1),
  mode: OutcomeModeSchema,
  tier: ConfidenceTierSchema,
  tierCapReason: z.string().optional(),
  verdict: VerdictSchema,
  stats: z.array(StatSchema).optional(),
  blindspot: BlindspotSchema.optional(),
  instrument: InstrumentSchema.optional(),
  chart: ChartBlockSchema.optional(),
  canvas: CanvasBlockSchema.optional(),
  claims: z.array(ClaimSchema).default([]),
  corpus_citations: z.array(CorpusCitationSchema).default([]),
  hive_citations: z.array(HiveCitationSchema).default([]),
  web_evidence: z.array(WebEvidenceSchema).default([]),
  provenance: z.record(z.string(), ProvenanceEntrySchema).default({}),
  reconciliation: ReconciliationSchema.optional(),
  carriedFrom: CarriedFromSchema.optional(),
  soWhat: SoWhatSchema,
  query: z.string().optional(),
  thread_id: z.string().optional(),
});

export type AnswerSpec = z.infer<typeof AnswerSpecSchema>;

// ---------------------------------------------------------------------------
// Streaming / delivery envelope (assistant-ui seam)
// ---------------------------------------------------------------------------

/**
 * Brain publishes monotonic revisions on graph state key `answer_spec_envelope`.
 * Mouth merges partial specs until status=final, then runs full validation.
 */
export const AnswerSpecEnvelopeSchema = z.object({
  revision: z.number().int().nonnegative(),
  status: AnswerSpecStatusSchema,
  spec: AnswerSpecSchema.partial().optional(),
  error: z.string().optional(),
});

export type AnswerSpecEnvelope = z.infer<typeof AnswerSpecEnvelopeSchema>;

/** Ceiling fractions — must match ConfidenceCeiling primitive */
export const TIER_CEILING_FRACTION: Record<
  z.infer<typeof ConfidenceTierSchema>,
  number
> = {
  Speculative: 0.28,
  Indicative: 0.44,
  Supported: 0.66,
  Robust: 0.88,
};

export function validateFinalAnswerSpec(
  spec: unknown,
): z.SafeParseReturnType<unknown, AnswerSpec> {
  return AnswerSpecSchema.safeParse(sanitizeAnswerSpecForMouth(spec));
}

/** Partial specs from streaming envelope — permissive merge target. */
export function validatePartialAnswerSpec(
  spec: unknown,
): z.SafeParseReturnType<unknown, Partial<AnswerSpec>> {
  return AnswerSpecSchema.partial().safeParse(spec);
}

export function formatZodError(error: z.ZodError): string {
  return JSON.stringify(error.flatten(), null, 2);
}
