"use client";

/**
 * CorpusHealthPanel — production-grade ingest monitoring panel.
 *
 * Displays:
 *   • Pipeline status — running / idle, last run summary, trigger button
 *   • Corpus totals  — records, relevant %, irrelevant (tombstoned), untagged
 *   • Source breakdown — per-source bar with tag distribution
 *   • Run history    — last 20 ingest runs with status + row delta
 *
 * Polls /api/ingest-status every 15 s while the panel is open.
 * Triggers runs via POST /api/ingest-status → Railway ingest service.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types (mirror server response shape)
// ---------------------------------------------------------------------------
interface SourceStat {
  source: string;
  total: number;
  relevant: number;
  borderline: number;
  irrelevant: number;
  untagged: number;
  last_ingested: string | null;
}

interface IngestRun {
  source: string;
  started_at: string;
  finished_at: string | null;
  rows_inserted: number | null;
  rows_updated: number | null;
  rows_skipped: number | null;
  status: string;
}

interface StatusPayload {
  pipeline: {
    running: boolean;
    service_ok: boolean;
    ingest_url: string | null;
    last_run: {
      source: string;
      started: string;
      finished: string;
      exit_code: number;
      triggered_by?: string;
    } | null;
  };
  corpus: {
    total: number;
    relevant: number;
    irrelevant: number;
    untagged: number;
    by_source: SourceStat[];
  };
  recent_runs: IngestRun[];
  fetched_at: string;
}

// ---------------------------------------------------------------------------
// Source display names & colours
// ---------------------------------------------------------------------------
const SOURCE_META: Record<string, { label: string; color: string }> = {
  iuk: { label: "Innovate UK", color: "#6366f1" },
  horizon: { label: "Horizon EU", color: "#0ea5e9" },
  fts: { label: "Find a Tender", color: "#f59e0b" },
  govuk: { label: "GOV.UK", color: "#10b981" },
  trig: { label: "TRIG", color: "#8b5cf6" },
  marri_uk: { label: "MarRI-UK", color: "#ec4899" },
  gtr: { label: "UKRI GtR", color: "#14b8a6" },
  unknown: { label: "Other", color: "#6b7280" },
};

function sourceMeta(s: string) {
  return SOURCE_META[s] ?? { label: s, color: "#6b7280" };
}

// ---------------------------------------------------------------------------
// Tiny helpers
// ---------------------------------------------------------------------------
function fmtTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function fmtDuration(start: string, end: string | null): string {
  if (!end) return "running…";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1_000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function pct(n: number, total: number) {
  if (!total) return 0;
  return Math.round((n / total) * 100);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3 flex flex-col gap-0.5">
      <span className="text-[11px] font-medium text-white/40 uppercase tracking-wide">
        {label}
      </span>
      <span
        className={cn("text-2xl font-semibold tabular-nums", accent ?? "text-white")}
      >
        {value}
      </span>
      {sub && <span className="text-[11px] text-white/35">{sub}</span>}
    </div>
  );
}

function SourceRow({ stat }: { stat: SourceStat }) {
  const meta = sourceMeta(stat.source);
  const actionable = stat.relevant + stat.borderline;
  const actionPct = pct(actionable, stat.total);
  const deadPct = pct(stat.irrelevant, stat.total);

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0">
      {/* Colour pip + name */}
      <div className="flex items-center gap-2 w-32 shrink-0">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: meta.color }}
        />
        <span className="text-[12px] font-medium text-white/80 truncate">
          {meta.label}
        </span>
      </div>

      {/* Stacked bar */}
      <div className="flex-1 h-2 rounded-full bg-white/8 overflow-hidden flex">
        <div
          className="h-full rounded-l-full"
          style={{
            width: `${actionPct}%`,
            backgroundColor: meta.color,
            opacity: 0.85,
          }}
        />
        <div
          className="h-full"
          style={{ width: `${deadPct}%`, backgroundColor: "#ef4444", opacity: 0.45 }}
        />
      </div>

      {/* Counts */}
      <div className="flex items-center gap-3 text-[11px] tabular-nums shrink-0">
        <span className="text-white/60 w-16 text-right">
          {stat.total.toLocaleString()} total
        </span>
        <span className="text-emerald-400/80 w-16 text-right">
          {actionable.toLocaleString()} live
        </span>
        <span className="text-white/30 w-10 text-right">
          {fmtTime(stat.last_ingested)}
        </span>
      </div>
    </div>
  );
}

function RunRow({ run }: { run: IngestRun }) {
  const meta = sourceMeta(run.source);
  const ok = run.status === "completed" || run.exit_code === 0;
  const inserted = run.rows_inserted ?? 0;
  const updated = run.rows_updated ?? 0;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-white/5 last:border-0">
      {/* Status dot */}
      <span
        className={cn(
          "w-1.5 h-1.5 rounded-full shrink-0",
          run.finished_at === null
            ? "bg-amber-400 animate-pulse"
            : ok
            ? "bg-emerald-400"
            : "bg-red-400"
        )}
      />
      {/* Source */}
      <span
        className="w-20 shrink-0 text-[11px] font-medium truncate"
        style={{ color: meta.color }}
      >
        {meta.label}
      </span>
      {/* Time ago */}
      <span className="text-[11px] text-white/35 w-16 shrink-0">
        {fmtTime(run.started_at)}
      </span>
      {/* Duration */}
      <span className="text-[11px] text-white/40 w-14 shrink-0">
        {fmtDuration(run.started_at, run.finished_at)}
      </span>
      {/* Row delta */}
      <span className="flex-1 text-[11px] text-white/50 text-right">
        {inserted > 0 && (
          <span className="text-emerald-400/80">+{inserted.toLocaleString()} new</span>
        )}
        {updated > 0 && (
          <span className="ml-2 text-sky-400/70">~{updated.toLocaleString()} updated</span>
        )}
        {inserted === 0 && updated === 0 && run.finished_at && (
          <span className="text-white/25">no changes</span>
        )}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

const SOURCES = ["all", "iuk", "horizon", "fts", "govuk", "trig", "marri", "gtr"];

export function CorpusHealthPanel({ onClose }: { onClose?: () => void }) {
  const [data, setData] = useState<StatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(false);
  const [trigSource, setTrigSource] = useState("all");
  const [trigMsg, setTrigMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<"overview" | "sources" | "runs">("overview");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const r = await fetch("/api/ingest-status");
      if (r.ok) setData(await r.json());
    } catch {
      /* network error — keep stale data */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    intervalRef.current = setInterval(refresh, 15_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh]);

  // Auto-refresh faster while pipeline is running
  useEffect(() => {
    if (data?.pipeline.running) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(refresh, 4_000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(refresh, 15_000);
    }
  }, [data?.pipeline.running, refresh]);

  const triggerRun = async () => {
    setTriggering(true);
    setTrigMsg(null);
    try {
      const r = await fetch("/api/ingest-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: trigSource }),
      });
      const j = await r.json();
      if (r.status === 202) {
        setTrigMsg(`✓ Run accepted — source: ${trigSource}`);
        setTimeout(refresh, 1500);
      } else if (r.status === 409) {
        setTrigMsg("⚠ Already running — wait for current run to finish");
      } else {
        setTrigMsg(`✗ ${j.error ?? j.detail ?? "Unknown error"}`);
      }
    } catch (e) {
      setTrigMsg(`✗ ${String(e)}`);
    } finally {
      setTriggering(false);
    }
  };

  const corp = data?.corpus;
  const pipeline = data?.pipeline;
  const relevantPct = corp ? pct(corp.relevant, corp.total) : 0;

  return (
    <div className="flex flex-col h-full bg-[#0f1117] text-white font-sans overflow-hidden">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-white/8 shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Pipeline status indicator */}
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              loading
                ? "bg-white/20 animate-pulse"
                : pipeline?.running
                ? "bg-amber-400 animate-pulse"
                : pipeline?.service_ok
                ? "bg-emerald-400"
                : "bg-red-400"
            )}
          />
          <h2 className="text-[13px] font-semibold text-white/90 tracking-tight">
            Corpus Intelligence Pipeline
          </h2>
          {pipeline?.running && (
            <span className="text-[11px] text-amber-400/80 font-medium animate-pulse">
              RUNNING
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-white/25">
            {data ? `Updated ${fmtTime(data.fetched_at)}` : "Loading…"}
          </span>
          {onClose && (
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center rounded-md text-white/30 hover:text-white/70 hover:bg-white/8 transition-colors"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────────────── */}
      <div className="flex gap-1 px-5 pt-3 pb-0 shrink-0">
        {(["overview", "sources", "runs"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
              tab === t
                ? "bg-white/10 text-white"
                : "text-white/35 hover:text-white/60 hover:bg-white/5"
            )}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
        {loading && !data ? (
          <div className="flex items-center justify-center h-32 text-white/25 text-[13px]">
            Fetching pipeline state…
          </div>
        ) : (
          <>
            {/* ── OVERVIEW tab ── */}
            {tab === "overview" && (
              <div className="flex flex-col gap-4">
                {/* Stat cards */}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <StatCard
                    label="Total Records"
                    value={(corp?.total ?? 0).toLocaleString()}
                    sub="in live_calls"
                  />
                  <StatCard
                    label="Actionable"
                    value={`${relevantPct}%`}
                    sub={`${(corp?.relevant ?? 0).toLocaleString()} relevant`}
                    accent="text-emerald-400"
                  />
                  <StatCard
                    label="Tombstoned"
                    value={(corp?.irrelevant ?? 0).toLocaleString()}
                    sub="blocked by MCP filter"
                    accent="text-white/40"
                  />
                  <StatCard
                    label="Untagged"
                    value={(corp?.untagged ?? 0).toLocaleString()}
                    sub={corp?.untagged ? "⚠ needs classify" : "✓ clean"}
                    accent={corp?.untagged ? "text-amber-400" : "text-white"}
                  />
                </div>

                {/* Last run summary */}
                <div className="rounded-xl border border-white/8 bg-white/4 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[12px] font-medium text-white/50 uppercase tracking-wide">
                      Last Pipeline Run
                    </span>
                    {pipeline?.last_run?.triggered_by && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-white/8 text-white/40">
                        {pipeline.last_run.triggered_by}
                      </span>
                    )}
                  </div>
                  {pipeline?.last_run ? (
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-[12px]">
                      <div>
                        <span className="text-white/35">Source </span>
                        <span className="text-white/80 font-medium">
                          {sourceMeta(pipeline.last_run.source).label}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/35">Status </span>
                        <span
                          className={cn(
                            "font-medium",
                            pipeline.last_run.exit_code === 0
                              ? "text-emerald-400"
                              : "text-red-400"
                          )}
                        >
                          {pipeline.last_run.exit_code === 0
                            ? "Completed"
                            : `Failed (exit ${pipeline.last_run.exit_code})`}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/35">Started </span>
                        <span className="text-white/60">
                          {fmtTime(pipeline.last_run.started)}
                        </span>
                      </div>
                      <div>
                        <span className="text-white/35">Duration </span>
                        <span className="text-white/60">
                          {fmtDuration(
                            pipeline.last_run.started,
                            pipeline.last_run.finished
                          )}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[12px] text-white/25">
                      No run recorded yet — trigger one below or wait for Monday
                      07:00 UTC cron.
                    </p>
                  )}
                </div>

                {/* Service info */}
                <div className="rounded-xl border border-white/8 bg-white/4 px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        pipeline?.service_ok ? "bg-emerald-400" : "bg-red-400"
                      )}
                    />
                    <span className="text-[12px] text-white/50">
                      Railway ingest service
                    </span>
                    {pipeline?.ingest_url && (
                      <span className="text-[11px] text-white/25 font-mono">
                        {pipeline.ingest_url}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-white/30">
                    <span>Cron: Mon 07:00 UTC</span>
                    <span className="text-white/15">·</span>
                    <span>GtR: first-Mon monthly</span>
                  </div>
                </div>
              </div>
            )}

            {/* ── SOURCES tab ── */}
            {tab === "sources" && (
              <div className="flex flex-col">
                {corp?.by_source.length ? (
                  corp.by_source.map((s) => <SourceRow key={s.source} stat={s} />)
                ) : (
                  <p className="text-[12px] text-white/25 py-4">
                    No source data available.
                  </p>
                )}
              </div>
            )}

            {/* ── RUNS tab ── */}
            {tab === "runs" && (
              <div className="flex flex-col">
                {data?.recent_runs.length ? (
                  data.recent_runs.map((r, i) => <RunRow key={i} run={r} />)
                ) : (
                  <p className="text-[12px] text-white/25 py-4">
                    No run history in atlas.ingest_runs yet.
                  </p>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Trigger footer ─────────────────────────────────────────────── */}
      <div className="shrink-0 border-t border-white/8 px-5 py-3 flex items-center gap-2">
        <select
          value={trigSource}
          onChange={(e) => setTrigSource(e.target.value)}
          disabled={triggering || pipeline?.running}
          className="flex-shrink-0 text-[12px] bg-white/6 border border-white/10 rounded-lg px-2.5 py-1.5 text-white/70 focus:outline-none focus:border-white/25 disabled:opacity-40 cursor-pointer"
        >
          {SOURCES.map((s) => (
            <option key={s} value={s} className="bg-[#1a1d27]">
              {s === "all" ? "All sources" : sourceMeta(s).label}
            </option>
          ))}
        </select>

        <button
          onClick={triggerRun}
          disabled={triggering || pipeline?.running}
          className={cn(
            "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all",
            "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30",
            "hover:bg-indigo-500/30 hover:border-indigo-500/50",
            "disabled:opacity-40 disabled:cursor-not-allowed"
          )}
        >
          {triggering ? (
            <>
              <span className="w-3 h-3 border border-indigo-400/50 border-t-indigo-300 rounded-full animate-spin" />
              Sending…
            </>
          ) : pipeline?.running ? (
            <>⏳ Running…</>
          ) : (
            <>▶ Run Now</>
          )}
        </button>

        <button
          onClick={refresh}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-white/30 hover:text-white/60 hover:bg-white/6 transition-colors text-[13px]"
          title="Refresh"
        >
          ↻
        </button>

        {trigMsg && (
          <span
            className={cn(
              "flex-1 text-[11px] truncate",
              trigMsg.startsWith("✓")
                ? "text-emerald-400/80"
                : trigMsg.startsWith("⚠")
                ? "text-amber-400/80"
                : "text-red-400/80"
            )}
          >
            {trigMsg}
          </span>
        )}
      </div>
    </div>
  );
}
