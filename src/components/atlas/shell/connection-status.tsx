"use client";

import { useCallback, useEffect, useState } from "react";

import type { AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";
import { cn } from "@/lib/utils";

type TierProbe = {
  configured?: boolean;
  status?: "ok" | "fail" | "skip";
  attempts?: number;
  latency_ms?: number;
  error?: string | null;
};

type HealthPayload = {
  ok?: boolean;
  agents?: { ok?: boolean; url?: string };
  corpus?: {
    ok?: boolean;
    transport?: string;
    note?: string | null;
    postgres_configured?: boolean;
    supabase_rest_configured?: boolean;
    supabase_rest?: boolean;
    postgres?: TierProbe;
    rest?: TierProbe;
  };
  web_lane?: boolean;
  exa?: {
    api_key_set?: boolean;
    py_installed?: boolean;
    ready?: boolean;
  };
  anthropic_configured?: boolean;
  error?: string;
};

type StatusLevel = "ok" | "warn" | "err" | "unknown";

function level(ok: boolean | undefined): StatusLevel {
  if (ok === true) return "ok";
  if (ok === false) return "warn";
  return "unknown";
}

function tierLevel(tier: TierProbe | undefined, configured?: boolean): StatusLevel {
  if (!tier && configured === false) return "unknown";
  if (tier?.status === "ok") return "ok";
  if (tier?.status === "fail") return "warn";
  if (tier?.status === "skip" || configured === false) return "unknown";
  return "unknown";
}

function tierDetail(tier: TierProbe | undefined, label: string): string | undefined {
  if (!tier) return undefined;
  if (tier.status === "skip" || tier.configured === false) {
    return `${label} not configured`;
  }
  const parts: string[] = [];
  if (tier.latency_ms != null) parts.push(`${tier.latency_ms}ms`);
  if (tier.attempts != null && tier.attempts > 0) {
    parts.push(`${tier.attempts} attempt${tier.attempts === 1 ? "" : "s"}`);
  }
  if (tier.status === "fail" && tier.error) parts.push(tier.error);
  return parts.length ? parts.join(" · ") : tier.status;
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
  compact = false,
}: {
  devMeta?: AtlasDevMeta | null;
  className?: string;
  /** Icon-only status dot for narrow rails. */
  compact?: boolean;
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
  const insufficient = sessionCorpus === "insufficient_evidence";

  const pgTier = health?.corpus?.postgres;
  const restTier = health?.corpus?.rest;

  const worst: StatusLevel =
    agentOk === false
      ? "err"
      : onlineOnly || sessionCorpus === "unavailable" || insufficient
        ? "warn"
        : corpusOk === false
          ? "warn"
          : agentOk && corpusOk
            ? "ok"
            : "unknown";

  const summary =
    worst === "ok"
      ? "Connected"
      : worst === "err"
        ? "Agent offline"
        : insufficient
          ? "No corpus matches"
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
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-full border",
          compact ? "size-8 justify-center p-0" : "px-2.5 py-1",
        )}
        style={{
          borderColor: T.rule,
          background: open ? T.page : "transparent",
          color: T.inkFaint,
        }}
        aria-expanded={open}
        aria-label="Connection status"
        title={loading ? "Checking connection" : summary}
      >
        <span
          className="inline-block h-1.5 w-1.5 rounded-full shrink-0"
          style={{ background: DOT[worst] }}
        />
        {!compact ? (
          <>
            <span>{loading ? "Checking…" : summary}</span>
            <span style={{ color: T.inkFaint }}>{open ? "▾" : "▸"}</span>
          </>
        ) : null}
      </button>

      {open ? (
        <div
          className="absolute right-0 top-full z-50 mt-2 min-w-[300px] rounded-lg border px-3 py-2.5 shadow-lg"
          style={{
            borderColor: T.rule,
            background: T.canvas,
            color: T.ink,
          }}
        >
          <StatusRow label="Agent" ok={agentOk} detail={health?.agents?.url} />
          <StatusRow
            label="Corpus (active)"
            ok={corpusOk}
            detail={
              sessionCorpus === "insufficient_evidence"
                ? "Session: no verified project matches — canvas withheld"
                : sessionCorpus === "unavailable"
                  ? "Session: unavailable (online-only offered)"
                  : health?.corpus?.note ?? health?.corpus?.transport
            }
          />
          <StatusRow
            label="Postgres pooler"
            level={tierLevel(pgTier, health?.corpus?.postgres_configured)}
            detail={tierDetail(pgTier, "Postgres")}
          />
          <StatusRow
            label="Supabase REST"
            level={tierLevel(
              restTier,
              health?.corpus?.supabase_rest_configured ?? health?.corpus?.supabase_rest,
            )}
            detail={tierDetail(restTier, "REST")}
          />
          <StatusRow label="Web lane" ok={health?.web_lane} />
          <StatusRow
            label="Exa search"
            ok={health?.exa?.ready}
            detail={
              health?.exa?.ready
                ? "exa_py + API key"
                : !health?.exa?.py_installed
                  ? "exa_py not installed — pip install exa-py in agents venv"
                  : !health?.exa?.api_key_set
                    ? "EXA_API_KEY not set"
                    : "Unavailable"
            }
          />
          <StatusRow label="Anthropic" ok={health?.anthropic_configured} />
          {devMeta?.external_skipped && devMeta?.lane_mode !== "corpus_only" ? (
            <StatusRow
              label="This turn"
              ok={false}
              detail="External search skipped — corpus-only lane"
            />
          ) : null}
          {devMeta?.route ? (
            <StatusRow label="Last route" detail={`${devMeta.route} (${devMeta.route_source})`} />
          ) : null}
          {health?.agents?.ok === false ? (
            <p className="mt-2 font-medium" style={{ color: "#9A3412" }}>
              Agent offline — set PYTHON_AGENTS_URL on Vercel to your Railway service. Chat
              will not reply until the agent is reachable.
              {health?.agents?.url ? ` (${health.agents.url})` : ""}
            </p>
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
  level: levelProp,
  detail,
}: {
  label: string;
  ok?: boolean;
  level?: StatusLevel;
  detail?: string | null;
}) {
  const dot = levelProp ?? level(ok);
  return (
    <div className="flex gap-2 py-0.5">
      <span
        className="inline-block h-1.5 w-1.5 shrink-0 rounded-full mt-1"
        style={{ background: DOT[dot] }}
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
