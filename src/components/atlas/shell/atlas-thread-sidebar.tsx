"use client";

import { formatDistanceToNow } from "date-fns";

import type { ThreadSummary } from "@/lib/atlas/thread-client";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

const SIDEBAR_OPEN_KEY = "atlas-v5-history-open";

export function readHistorySidebarOpen(): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(SIDEBAR_OPEN_KEY) === "1";
}

export function writeHistorySidebarOpen(open: boolean): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(SIDEBAR_OPEN_KEY, open ? "1" : "0");
}

export function AtlasThreadSidebar({
  threads,
  activeThreadId,
  loading,
  open,
  onToggle,
  onSelectThread,
  onNewThread,
  disabled,
}: {
  threads: ThreadSummary[];
  activeThreadId: string | null;
  loading?: boolean;
  open: boolean;
  onToggle: () => void;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  disabled?: boolean;
}) {
  if (!open) {
    return (
      <button
        type="button"
        data-testid="atlas-history-expand"
        onClick={onToggle}
        className="hidden shrink-0 self-start rounded border lg:flex"
        style={{
          fontFamily: atlasFont.mono,
          fontSize: 10,
          letterSpacing: "0.08em",
          padding: "8px 10px",
          color: T.inkFaint,
          borderColor: T.rule,
          background: "#FAF8F4",
        }}
        title="Show session history"
      >
        History ▸
      </button>
    );
  }

  return (
    <aside
      data-testid="atlas-thread-sidebar"
      className="hidden min-h-0 w-[220px] shrink-0 flex-col overflow-hidden rounded-sm border lg:flex"
      style={{
        borderColor: T.rule,
        background: "#FAF8F4",
      }}
    >
      <div
        className="flex items-center gap-1 border-b px-2 py-2"
        style={{ borderColor: T.ruleSoft }}
      >
        <span
          className="flex-1 uppercase"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 9,
            letterSpacing: "0.12em",
            color: T.inkFaint,
          }}
        >
          Sessions
        </span>
        <button
          type="button"
          onClick={onToggle}
          style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}
          aria-label="Collapse history"
        >
          ◂
        </button>
      </div>

      <div className="p-2">
        <button
          type="button"
          data-testid="atlas-sidebar-new-thread"
          disabled={disabled}
          onClick={onNewThread}
          className="w-full rounded border px-2 py-1.5 text-left disabled:opacity-50"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 10,
            color: T.corpus,
            borderColor: "#D4CFC4",
            background: T.corpusWash,
          }}
        >
          + New question
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
        {loading ? (
          <p style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}>
            Loading…
          </p>
        ) : threads.length === 0 ? (
          <p style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}>
            No saved sessions yet.
          </p>
        ) : (
          <ul className="space-y-1">
            {threads.map((t) => {
              const active = t.id === activeThreadId;
              return (
                <li key={t.id}>
                  <button
                    type="button"
                    data-testid={`atlas-thread-${t.id}`}
                    onClick={() => onSelectThread(t.id)}
                    className="w-full rounded px-2 py-2 text-left"
                    style={{
                      fontFamily: atlasFont.sans,
                      fontSize: 12,
                      lineHeight: 1.35,
                      color: active ? T.ink : T.inkSoft,
                      background: active ? T.corpusWash : "transparent",
                      border: active ? `1px solid ${T.rule}` : "1px solid transparent",
                    }}
                  >
                    <div className="truncate font-medium">
                      {t.title || "Untitled session"}
                    </div>
                    <div
                      style={{
                        fontFamily: atlasFont.mono,
                        fontSize: 9,
                        color: T.inkFaint,
                        marginTop: 2,
                      }}
                    >
                      {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
