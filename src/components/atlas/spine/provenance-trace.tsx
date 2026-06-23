"use client";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { TrustBadge } from "@/components/atlas/spine/trust-badge";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

type ProvenanceMap = AnswerSpec["provenance"];
type Entry = ProvenanceMap[string];

export function ProvenanceTrace({
  provId,
  provenance,
  onClose,
  className,
}: {
  provId: string | null;
  provenance: ProvenanceMap;
  onClose: () => void;
  className?: string;
}) {
  if (!provId) return null;
  const entry: Entry | undefined = provenance[provId];
  if (!entry) return null;

  const trust = entry.trust === "synthesized" ? "corpus" : entry.trust;

  return (
    <div
      data-testid="provenance-trace"
      data-prov-id={provId}
      className={className}
      style={{
        width: 270,
        background: "#fff",
        borderRadius: 10,
        boxShadow: "0 10px 34px rgba(40,34,26,.18)",
        border: `1px solid ${T.ruleSoft}`,
        padding: 16,
        zIndex: 20,
      }}
    >
      <div className="mb-2.5 flex items-center justify-between">
        <div
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 10,
            letterSpacing: "0.1em",
            color: T.inkSoft,
            textTransform: "uppercase",
          }}
        >
          ⌖ Provenance
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close provenance"
          style={{
            border: "none",
            background: "none",
            cursor: "pointer",
            fontFamily: atlasFont.mono,
            fontSize: 13,
            color: T.inkFaint,
          }}
        >
          ×
        </button>
      </div>
      <div style={{ fontFamily: atlasFont.mono, fontSize: 12, color: T.ink, fontWeight: 500 }}>
        {entry.ref}
      </div>
      <div style={{ fontFamily: atlasFont.mono, fontSize: 11, color: T.inkFaint, marginTop: 2 }}>
        {entry.scope}
      </div>
      <div className="mt-3 border-t pt-3" style={{ borderColor: T.ruleSoft }}>
        <div className="mb-1.5">
          <TrustBadge trust={trust} />
        </div>
        <div style={{ fontFamily: atlasFont.sans, fontSize: 12, lineHeight: 1.5, color: T.inkSoft }}>
          {entry.trustNote}
        </div>
      </div>
      <div style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint, marginTop: 10 }}>
        {entry.row} ↗
      </div>
    </div>
  );
}
