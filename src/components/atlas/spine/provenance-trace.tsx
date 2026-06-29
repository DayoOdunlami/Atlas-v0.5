"use client";

import { useCallback, useEffect, useState } from "react";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { TrustBadge } from "@/components/atlas/spine/trust-badge";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

type ProvenanceMap = AnswerSpec["provenance"];
type Entry = ProvenanceMap[string];

type CorpusProject = {
  id: string;
  title: string;
  organisation?: string;
  abstract?: string;
};

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
  const entry: Entry | undefined = provId ? provenance[provId] : undefined;
  const corpusId = entry?.corpus_id ?? null;

  const [project, setProject] = useState<CorpusProject | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchProject = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/atlas/projects/${id}`);
      if (!res.ok) return;
      const body = (await res.json()) as { project?: CorpusProject };
      if (body.project) setProject(body.project);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setProject(null);
    if (corpusId) void fetchProject(corpusId);
  }, [corpusId, fetchProject]);

  if (!provId || !entry) return null;

  const trust =
    entry.trust === "synthesized"
      ? "corpus"
      : entry.trust === "declared"
        ? "declared"
        : entry.trust;

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
      {corpusId ? (
        <div
          className="mt-3 border-t pt-3"
          data-testid="corpus-proof-panel"
          style={{ borderColor: T.ruleSoft }}
        >
          <div
            className="mb-1 uppercase"
            style={{
              fontFamily: atlasFont.mono,
              fontSize: 9,
              letterSpacing: "0.1em",
              color: T.corpus,
            }}
          >
            Corpus proof
          </div>
          {loading ? (
            <p style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint, margin: 0 }}>
              Loading project…
            </p>
          ) : project ? (
            <>
              <p
                className="m-0 text-[12px] font-medium leading-snug"
                style={{ color: T.ink, fontFamily: atlasFont.sans }}
              >
                {project.title}
              </p>
              {project.organisation ? (
                <p
                  className="m-0 mt-1 text-[11px]"
                  style={{ color: T.inkSoft, fontFamily: atlasFont.mono }}
                >
                  {project.organisation}
                </p>
              ) : null}
              {project.abstract ? (
                <p
                  className="m-0 mt-2 text-[11px] leading-snug"
                  style={{ color: T.inkSoft, fontFamily: atlasFont.sans }}
                >
                  {project.abstract.slice(0, 200)}
                  {project.abstract.length > 200 ? "…" : ""}
                </p>
              ) : null}
            </>
          ) : (
            <p style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.gap, margin: 0 }}>
              Project id {corpusId.slice(0, 8)}… not found in corpus
            </p>
          )}
        </div>
      ) : null}
      <div style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint, marginTop: 10 }}>
        {entry.row} ↗
      </div>
    </div>
  );
}
