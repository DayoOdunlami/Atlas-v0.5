"use client";

import { useMemo } from "react";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

const MAX_MARKUP_BYTES = 65536;
const FORBIDDEN = /<(script|iframe|object|embed|link|form|foreignObject)\b/i;
const EVENT_HANDLER = /\son\w+\s*=/i;

/** Scoped defaults so free-compose tail aligns with spine tokens unless markup overrides. */
const COMPOSITION_SCOPED_CSS = `
.composition-canvas-inner h1,
.composition-canvas-inner h2,
.composition-canvas-inner h3 {
  font-family: ${atlasFont.serif};
  color: ${T.ink};
  font-weight: 600;
  line-height: 1.25;
  margin: 0 0 0.75rem;
}
.composition-canvas-inner p,
.composition-canvas-inner li {
  font-family: ${atlasFont.sans};
  color: ${T.inkSoft};
  font-size: 14px;
  line-height: 1.55;
}
.composition-canvas-inner section,
.composition-canvas-inner .atlas-section {
  margin-bottom: 1.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid ${T.ruleSoft};
}
.composition-canvas-inner .atlas-label,
.composition-canvas-inner [data-atlas-label] {
  font-family: ${atlasFont.mono};
  font-size: 9px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: ${T.inkFaint};
}
.composition-canvas-inner .atlas-callout {
  background: ${T.ruleSoft};
  border: 1px solid ${T.rule};
  border-radius: 8px;
  padding: 12px 16px;
}
.composition-canvas-inner .atlas-corpus {
  color: ${T.corpus};
}
.composition-canvas-inner .atlas-gap {
  color: ${T.gap};
}
`;

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
        color: T.ink,
      }}
    >
      <style>{COMPOSITION_SCOPED_CSS}</style>
      <div
        className="composition-canvas-inner"
        dangerouslySetInnerHTML={{ __html: safe }}
      />
    </div>
  );
}
