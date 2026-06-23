"use client";

import { useCallback, useEffect, useState } from "react";

import type { AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

type HealthPayload = {
  ok?: boolean;
  agents?: { ok?: boolean; url?: string };
  corpus?: {
    ok?: boolean;
    transport?: string;
    note?: string | null;
    postgres_configured?: boolean;
    supabase_rest?: boolean;
  };
  web_lane?: boolean;
  anthropic_configured?: boolean;
  error?: string;
};

type StatusLevel = "ok" | "warn" | "err" | "unknown";

function level(ok: boolean | undefined): StatusLevel {
  if (ok === true) return "ok";
  if (ok === false) return "warn";
  return "unknown";
}

const DOT: Record<StatusLevel, string> = {
  ok: "#8FA98C",
  warn: "#D4A574",
  err: "#C96A5A",
  unknown: "#94908A",
};

export function ConnectionStatus({
  devMeta,
  className,
}: {
  devMeta?: AtlasDevMeta | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/atlas/health", { cache: "no-store" });
      setHealth((await res.json()) as HealthPayload);
    } catch {
      setHealth({ ok: false, error: "Health check failed" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  const agentOk = health?.agents?.ok;
  const corpusOk = health?.corpus?.ok;
  const sessionCorpus = devMeta?.corpus_status;
  const onlineOnly =
    devMeta?.lane_mode === "online_only" ||
    devMeta?.lane_mode === "online_only_pending" ||
    devMeta?.online_only?.active ||
    devMeta?.online_only?.pending;

  const worst: StatusLevel =
    agentOk === false
      ? "err"
      : onlineOnly || sessionCorpus === "unavailable" || corpusOk === false
        ? "warn"
        : agentOk && corpusOk
          ? "ok"
          : "unknown";

  const summary =
    worst === "ok"
      ? "Connected"
      : worst === "err"
        ? "Agent offline"
        : onlineOnly || sessionCorpus === "unavailable"
          ? "Online-only"
          : "Corpus limited";

  return (
    <div
      data-testid="atlas-connection-status"
      className={className}
      style={{ fontFamily: atlasFont.mono, fontSize: 10 }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex cursor-pointer items-center gap-2 rounded-full border px-2.5 py-1"
        style={{
          borderColor: T.rule,
          background: open ? T.page : "transparent",
          color: T.inkFaint,
        }}
        aria-expanded={open}
        aria-label="Connection status"
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full"
          style={{ background: DOT[worst] }}
        />
        <span>{loading ? "Checking…" : summary}</span>
        <span style={{ color: T.inkFaint }}>{open ? "▾" : "▸"}</span>
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-[280px] rounded-lg border px-3 py-2.5 shadow-lg"
          style={{
            borderColor: T.rule,
            background: T.canvas,
            color: T.ink,
          }}
        >
          <StatusRow label="Agent" ok={agentOk} detail={health?.agents?.url} />
          <StatusRow
            label="Corpus"
            ok={corpusOk}
            detail={
              sessionCorpus === "unavailable"
                ? "Session: unavailable (online-only offered)"
                : health?.corpus?.note ?? health?.corpus?.transport
            }
          />
          <StatusRow
            label="Supabase REST"
            ok={health?.corpus?.supabase_rest}
            detail={health?.corpus?.postgres_configured ? "Postgres URL set" : "No Postgres URL"}
          />
          <StatusRow label="Web lane" ok={health?.web_lane} />
          <StatusRow label="Anthropic" ok={health?.anthropic_configured} />
          {devMeta?.route ? (
            <StatusRow label="Last route" detail={`${devMeta.route} (${devMeta.route_source})`} />
          ) : null}
          {health?.error ? (
            <p className="mt-2" style={{ color: "#9A3412" }}>
              {health.error}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-2 cursor-pointer border-none bg-transparent underline"
            style={{ color: T.corpus, fontSize: 10 }}
          >
            Refresh
          </button>
        </div>
      ) : null}
    </div>
  );
}

function StatusRow({
  label,
  ok,
  detail,
}: {
  label: string;
  ok?: boolean;
  detail?: string | null;
}) {
  return (
    <div className="flex gap-2 py-0.5">
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full mt-1"
        style={{ background: DOT[level(ok)] }}
      />
      <div className="min-w-0">
        <span style={{ color: T.inkFaint }}>{label}</span>
        {detail ? (
          <div className="truncate text-[9px]" style={{ color: T.inkFaint }}>
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}
