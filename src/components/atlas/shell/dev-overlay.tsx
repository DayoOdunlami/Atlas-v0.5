"use client";

import { useEffect, useState } from "react";

const DEV_OVERLAY_STORAGE_KEY = "atlas-dev-overlay-open";
export const ATLAS_DEV_OVERLAY_OPEN_EVENT = "atlas5:dev-overlay-open";

export function openAtlasDevOverlay(): void {
  try {
    sessionStorage.setItem(DEV_OVERLAY_STORAGE_KEY, "1");
    window.dispatchEvent(new Event(ATLAS_DEV_OVERLAY_OPEN_EVENT));
  } catch {
    /* ignore */
  }
}

import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";
import type { AtlasUxPrefs } from "@/lib/atlas/ux-preferences";

export type AtlasDevMeta = {
  turn_stage?: string | null;
  turn_active?: boolean;
  disposition?: {
    primary_surface?: string;
    canvas_action?: string;
    composition_mode?: string;
    reasoning?: string;
  };
  keyed_keys?: string[];
  web_keys_absent_reason?: string | null;
  research_keys_absent_reason?: string | null;
  lane_mode?: string;
  external_skipped?: boolean;
  gate_status?: string | null;
  gate_errors?: string[];
  fallback_rung?: string | null;
  partial_stage?: string | null;
  free_compose_enabled?: boolean;
  route?: string;
  route_source?: string;
  corpus_status?: string;
  online_only?: {
    pending?: boolean;
    active?: boolean;
    query?: string;
  };
  zod_error?: string;
  stage_ms?: Record<string, number>;
  lead_lane?: string;
  trust_conflicts?: string[];
  validation_summary?: Record<string, unknown>;
  visual_intent?: string;
  visual_strength?: string;
  visual_suppressed?: boolean;
  visual_suppression?: string[];
  visual_suppression_reason?: string;
  charts_attached?: number;
  chart_kinds?: string[];
  visual_opportunities?: Array<{
    kind: string;
    role: string;
    story: string;
    priority: number;
  }>;
  visual_rejected?: Array<{ kind: string; reason: string; role?: string }>;
  showcase?: {
    active?: boolean;
    mode?: string;
    domain?: string;
    step?: number;
    total?: number;
    title?: string;
    options?: Array<{ id: string; label: string; command: string }>;
  };
};

export function DevOverlay({
  meta,
  dataSource,
  uxPrefs,
  onUxPrefsChange,
  turnTiming,
}: {
  meta: AtlasDevMeta | null;
  dataSource?: string;
  uxPrefs?: AtlasUxPrefs;
  onUxPrefsChange?: (patch: Partial<AtlasUxPrefs>) => void;
  turnTiming?: { elapsedMs: number | null; running: boolean };
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(DEV_OVERLAY_STORAGE_KEY);
      if (stored === "1") setOpen(true);
    } catch {
      /* ignore */
    }
    const onOpen = () => setOpen(true);
    window.addEventListener(ATLAS_DEV_OVERLAY_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ATLAS_DEV_OVERLAY_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(DEV_OVERLAY_STORAGE_KEY, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [open]);

  const show =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ATLAS_DEV_OVERLAY === "1";

  if (!show) {
    return null;
  }

  const hasMeta = meta && Object.keys(meta).length > 0;

  const d = meta?.disposition ?? {};

  return (
    <div
      data-testid="atlas-dev-overlay"
      className="fixed bottom-4 right-4 z-50 max-w-xs rounded-lg border shadow-lg"
      style={{
        borderColor: T.rule,
        background: "#1A1714",
        color: "#FBFAF7",
        fontFamily: atlasFont.mono,
        fontSize: 10,
      }}
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="min-w-0 flex-1 px-3 py-2 text-left uppercase tracking-wider"
          style={{ color: "#94908A" }}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          Atlas dev {open ? "▾" : "▸"}
        </button>
        {open ? (
          <button
            type="button"
            className="shrink-0 px-2 py-2 uppercase tracking-wider"
            style={{ color: "#94908A" }}
            onClick={() => setOpen(false)}
            aria-label="Close dev overlay"
            title="Close"
          >
            ✕
          </button>
        ) : null}
      </div>
      {open ? (
        <div
          className="max-h-[min(50vh,420px)] space-y-1 overflow-y-auto border-t px-3 py-2"
          style={{ borderColor: "#5A5249" }}
        >
          {!hasMeta ? (
            <p style={{ color: "#94908A" }}>
              Waiting for turn metadata — send a message or pick a showcase journey.
            </p>
          ) : null}
          <Row k="dataSource" v={dataSource} />
          {turnTiming ? (
            <Row
              k="turn"
              v={
                turnTiming.running
                  ? `${((turnTiming.elapsedMs ?? 0) / 1000).toFixed(1)}s · running`
                  : turnTiming.elapsedMs != null
                    ? `${(turnTiming.elapsedMs / 1000).toFixed(1)}s · complete`
                    : "—"
              }
            />
          ) : null}
          <Row k="stage" v={meta?.turn_stage ?? "—"} />
          <Row k="partial" v={meta?.partial_stage ?? "—"} />
          <Row k="surface" v={d.primary_surface} />
          <Row k="canvas_action" v={d.canvas_action} />
          <Row k="composition" v={d.composition_mode} />
          <Row k="route" v={`${meta?.route ?? "—"} (${meta?.route_source ?? "—"})`} />
          <Row k="lane" v={`${meta?.lane_mode ?? "—"} skip=${String(meta?.external_skipped)} peer=${meta?.lane_mode === "dual" ? "yes" : "no"}`} />
          <Row k="keys" v={`${meta?.keyed_keys?.length ?? 0} available`} />
          {meta?.web_keys_absent_reason ? (
            <Row k="web.*" v="absent (corpus-only)" />
          ) : null}
          {meta?.research_keys_absent_reason ? (
            <Row k="research.*" v="off (ATLAS_V5_RESEARCH_LANE=0)" />
          ) : meta?.validation_summary?.research_figures ? (
            <Row k="research.*" v={`${String(meta.validation_summary.research_figures)} figures`} />
          ) : null}
          <Row k="gate" v={meta?.gate_status ?? "—"} />
          <Row k="fallback" v={meta?.fallback_rung ?? "—"} />
          {meta?.gate_errors?.length ? (
            <div style={{ color: "#E8A87C" }}>{meta?.gate_errors?.join("; ")}</div>
          ) : null}
          {meta?.zod_error ? (
            <div className="pt-1" style={{ color: "#E8A87C", whiteSpace: "pre-wrap" }}>
              Zod: {meta?.zod_error.slice(0, 200)}
            </div>
          ) : null}
          {d.reasoning ? (
            <div className="pt-1 italic" style={{ color: "#94908A" }}>
              {d.reasoning.slice(0, 120)}
            </div>
          ) : null}
          {meta?.stage_ms && Object.keys(meta.stage_ms).length > 0 ? (
            <div className="space-y-0.5 border-t pt-2" style={{ borderColor: "#5A5249" }}>
              <div style={{ color: "#94908A" }}>stage_ms</div>
              {Object.entries(meta.stage_ms).map(([k, v]) => (
                <Row key={k} k={k} v={`${(v / 1000).toFixed(1)}s`} />
              ))}
            </div>
          ) : null}
          {meta?.visual_intent || meta?.charts_attached !== undefined ? (
            <div className="space-y-0.5 border-t pt-2" style={{ borderColor: "#5A5249" }}>
              <div style={{ color: "#94908A" }}>visuals</div>
              <Row k="intent" v={meta?.visual_intent ?? "—"} />
              <Row k="lead_lane" v={meta?.lead_lane ?? "—"} />
              {meta?.trust_conflicts?.length ? (
                <Row k="conflicts" v={meta.trust_conflicts.join("; ")} />
              ) : null}
              <Row k="strength" v={meta?.visual_strength ?? "—"} />
              <Row
                k="attached"
                v={`${meta?.charts_attached ?? 0}${meta?.chart_kinds?.length ? ` (${meta.chart_kinds.join(", ")})` : ""}`}
              />
              {meta?.visual_suppressed ? (
                <Row
                  k="suppressed"
                  v={meta?.visual_suppression_reason ?? meta?.visual_suppression?.join("; ") ?? "yes"}
                />
              ) : null}
              {meta?.visual_rejected?.slice(0, 3).map((r, i) => (
                <div key={i} style={{ color: "#94908A" }}>
                  ↳ {r.kind}: {r.reason.slice(0, 60)}
                </div>
              ))}
            </div>
          ) : null}
          {uxPrefs && onUxPrefsChange ? (
            <div className="space-y-1 border-t pt-2" style={{ borderColor: "#5A5249" }}>
              <div style={{ color: "#94908A" }}>UX streaming</div>
              <ToggleRow
                label="Interim chat (gather)"
                checked={uxPrefs.streamInterimChat}
                onChange={(v) => onUxPrefsChange({ streamInterimChat: v })}
              />
              <ToggleRow
                label="Chat token stream"
                checked={uxPrefs.streamChatTokens}
                hint="costly"
                onChange={(v) => onUxPrefsChange({ streamChatTokens: v })}
              />
              <ToggleRow
                label="Compose partials"
                checked={uxPrefs.streamCompose}
                hint="costly"
                onChange={(v) => onUxPrefsChange({ streamCompose: v })}
              />
              <ToggleRow
                label="Fold CoT steps"
                checked={uxPrefs.collapsibleCot}
                onChange={(v) => onUxPrefsChange({ collapsibleCot: v })}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  hint,
  onChange,
}: {
  label: string;
  checked: boolean;
  hint?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ accentColor: T.corpus }}
      />
      <span>
        {label}
        {hint ? <span style={{ color: "#94908A" }}> · {hint}</span> : null}
      </span>
    </label>
  );
}

function Row({ k, v }: { k: string; v?: string }) {
  return (
    <div className="flex gap-2">
      <span style={{ color: "#94908A", minWidth: 88 }}>{k}</span>
      <span>{v ?? "—"}</span>
    </div>
  );
}
