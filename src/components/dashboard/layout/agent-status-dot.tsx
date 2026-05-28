"use client";

/**
 * AgentStatusDot — subtle connection indicator for the Atlas agent service.
 *
 * Polls /api/agent-status every 30 s. Shows:
 *   • green pulsing dot  — connected, latency < 2 s
 *   • amber dot          — connected but slow (≥ 2 s) or first-load pending
 *   • red dot            — unreachable / error
 *
 * On hover: tooltip with model name, latency, and status text.
 */
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface StatusPayload {
  connected: boolean;
  latency_ms: number;
  model: string;
  error?: string;
}

type DotState = "checking" | "ok" | "slow" | "error";

function useDotState(): { dot: DotState; payload: StatusPayload | null } {
  const [dot, setDot] = useState<DotState>("checking");
  const [payload, setPayload] = useState<StatusPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      try {
        const res = await fetch("/api/agent-status", { cache: "no-store" });
        if (cancelled) return;
        const data: StatusPayload = await res.json();
        setPayload(data);
        if (!data.connected) setDot("error");
        else if (data.latency_ms >= 2000) setDot("slow");
        else setDot("ok");
      } catch {
        if (!cancelled) setDot("error");
      }
    }

    probe();
    const id = setInterval(probe, 30_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  return { dot, payload };
}

const DOT_CLASSES: Record<DotState, string> = {
  checking: "bg-muted-foreground/40",
  ok:       "bg-emerald-500 animate-pulse",
  slow:     "bg-amber-400",
  error:    "bg-red-500",
};

const LABEL: Record<DotState, string> = {
  checking: "Connecting…",
  ok:       "Connected",
  slow:     "Slow",
  error:    "Unreachable",
};

export function AgentStatusDot() {
  const { dot, payload } = useDotState();

  const latencyText =
    payload && payload.latency_ms < 9999
      ? `${payload.latency_ms} ms`
      : null;

  const tooltipLines = [
    payload?.model ?? "claude-sonnet-4-6",
    latencyText,
    payload?.error ?? LABEL[dot],
  ].filter(Boolean).join(" · ");

  return (
    <span
      title={tooltipLines}
      aria-label={`Agent service: ${LABEL[dot]}`}
      className="flex items-center gap-1.5 cursor-default select-none"
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
    </span>
  );
}
