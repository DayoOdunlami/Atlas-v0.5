"use client";

import { useMemo, useState } from "react";
import {
  AnswerabilityCard,
  ConfidenceCeiling,
  ProvenanceTrace,
  SourceBadge,
  TierBadge,
  TrustBadge,
} from "@/components/atlas/spine";
import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { loadJ1T1Golden } from "@/lib/atlas/golden-j1t1";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

function VerdictPreview({ spec }: { spec: AnswerSpec }) {
  return (
    <div className="mb-6 max-w-3xl">
      <h1
        style={{
          fontFamily: atlasFont.serif,
          fontWeight: 500,
          fontSize: 28,
          lineHeight: 1.28,
          color: T.ink,
          margin: "0 0 12px",
        }}
      >
        {spec.verdict.sentence}
      </h1>
      {spec.verdict.tail ? (
        <p style={{ fontFamily: atlasFont.sans, fontSize: 14, lineHeight: 1.6, color: T.inkSoft, margin: 0 }}>
          {spec.verdict.tail}
        </p>
      ) : null}
    </div>
  );
}

function PrimitiveLab({ spec }: { spec: AnswerSpec }) {
  const [provId, setProvId] = useState<string | null>(null);
  const provKeys = useMemo(() => Object.keys(spec.provenance), [spec.provenance]);

  return (
    <div className="space-y-10">
      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest" style={{ color: T.inkFaint, fontFamily: atlasFont.mono }}>
          1 · Trust badges
        </h2>
        <div className="flex flex-wrap gap-4">
          <TrustBadge trust="corpus" />
          <TrustBadge trust="web" />
          <SourceBadge source="corpus" title="atlas.projects" />
          <SourceBadge source="web" title="TDNS / GBR" />
          <TierBadge tier={spec.tier} />
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest" style={{ color: T.inkFaint, fontFamily: atlasFont.mono }}>
          2 · AnswerabilityCard
        </h2>
        {spec.blindspot ? <AnswerabilityCard blindspot={spec.blindspot} /> : null}
      </section>

      <section className="relative">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-widest" style={{ color: T.inkFaint, fontFamily: atlasFont.mono }}>
          3 · ConfidenceCeiling + ProvenanceTrace
        </h2>
        <p className="mb-4 text-sm" style={{ color: T.inkSoft, fontFamily: atlasFont.sans }}>
          Click a stat to open provenance peel.
        </p>
        <div className="relative">
          <ProvenanceTrace
            provId={provId}
            provenance={spec.provenance}
            onClose={() => setProvId(null)}
            className="absolute right-3 top-3"
          />
          <ConfidenceCeiling tier={spec.tier} cappedReason={spec.tierCapReason}>
            <VerdictPreview spec={spec} />
            <div className="mb-4 flex flex-wrap gap-2">
              {spec.stats?.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setProvId(s.provId ?? "stat-corpus")}
                  className="rounded-lg border px-4 py-3 text-left transition hover:opacity-90"
                  style={{
                    borderColor: T.ruleSoft,
                    background: T.canvas,
                    minWidth: 120,
                  }}
                >
                  <div style={{ fontFamily: atlasFont.serif, fontSize: 22, color: T.corpus, fontWeight: 500 }}>
                    {s.value}
                  </div>
                  <div style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint, marginTop: 4 }}>
                    {s.label}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {provKeys.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setProvId(id)}
                  className="rounded px-2 py-1 text-xs underline"
                  style={{ fontFamily: atlasFont.mono, color: T.inkSoft }}
                >
                  ⌖ {id}
                </button>
              ))}
            </div>
          </ConfidenceCeiling>
        </div>
      </section>
    </div>
  );
}

export function AtlasSpineSmoke({ spec }: { spec: AnswerSpec }) {
  return (
    <div data-testid="atlas-spine-smoke">
      <header className="mb-8 border-b pb-4" style={{ borderColor: T.rule }}>
        <p style={{ fontFamily: atlasFont.mono, fontSize: 10, letterSpacing: "0.12em", color: T.inkFaint, textTransform: "uppercase" }}>
          GATE 0b · Trust primitives
        </p>
        <h1 style={{ fontFamily: atlasFont.serif, fontSize: 22, color: T.ink, margin: "8px 0 4px" }}>
          {spec.object}
        </h1>
        <p style={{ fontFamily: atlasFont.mono, fontSize: 11, color: T.inkFaint }}>{spec.scope}</p>
      </header>
      <PrimitiveLab spec={spec} />
      <footer className="mt-10 flex gap-4" style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}>
        <span>● corpus — solid</span>
        <span style={{ color: T.web }}>┄ web — dashed</span>
        <span style={{ color: T.gap }}>⌁ gap — torn</span>
      </footer>
    </div>
  );
}

export function AtlasSpineSmokeFromGolden() {
  const spec = useMemo(() => loadJ1T1Golden(), []);
  return <AtlasSpineSmoke spec={spec} />;
}
