import type { AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";
import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";

export type LayoutSignals = {
  composition_mode?: string | null;
  instrument_recipe?: string | null;
  visual_form?: string | null;
  markup_hash?: string | null;
  markup_bytes?: number | null;
  keyed_key_count?: number | null;
  gate_status?: string | null;
  fallback_rung?: string | null;
  route?: string | null;
  outcome_hint?: string | null;
};

function simpleHash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return `h${(h >>> 0).toString(16)}`;
}

export function extractLayoutSignals(
  spec: AnswerSpec | null | undefined,
  devMeta: AtlasDevMeta | null | undefined,
): LayoutSignals {
  const markup =
    spec?.canvas?.markup ?? spec?.canvas?.merged_markup ?? "";
  const markupStr = typeof markup === "string" ? markup : "";

  return {
    composition_mode: devMeta?.disposition?.composition_mode ?? null,
    instrument_recipe: spec?.instrument?.recipe ?? null,
    visual_form: devMeta?.visual_intent ?? null,
    markup_hash: markupStr ? simpleHash(markupStr.slice(0, 8000)) : null,
    markup_bytes: markupStr ? markupStr.length : null,
    keyed_key_count: devMeta?.keyed_keys?.length ?? null,
    gate_status: devMeta?.gate_status ?? spec?.canvas?.gate_status ?? null,
    fallback_rung: devMeta?.fallback_rung ?? null,
    route: devMeta?.route ?? null,
    outcome_hint:
      (devMeta as { outcome_hint?: string } | null)?.outcome_hint ?? null,
  };
}

export function titleFromQuery(query: string): string {
  const q = query.trim().replace(/\s+/g, " ");
  if (!q) return "New session";
  return q.length <= 72 ? q : `${q.slice(0, 69)}…`;
}
