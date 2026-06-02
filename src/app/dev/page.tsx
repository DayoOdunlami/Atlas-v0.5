"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ServiceId = "nextjs" | "agents" | "langgraph";
type StatusStr = "stopped" | "starting" | "running" | "error" | "unknown";

interface ServiceStatus {
  status: StatusStr;
  port: number;
  portOpen: boolean;
}

interface StatusPayload {
  nextjs: ServiceStatus;
  agents: ServiceStatus;
  langgraph: ServiceStatus;
}

interface LogEntry {
  text: string;
  ts: number;
  stream: "stdout" | "stderr";
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVICE_META: Record<ServiceId, { label: string; desc: string; managed: boolean }> = {
  nextjs:    { label: "Next.js",    desc: "localhost:3005",  managed: false },
  agents:    { label: "Agents",     desc: "localhost:8000",  managed: true  },
  langgraph: { label: "LangGraph",  desc: "localhost:2024",  managed: true  },
};

const STATUS_COLOR: Record<StatusStr, string> = {
  running:  "bg-emerald-400",
  starting: "bg-amber-400 animate-pulse",
  error:    "bg-red-500",
  stopped:  "bg-zinc-500",
  unknown:  "bg-zinc-600",
};

const STATUS_LABEL: Record<StatusStr, string> = {
  running:  "Running",
  starting: "Starting…",
  error:    "Error",
  stopped:  "Stopped",
  unknown:  "Unknown",
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function useStatus(pollMs = 2000) {
  const [data, setData] = useState<StatusPayload | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const r = await fetch("/api/dev/status");
      if (r.ok) setData(await r.json());
    } catch {}
  }, []);

  useEffect(() => {
    fetch_();
    const id = setInterval(fetch_, pollMs);
    return () => clearInterval(id);
  }, [fetch_, pollMs]);

  return { data, refresh: fetch_ };
}

function useServiceLogs(service: "agents" | "langgraph") {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const es = new EventSource(`/api/dev/logs/${service}`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const entry: LogEntry = JSON.parse(e.data);
        setLogs((prev) => {
          const next = [...prev, entry];
          return next.length > 500 ? next.slice(-500) : next;
        });
      } catch {}
    };

    return () => es.close();
  }, [service]);

  const clear = () => setLogs([]);
  return { logs, clear };
}

// ---------------------------------------------------------------------------
// Control helpers
// ---------------------------------------------------------------------------

async function control(body: Record<string, unknown>) {
  await fetch("/api/dev/control", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusDot({ status }: { status: StatusStr }) {
  return <span className={cn("inline-block size-2 rounded-full shrink-0", STATUS_COLOR[status])} />;
}

function TerminalPanel({
  service,
  status,
  onStart,
  onStop,
  onRestart,
  onKillPort,
}: {
  service: "agents" | "langgraph";
  status: ServiceStatus | undefined;
  onStart: () => void;
  onStop: () => void;
  onRestart: () => void;
  onKillPort: () => void;
}) {
  const { logs, clear } = useServiceLogs(service);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs, autoScroll]);

  const meta = SERVICE_META[service];
  const st = status?.status ?? "unknown";

  return (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-zinc-950">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <StatusDot status={st} />
          <span className="font-mono text-sm font-semibold text-zinc-100">{meta.label}</span>
          <span className="text-xs text-zinc-500 font-mono">{meta.desc}</span>
          <span className="text-xs text-zinc-400 ml-1">{STATUS_LABEL[st]}</span>
          {status?.portOpen && st !== "running" && (
            <span className="text-xs text-amber-400 ml-1">port open (external process)</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Btn onClick={onStart} disabled={st === "running" || st === "starting"} variant="green">
            Start
          </Btn>
          <Btn onClick={onRestart} disabled={st === "stopped" && !status?.portOpen} variant="amber">
            Restart
          </Btn>
          <Btn onClick={onStop} disabled={st === "stopped"} variant="red">
            Stop
          </Btn>
          <Btn onClick={onKillPort} variant="ghost" title={`Kill anything on port ${status?.port}`}>
            Kill :{status?.port}
          </Btn>
          <Btn onClick={clear} variant="ghost">
            Clear
          </Btn>
          <label className="flex items-center gap-1 text-xs text-zinc-500 cursor-pointer ml-1">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="accent-emerald-500"
            />
            Auto-scroll
          </label>
        </div>
      </div>

      {/* Log output */}
      <div className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed px-3 py-2">
        {logs.length === 0 ? (
          <span className="text-zinc-600 italic">No output yet.</span>
        ) : (
          logs.map((entry, i) => (
            <div
              key={i}
              className={cn(
                "whitespace-pre-wrap break-all",
                entry.stream === "stderr" ? "text-red-400" : "text-zinc-300",
                entry.text.startsWith("[status]") && "text-amber-400 font-semibold",
              )}
            >
              <span className="text-zinc-600 mr-2 select-none">
                {new Date(entry.ts).toLocaleTimeString([], { hour12: false })}
              </span>
              {entry.text}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function NextjsPanel({ status }: { status: ServiceStatus | undefined }) {
  const st = status?.status ?? "unknown";
  const meta = SERVICE_META.nextjs;

  return (
    <div className="flex flex-col h-full border border-border rounded-lg overflow-hidden bg-zinc-950">
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <StatusDot status={st} />
          <span className="font-mono text-sm font-semibold text-zinc-100">{meta.label}</span>
          <span className="text-xs text-zinc-500 font-mono">{meta.desc}</span>
          <span className="text-xs text-zinc-400 ml-1">{STATUS_LABEL[st]}</span>
        </div>
        <div className="flex items-center gap-1">
          <Btn
            variant="ghost"
            onClick={() => control({ action: "kill_port", service: "nextjs" })}
            title="Kill process on port 3005 (use with caution — this page will stop)"
          >
            Kill :3005
          </Btn>
        </div>
      </div>
      <div className="flex-1 flex items-center justify-center text-zinc-600 italic text-sm font-mono">
        Next.js is the host process — logs appear in the terminal where you ran{" "}
        <code className="mx-1 text-zinc-400">pnpm dev</code>.
      </div>
    </div>
  );
}

function Btn({
  children,
  onClick,
  disabled,
  variant = "ghost",
  title,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "green" | "amber" | "red" | "ghost";
  title?: string;
}) {
  const base =
    "px-2 py-0.5 rounded text-xs font-mono transition-colors disabled:opacity-40 disabled:pointer-events-none";
  const variants: Record<string, string> = {
    green: "bg-emerald-900/60 text-emerald-300 hover:bg-emerald-800/60",
    amber: "bg-amber-900/60 text-amber-300 hover:bg-amber-800/60",
    red:   "bg-red-900/60 text-red-300 hover:bg-red-800/60",
    ghost: "bg-zinc-800 text-zinc-400 hover:bg-zinc-700",
  };
  return (
    <button className={cn(base, variants[variant])} onClick={onClick} disabled={disabled} title={title}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DevPage() {
  const { data, refresh } = useStatus(2000);

  const agentsStatus    = data?.agents;
  const langgraphStatus = data?.langgraph;
  const nextjsStatus    = data?.nextjs;

  const allRunning =
    agentsStatus?.status === "running" && langgraphStatus?.status === "running";

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Top bar */}
      <header className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-border shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono font-bold text-zinc-100 text-sm">Dev Control Panel</span>
          <span className="text-xs text-zinc-500">Atlas 5</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Service summary pills */}
          {(["nextjs", "agents", "langgraph"] as ServiceId[]).map((svc) => {
            const s = data?.[svc];
            const st: StatusStr = s?.status ?? "unknown";
            return (
              <span
                key={svc}
                className={cn(
                  "flex items-center gap-1.5 text-xs font-mono px-2 py-0.5 rounded-full border",
                  st === "running"
                    ? "border-emerald-800 text-emerald-300"
                    : st === "starting"
                    ? "border-amber-800 text-amber-300"
                    : st === "error"
                    ? "border-red-800 text-red-300"
                    : "border-zinc-700 text-zinc-500",
                )}
              >
                <StatusDot status={st} />
                {SERVICE_META[svc].label}
              </span>
            );
          })}

          <div className="w-px h-4 bg-zinc-700 mx-1" />

          <Btn
            variant="green"
            disabled={allRunning}
            onClick={() => { control({ action: "start_all" }); setTimeout(refresh, 500); }}
          >
            Start All
          </Btn>
          <Btn
            variant="red"
            onClick={() => { control({ action: "stop_all" }); setTimeout(refresh, 500); }}
          >
            Stop All
          </Btn>
          <Btn variant="ghost" onClick={refresh}>
            Refresh
          </Btn>
        </div>
      </header>

      {/* Three panels */}
      <div className="flex-1 grid grid-cols-3 gap-2 p-2 min-h-0">
        <NextjsPanel status={nextjsStatus} />

        <TerminalPanel
          service="agents"
          status={agentsStatus}
          onStart={() => { control({ action: "start", service: "agents" }); setTimeout(refresh, 300); }}
          onStop={() => { control({ action: "stop", service: "agents" }); setTimeout(refresh, 300); }}
          onRestart={() => { control({ action: "restart", service: "agents" }); setTimeout(refresh, 300); }}
          onKillPort={() => { control({ action: "kill_port", service: "agents" }); setTimeout(refresh, 300); }}
        />

        <TerminalPanel
          service="langgraph"
          status={langgraphStatus}
          onStart={() => { control({ action: "start", service: "langgraph" }); setTimeout(refresh, 300); }}
          onStop={() => { control({ action: "stop", service: "langgraph" }); setTimeout(refresh, 300); }}
          onRestart={() => { control({ action: "restart", service: "langgraph" }); setTimeout(refresh, 300); }}
          onKillPort={() => { control({ action: "kill_port", service: "langgraph" }); setTimeout(refresh, 300); }}
        />
      </div>

      {/* Footer */}
      <footer className="px-4 py-1 bg-zinc-900 border-t border-border shrink-0 flex items-center gap-4 text-xs text-zinc-600 font-mono">
        <span>Polling every 2s</span>
        <span>·</span>
        <span>
          Kill :PORT terminates any process on that port (including Claude Code / Cursor)
        </span>
        <span>·</span>
        <span>
          <a href="/" className="text-zinc-500 hover:text-zinc-300 underline underline-offset-2">
            ← Back to app
          </a>
        </span>
      </footer>
    </div>
  );
}
