"use client";

import { useState } from "react";

import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

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
}: {
  meta: AtlasDevMeta | null;
  dataSource?: string;
}) {
  const [open, setOpen] = useState(true);
  const show =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ATLAS_DEV_OVERLAY === "1";

  if (!show || !meta) {
    return null;
  }

  const d = meta.disposition ?? {};

  return (
    <div
      data-testid="atlas-dev-overlay"
      className="fixed bottom-4 left-4 z-50 max-w-sm rounded-lg border shadow-lg"
      style={{
        borderColor: T.rule,
        background: "#1A1714",
        color: "#FBFAF7",
        fontFamily: atlasFont.mono,
        fontSize: 10,
      }}
    >
      <button
        type="button"
        className="w-full px-3 py-2 text-left uppercase tracking-wider"
        style={{ color: "#94908A" }}
        onClick={() => setOpen((v) => !v)}
      >
        Atlas dev {open ? "▾" : "▸"}
      </button>
      {open ? (
        <div className="space-y-1 border-t px-3 py-2" style={{ borderColor: "#5A5249" }}>
          <Row k="dataSource" v={dataSource} />
          <Row k="stage" v={meta.turn_stage ?? "—"} />
          <Row k="partial" v={meta.partial_stage ?? "—"} />
          <Row k="surface" v={d.primary_surface} />
          <Row k="canvas_action" v={d.canvas_action} />
          <Row k="composition" v={d.composition_mode} />
          <Row k="route" v={`${meta.route ?? "—"} (${meta.route_source ?? "—"})`} />
          <Row k="lane" v={`${meta.lane_mode ?? "—"} skip=${String(meta.external_skipped)} peer=${meta.lane_mode === "dual" ? "yes" : "no"}`} />
          <Row k="keys" v={`${meta.keyed_keys?.length ?? 0} available`} />
          {meta.web_keys_absent_reason ? (
            <Row k="web.*" v="absent (corpus-only)" />
          ) : null}
          <Row k="gate" v={meta.gate_status ?? "—"} />
          <Row k="fallback" v={meta.fallback_rung ?? "—"} />
          {meta.gate_errors?.length ? (
            <div style={{ color: "#E8A87C" }}>{meta.gate_errors.join("; ")}</div>
          ) : null}
          {meta.zod_error ? (
            <div className="pt-1" style={{ color: "#E8A87C", whiteSpace: "pre-wrap" }}>
              Zod: {meta.zod_error.slice(0, 200)}
            </div>
          ) : null}
          {d.reasoning ? (
            <div className="pt-1 italic" style={{ color: "#94908A" }}>
              {d.reasoning.slice(0, 120)}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
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
