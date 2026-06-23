"use client";

import { useMemo } from "react";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

const MAX_MARKUP_BYTES = 65536;
const FORBIDDEN = /<(script|iframe|object|embed|link|form|foreignObject)\b/i;
const EVENT_HANDLER = /\son\w+\s*=/i;

/** Minimal sanitiser — v1 allowlist; prefer isomorphic-dompurify when added to deps. */
function sanitiseMarkup(raw: string): string {
  if (raw.length > MAX_MARKUP_BYTES) {
    return "<p>Composition too large — fallback to recipe.</p>";
  }
  if (FORBIDDEN.test(raw) || EVENT_HANDLER.test(raw)) {
    return "<p>Composition blocked — unsafe markup.</p>";
  }
  return raw
    .replace(/javascript:/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "");
}

export function CompositionCanvas({
  canvas,
}: {
  canvas: NonNullable<AnswerSpec["canvas"]>;
}) {
  const html = canvas.merged_markup || canvas.markup;
  const safe = useMemo(() => sanitiseMarkup(html || ""), [html]);

  if (!safe.trim()) {
    return null;
  }

  return (
    <div
      data-testid="composition-canvas"
      data-gate-status={canvas.gate_status ?? "unknown"}
      className="composition-canvas mb-6 max-w-[720px] rounded-lg border p-4"
      style={{
        borderColor: T.rule,
        background: T.canvas,
        fontFamily: atlasFont.sans,
        color: "#1A1714",
      }}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
