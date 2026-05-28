"use client";

/**
 * AgentStatusDot — connection indicator + debug dropdown for the Atlas agent service.
 *
 * Polls /api/agent-status every 30 s. Shows:
 *   • green pulsing dot  — connected, latency < 2 s
 *   • amber dot          — connected but slow (≥ 2 s) or first-load pending
 *   • red dot            — unreachable / error
 *
 * Click the dot to open a small dropdown with:
 *   - Connection state + latency
 *   - Agent host (sanitised — hostname only)
 *   - Last error message
 *   - Last checked timestamp
 *   - "Re-check" button
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

interface StatusPayload {
  connected: boolean;
  latency_ms: number;
  model: string;
  agent_host?: string;
  error?: string;
}

type DotState = "checking" | "ok" | "slow" | "error";

function useDotState() {
  const [dot, setDot] = useState<DotState>("checking");
  const [payload, setPayload] = useState<StatusPayload | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const probe = useCallback(async (manual = false) => {
    if (manual) setIsRefreshing(true);
    try {
      const res = await fetch("/api/agent-status", { cache: "no-store" });
      const data: StatusPayload = await res.json();
      setPayload(data);
      setLastChecked(new Date());
      if (!data.connected) setDot("error");
      else if (data.latency_ms >= 2000) setDot("slow");
      else setDot("ok");
    } catch {
      setDot("error");
      setLastChecked(new Date());
    } finally {
      if (manual) setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    probe();
    const id = setInterval(() => probe(), 30_000);
    return () => clearInterval(id);
  }, [probe]);

  return { dot, payload, lastChecked, isRefreshing, recheck: () => probe(true) };
}

const DOT_CLASSES: Record<DotState, string> = {
  checking: "bg-muted-foreground/40",
  ok:       "bg-emerald-500 animate-pulse",
  slow:     "bg-amber-400",
  error:    "bg-red-500",
};

const STATE_LABEL: Record<DotState, string> = {
  checking: "Connecting…",
  ok:       "Connected",
  slow:     "Slow",
  error:    "Unreachable",
};

const STATE_COLOR: Record<DotState, string> = {
  checking: "text-muted-foreground",
  ok:       "text-emerald-600 dark:text-emerald-400",
  slow:     "text-amber-600 dark:text-amber-400",
  error:    "text-red-600 dark:text-red-400",
};

function formatTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function AgentStatusDot() {
  const { dot, payload, lastChecked, isRefreshing, recheck } = useDotState();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const latencyText =
    payload && payload.latency_ms > 0 && payload.latency_ms < 9999
      ? `${payload.latency_ms} ms`
      : null;

  return (
    <div ref={ref} className="relative flex items-center">
      {/* Trigger button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Agent service: ${STATE_LABEL[dot]} — click for details`}
        className="flex items-center gap-1.5 cursor-pointer select-none rounded px-1 py-0.5 hover:bg-muted/60 transition-colors"
      >
        <span
          className={cn(
            "inline-block h-2 w-2 rounded-full flex-shrink-0 transition-colors duration-500",
            DOT_CLASSES[dot],
          )}
        />
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {payload?.model ?? "claude-sonnet-4-6"}
        </span>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div
          className={cn(
            "absolute right-0 top-full mt-1 z-50",
            "w-72 rounded-lg border border-border bg-popover shadow-lg",
            "p-3 text-xs",
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-foreground">Agent Connection</span>
            <button
              onClick={() => setOpen(false)}
              className="text-muted-foreground hover:text-foreground leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Status row */}
          <div className="flex items-center gap-2 mb-2 p-2 rounded-md bg-muted/50">
            <span
              className={cn(
                "inline-block h-2.5 w-2.5 rounded-full flex-shrink-0",
                DOT_CLASSES[dot],
              )}
            />
            <span className={cn("font-medium", STATE_COLOR[dot])}>
              {STATE_LABEL[dot]}
            </span>
            {latencyText && (
              <span className="ml-auto text-muted-foreground">{latencyText}</span>
            )}
          </div>

          {/* Detail rows */}
          <div className="space-y-1.5 text-muted-foreground">
            <Row label="Model" value={payload?.model ?? "claude-sonnet-4-6"} />
            <Row
              label="Endpoint"
              value={payload?.agent_host ?? "(checking…)"}
              mono
            />
            {payload?.error && (
              <Row
                label="Error"
                value={payload.error}
                className="text-red-500 dark:text-red-400"
              />
            )}
            <Row
              label="Last checked"
              value={lastChecked ? formatTime(lastChecked) : "—"}
            />
          </div>

          {/* Re-check button */}
          <button
            onClick={recheck}
            disabled={isRefreshing}
            className={cn(
              "mt-3 w-full rounded-md border border-border px-2 py-1",
              "text-xs font-medium text-foreground",
              "hover:bg-muted/60 transition-colors",
              "disabled:opacity-50 disabled:cursor-not-allowed",
            )}
          >
            {isRefreshing ? "Checking…" : "Re-check now"}
          </button>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  mono = false,
  className,
}: {
  label: string;
  value: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className="flex items-start gap-1">
      <span className="w-24 flex-shrink-0 text-muted-foreground/70">{label}</span>
      <span className={cn("flex-1 break-all", mono && "font-mono text-[10px]", className)}>
        {value}
      </span>
    </div>
  );
}
