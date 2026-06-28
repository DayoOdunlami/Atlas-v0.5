"use client";

import { Check, FolderOpen, Pencil, Save, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { TrustSwatch } from "@/components/atlas/spine/trust-badge";
import {
  attachCaseEntity,
  fetchCaseEntities,
  fetchCaseFile,
  patchCaseFile,
  promoteToCaseEntity,
} from "@/lib/atlas/case-file-client";
import {
  CASE_CLAIM_KIND_LABELS,
  CASE_CLAIM_KINDS,
  declaredClaimsFromSpec,
  mergeDeclaredClaims,
  SWOT_ON_CLAIMS_PROMPT,
  type CaseClaim,
  type CaseClaimKind,
  type CaseEntitySummary,
} from "@/lib/atlas/case-file-types";
import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";
import { cn } from "@/lib/utils";

function kindColor(kind: CaseClaimKind): string {
  switch (kind) {
    case "constraint":
      return "#9A3412";
    case "hypothesis":
      return "#6B21A8";
    case "uncertainty":
      return "#854D0E";
    case "domain":
      return "#1E4D7B";
    default:
      return T.declared;
  }
}

function ClaimRow({
  claim,
  expanded,
  editing,
  onEdit,
  onSave,
  onConfirm,
  onReject,
  disabled,
}: {
  claim: CaseClaim;
  expanded: boolean;
  editing: boolean;
  onEdit: () => void;
  onSave: (patch: Pick<CaseClaim, "text" | "kind">) => void;
  onConfirm: () => void;
  onReject: () => void;
  disabled?: boolean;
}) {
  const [draftText, setDraftText] = useState(claim.text);
  const [draftKind, setDraftKind] = useState(claim.kind);

  useEffect(() => {
    setDraftText(claim.text);
    setDraftKind(claim.kind);
  }, [claim.text, claim.kind]);

  const rejected = claim.review_status === "rejected";
  const confirmed = claim.review_status === "confirmed";

  return (
    <li
      data-testid={`case-claim-${claim.id}`}
      data-claim-kind={claim.kind}
      className={cn(
        "rounded-md border px-2 py-2 transition-opacity",
        rejected && "opacity-50",
      )}
      style={{
        borderColor: confirmed ? T.declared : T.ruleSoft,
        background: T.declaredWash,
      }}
    >
      <div className="flex items-start gap-2">
        <TrustSwatch trust="declared" />
        <div className="min-w-0 flex-1">
          {expanded ? (
            <span
              className="mb-1 inline-block rounded px-1.5 py-0.5 uppercase"
              style={{
                fontFamily: atlasFont.mono,
                fontSize: 9,
                letterSpacing: "0.06em",
                color: kindColor(claim.kind),
                background: "#FFF",
                border: `1px solid ${T.ruleSoft}`,
              }}
            >
              {CASE_CLAIM_KIND_LABELS[claim.kind]}
            </span>
          ) : null}

          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                rows={3}
                className="w-full resize-none rounded border px-2 py-1 text-xs"
                style={{ borderColor: T.rule, fontFamily: atlasFont.sans }}
              />
              <select
                value={draftKind}
                onChange={(e) => setDraftKind(e.target.value as CaseClaimKind)}
                className="w-full rounded border px-2 py-1 text-xs"
                style={{ borderColor: T.rule, fontFamily: atlasFont.mono }}
              >
                {CASE_CLAIM_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {CASE_CLAIM_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={disabled || !draftText.trim()}
                onClick={() => onSave({ text: draftText.trim(), kind: draftKind })}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs disabled:opacity-40"
                style={{ background: T.corpus, color: "#FFF" }}
              >
                <Save className="size-3" />
                Save
              </button>
            </div>
          ) : (
            <p
              className="m-0 text-xs leading-snug"
              style={{
                fontFamily: atlasFont.sans,
                color: T.ink,
                textDecoration: rejected ? "line-through" : undefined,
              }}
            >
              {expanded ? claim.text : claim.text.slice(0, 48) + (claim.text.length > 48 ? "…" : "")}
            </p>
          )}

          {expanded && !editing ? (
            <p
              className="mt-1 mb-0"
              style={{ fontFamily: atlasFont.mono, fontSize: 9, color: T.inkFaint }}
            >
              Stated by user · max Indicative
            </p>
          ) : null}
        </div>

        {expanded && !editing ? (
          <div className="flex shrink-0 flex-col gap-1">
            <button
              type="button"
              title="Confirm claim"
              disabled={disabled || confirmed}
              onClick={onConfirm}
              className="rounded p-1 disabled:opacity-30"
              style={{ color: T.corpus }}
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              title="Edit claim"
              disabled={disabled}
              onClick={onEdit}
              className="rounded p-1"
              style={{ color: T.inkFaint }}
            >
              <Pencil className="size-3.5" />
            </button>
            <button
              type="button"
              title="Reject claim"
              disabled={disabled || rejected}
              onClick={onReject}
              className="rounded p-1 disabled:opacity-30"
              style={{ color: "#9A3412" }}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

export function CaseFilePanel({
  threadId,
  spec,
  expanded,
  embedded = false,
  disabled,
  onSwotRequest,
  onEntityAttached,
}: {
  threadId: string | null;
  spec: AnswerSpec | null;
  expanded: boolean;
  /** When true, body only — parent rail section owns the header/collapse. */
  embedded?: boolean;
  disabled?: boolean;
  onSwotRequest?: (message: string) => void;
  onEntityAttached?: (entityId: string | null) => void;
}) {
  const specClaims = useMemo(() => declaredClaimsFromSpec(spec), [spec]);
  const [remoteClaims, setRemoteClaims] = useState<CaseClaim[]>([]);
  const [caseEntityId, setCaseEntityId] = useState<string | null>(null);
  const [entities, setEntities] = useState<CaseEntitySummary[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [persistEnabled, setPersistEnabled] = useState(false);
  const [entitiesOpen, setEntitiesOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastAttachedEntityRef = useRef<string | null | undefined>(undefined);

  const claims = useMemo(
    () => mergeDeclaredClaims(specClaims, remoteClaims),
    [specClaims, remoteClaims],
  );

  const refreshRemote = useCallback(async () => {
    if (!threadId) return;
    const snapshot = await fetchCaseFile(threadId);
    if (snapshot) {
      setRemoteClaims(snapshot.claims);
      setCaseEntityId(snapshot.case_entity_id);
      setPersistEnabled(snapshot.persist_enabled);
      if (lastAttachedEntityRef.current !== snapshot.case_entity_id) {
        lastAttachedEntityRef.current = snapshot.case_entity_id;
        onEntityAttached?.(snapshot.case_entity_id);
      }
    }
  }, [threadId, onEntityAttached]);

  useEffect(() => {
    void refreshRemote();
  }, [refreshRemote, specClaims.length]);

  useEffect(() => {
    void fetchCaseEntities().then(({ entities: list }) => setEntities(list));
  }, [caseEntityId]);

  const persistClaims = useCallback(
    async (next: CaseClaim[]) => {
      if (!threadId || !persistEnabled) {
        setRemoteClaims(next);
        return;
      }
      setBusy(true);
      const saved = await patchCaseFile(threadId, next);
      if (saved) {
        setRemoteClaims(saved.claims);
        setCaseEntityId(saved.case_entity_id);
      }
      setBusy(false);
    },
    [threadId, persistEnabled],
  );

  const updateClaim = useCallback(
    (id: string, patch: Partial<CaseClaim>) => {
      const next = claims.map((c) => (c.id === id ? { ...c, ...patch } : c));
      void persistClaims(next);
      setEditingId(null);
    },
    [claims, persistClaims],
  );

  const handlePromote = useCallback(async () => {
    if (!threadId) return;
    setBusy(true);
    const title =
      spec?.object?.label?.slice(0, 80) ||
      spec?.query?.slice(0, 80) ||
      "My case file";
    const result = await promoteToCaseEntity(threadId, title);
    if (result) {
      setCaseEntityId(result.entity.id);
      onEntityAttached?.(result.entity.id);
      void refreshRemote();
      void fetchCaseEntities().then(({ entities: list }) => setEntities(list));
    }
    setBusy(false);
  }, [threadId, spec, onEntityAttached, refreshRemote]);

  const handleAttach = useCallback(
    async (entityId: string) => {
      if (!threadId) return;
      setBusy(true);
      const ok = await attachCaseEntity(threadId, entityId);
      if (ok) {
        setCaseEntityId(entityId);
        onEntityAttached?.(entityId);
        void refreshRemote();
      }
      setBusy(false);
    },
    [threadId, onEntityAttached, refreshRemote],
  );

  if (!threadId) return null;

  const panelBody = (
    <>
      {!embedded ? (
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <div>
            <p
              className="m-0 uppercase"
              style={{
                fontFamily: atlasFont.mono,
                fontSize: 9,
                letterSpacing: "0.1em",
                color: T.declared,
              }}
            >
              Case file
            </p>
            <p
              className="m-0 mt-0.5"
              style={{ fontFamily: atlasFont.sans, fontSize: 10, color: T.inkFaint }}
            >
              {claims.length} declared · max Indicative
            </p>
          </div>
          {claims.length > 0 && onSwotRequest ? (
            <button
              type="button"
              data-testid="case-file-swot-btn"
              disabled={disabled || busy}
              title="Ask Atlas for a SWOT on your stated claims"
              onClick={() => onSwotRequest(SWOT_ON_CLAIMS_PROMPT)}
              className="flex items-center gap-1 rounded border px-2 py-1 text-[10px] disabled:opacity-40"
              style={{
                borderColor: T.declared,
                color: T.declared,
                background: T.declaredWash,
                fontFamily: atlasFont.mono,
              }}
            >
              <Sparkles className="size-3" />
              SWOT
            </button>
          ) : null}
        </div>
      ) : null}

      {claims.length === 0 ? (
        <p
          className="px-1 py-2"
          style={{ fontFamily: atlasFont.sans, fontSize: 11, color: T.inkFaint }}
        >
          Tell Atlas your situation — constraints, goals, or uncertainties appear here as
          declared claims.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2 overflow-y-auto p-0 px-1">
          {claims.map((c) => (
            <ClaimRow
              key={c.id}
              claim={c}
              expanded={embedded || expanded}
              editing={editingId === c.id}
              disabled={disabled || busy}
              onEdit={() => setEditingId(c.id)}
              onSave={(patch) => updateClaim(c.id, patch)}
              onConfirm={() => updateClaim(c.id, { review_status: "confirmed" })}
              onReject={() => updateClaim(c.id, { review_status: "rejected" })}
            />
          ))}
        </ul>
      )}

      <div className="mt-2 space-y-1 px-1">
        {!caseEntityId ? (
          <button
            type="button"
            data-testid="case-file-promote"
            disabled={disabled || busy || claims.length === 0}
            onClick={() => void handlePromote()}
            className="flex w-full items-center gap-2 rounded border px-2 py-1.5 text-left text-[11px] disabled:opacity-40"
            style={{ borderColor: T.ruleSoft, color: T.inkSoft }}
          >
            <FolderOpen className="size-3.5 shrink-0" />
            Save as case entity
          </button>
        ) : (
          <p
            className="m-0 px-1"
            style={{ fontFamily: atlasFont.mono, fontSize: 9, color: T.corpus }}
          >
            Linked to entity · {caseEntityId.slice(0, 8)}…
          </p>
        )}

        <button
          type="button"
          data-testid="case-entities-toggle"
          onClick={() => setEntitiesOpen((v) => !v)}
          className="w-full rounded px-1 py-1 text-left text-[10px]"
          style={{ fontFamily: atlasFont.mono, color: T.inkFaint }}
        >
          {entitiesOpen ? "▾" : "▸"} Case entities ({entities.length})
        </button>

        {entitiesOpen && entities.length > 0 ? (
          <ul className="m-0 max-h-28 list-none space-y-1 overflow-y-auto p-0">
            {entities.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  disabled={disabled || busy || e.id === caseEntityId}
                  onClick={() => void handleAttach(e.id)}
                  className="w-full truncate rounded px-1 py-1 text-left text-[11px] hover:underline disabled:opacity-40"
                  style={{ fontFamily: atlasFont.sans, color: T.inkSoft }}
                >
                  {e.title} · {e.claim_count} claims
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div data-testid="case-file-panel" className="px-0.5">
        {panelBody}
      </div>
    );
  }

  return (
    <div
      data-testid="case-file-panel"
      className="border-t"
      style={{ borderColor: T.ruleSoft }}
    >
      <div className={cn("px-2 py-2", !expanded && "flex justify-center")}>
        {expanded ? (
          panelBody
        ) : (
          <span
            data-testid="case-file-collapsed-badge"
            title="Case file"
            className="inline-flex size-6 items-center justify-center rounded-full text-[10px] font-medium"
            style={{
              background: claims.length ? T.declaredWash : T.ruleSoft,
              color: claims.length ? T.declared : T.inkFaint,
              border: `1px solid ${claims.length ? T.declared : T.rule}`,
            }}
          >
            {claims.length || "◇"}
          </span>
        )}
      </div>
    </div>
  );
}
