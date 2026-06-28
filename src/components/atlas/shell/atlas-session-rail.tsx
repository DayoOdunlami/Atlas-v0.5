"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { Home, MessageSquare, Pencil, Plus, Trash2, Wrench } from "lucide-react";
import { useState } from "react";

import { ConnectionStatus } from "@/components/atlas/shell/connection-status";
import { CaseFilePanel } from "@/components/atlas/shell/case-file-panel";
import { openAtlasDevOverlay, type AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";
import { SurfaceViewModeToggle } from "@/components/layout/surface-view-mode-toggle";
import type { PersistStatus, ThreadSummary } from "@/lib/atlas/thread-client";
import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";
import { cn } from "@/lib/utils";

function persistStatusLabel(status: PersistStatus, configured: boolean): string {
  if (!configured) return "Save off — DB not configured";
  switch (status) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Save failed";
    case "unavailable":
      return "Save unavailable";
    default:
      return "Sessions sync when a turn completes";
  }
}

export function AtlasSessionRail({
  threads,
  activeThreadId,
  loading,
  onSelectThread,
  onNewThread,
  onNewSession,
  chatPending,
  disabled,
  devMeta,
  persistStatus = "idle",
  persistConfigured = true,
  onDeleteThread,
  onRenameThread,
  rehydrating = false,
  caseFileSpec,
  onCaseFileSwot,
  onCaseEntityAttached,
}: {
  threads: ThreadSummary[];
  activeThreadId: string | null;
  loading?: boolean;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onNewSession?: () => void;
  chatPending?: boolean;
  disabled?: boolean;
  devMeta?: AtlasDevMeta | null;
  persistStatus?: PersistStatus;
  persistConfigured?: boolean;
  onDeleteThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, title: string) => void | Promise<void>;
  rehydrating?: boolean;
  caseFileSpec?: AnswerSpec | null;
  onCaseFileSwot?: (message: string) => void;
  onCaseEntityAttached?: (entityId: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const showDevControls =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ATLAS_DEV_OVERLAY === "1";

  const commitRename = (threadId: string) => {
    const trimmed = renameDraft.trim();
    setRenamingId(null);
    if (trimmed && onRenameThread) {
      void onRenameThread(threadId, trimmed);
    }
  };

  return (
    <aside
      data-testid="atlas-session-rail"
      data-expanded={expanded ? "true" : "false"}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={cn(
        "relative z-20 hidden h-full shrink-0 flex-col overflow-hidden border-r transition-all duration-500 ease-out lg:flex",
        expanded ? "w-64" : "w-14",
      )}
      style={{
        borderColor: T.rule,
        background: "#FAF8F4",
      }}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 border-b px-2 py-3",
          !expanded && "justify-center",
        )}
        style={{ borderColor: T.ruleSoft }}
      >
        <Link
          href="/atlas"
          title="Atlas home"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md no-underline"
          style={{ background: T.corpus, color: "#fff", fontFamily: atlasFont.mono, fontSize: 11, fontWeight: 700 }}
        >
          A
        </Link>
        <span
          className={cn(
            "truncate text-sm font-semibold transition-all duration-500",
            expanded ? "opacity-100 w-auto" : "w-0 overflow-hidden opacity-0",
          )}
          style={{ color: T.ink }}
        >
          Atlas
        </span>
      </div>

      {/* New question */}
      <div className="shrink-0 p-2">
        <button
          type="button"
          data-testid="atlas-sidebar-new-thread"
          disabled={disabled || chatPending}
          onClick={onNewThread}
          title="New question"
          className={cn(
            "flex w-full items-center gap-2 rounded-md border px-2 py-2 text-left transition-colors disabled:opacity-50",
            !expanded && "justify-center px-0",
          )}
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 10,
            color: T.corpus,
            borderColor: "#D4CFC4",
            background: T.corpusWash,
          }}
        >
          <Plus className="size-4 shrink-0" />
          <span
            className={cn(
              "transition-all duration-500",
              expanded ? "opacity-100 w-auto" : "w-0 overflow-hidden opacity-0",
            )}
          >
            New question
          </span>
        </button>
      </div>

      {/* Sessions */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div
          className={cn(
            "flex shrink-0 items-center gap-2 px-3 py-1.5 uppercase",
            !expanded && "justify-center px-0",
          )}
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 9,
            letterSpacing: "0.12em",
            color: T.inkFaint,
          }}
        >
          <MessageSquare className="size-3.5 shrink-0" />
          <span
            className={cn(
              "transition-all duration-500",
              expanded ? "opacity-100 w-auto" : "w-0 overflow-hidden opacity-0",
            )}
          >
            Sessions
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {loading && threads.length === 0 ? (
            expanded ? (
              <p style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}>
                Loading…
              </p>
            ) : null
          ) : threads.length === 0 ? (
            expanded ? (
              <p style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}>
                {persistConfigured
                  ? "No saved sessions yet — complete a turn to save."
                  : "Set POSTGRES_URL to enable session history."}
              </p>
            ) : null
          ) : (
            <>
              {rehydrating && expanded ? (
                <p
                  className="mb-2 px-1"
                  style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}
                >
                  Restoring session…
                </p>
              ) : null}
              <ul className="space-y-1">
                {threads.map((t, index) => {
                  const active = t.id === activeThreadId;
                  const renaming = renamingId === t.id;
                  return (
                    <li
                      key={t.id}
                      className={cn(
                        expanded && "animate-in slide-in-from-left-2 duration-300 fill-mode-backwards",
                      )}
                      style={expanded ? { animationDelay: `${index * 40}ms` } : undefined}
                    >
                      <div
                        className={cn(
                          "group flex w-full items-start rounded-md transition-colors",
                          expanded ? "gap-0" : "justify-center p-2",
                        )}
                        style={{
                          background: active ? T.corpusWash : "transparent",
                          border: active ? `1px solid ${T.rule}` : "1px solid transparent",
                        }}
                      >
                        {renaming && expanded ? (
                          <input
                            type="text"
                            autoFocus
                            value={renameDraft}
                            onChange={(e) => setRenameDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") commitRename(t.id);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            onBlur={() => commitRename(t.id)}
                            className="min-w-0 flex-1 rounded-md border px-2 py-2"
                            style={{
                              fontFamily: atlasFont.sans,
                              fontSize: 12,
                              borderColor: T.rule,
                              background: "#fff",
                            }}
                          />
                        ) : (
                          <button
                            type="button"
                            data-testid={`atlas-thread-${t.id}`}
                            title={t.title || "Untitled session"}
                            onClick={() => onSelectThread(t.id)}
                            className={cn(
                              "min-w-0 flex-1 rounded-md text-left transition-colors",
                              expanded ? "px-2 py-2" : "flex justify-center p-0",
                            )}
                            style={{
                              fontFamily: atlasFont.sans,
                              fontSize: 12,
                              lineHeight: 1.35,
                              color: active ? T.ink : T.inkSoft,
                              background: "transparent",
                              border: "none",
                            }}
                          >
                            {expanded ? (
                              <>
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
                              </>
                            ) : (
                              <span
                                className="inline-block size-2 rounded-full"
                                style={{ background: active ? T.corpus : T.inkFaint }}
                              />
                            )}
                          </button>
                        )}
                        {expanded && onRenameThread && !renaming ? (
                          <button
                            type="button"
                            data-testid={`atlas-thread-rename-${t.id}`}
                            title="Rename session"
                            disabled={disabled || chatPending}
                            onClick={() => {
                              setRenamingId(t.id);
                              setRenameDraft(t.title || "");
                            }}
                            className="mr-0.5 mt-1.5 shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-30"
                            style={{ color: T.inkFaint }}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                        ) : null}
                        {expanded && onDeleteThread ? (
                          <button
                            type="button"
                            data-testid={`atlas-thread-delete-${t.id}`}
                            title="Delete session"
                            disabled={disabled || chatPending}
                            onClick={() => void onDeleteThread(t.id)}
                            className="mr-1 mt-1.5 shrink-0 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 disabled:opacity-30"
                            style={{ color: T.inkFaint }}
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
      </div>

      <CaseFilePanel
        threadId={activeThreadId}
        spec={caseFileSpec ?? null}
        expanded={expanded}
        disabled={disabled || chatPending}
        onSwotRequest={onCaseFileSwot}
        onEntityAttached={onCaseEntityAttached}
      />

      {/* Workbench controls — moved from top bar */}
      <div
        className="shrink-0 space-y-2 border-t p-2"
        style={{ borderColor: T.ruleSoft }}
      >
        {showDevControls && expanded ? (
          <button
            type="button"
            data-testid="atlas-dev-overlay-toggle"
            onClick={() => openAtlasDevOverlay()}
            className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5"
            style={{
              fontFamily: atlasFont.mono,
              fontSize: 10,
              color: T.inkFaint,
              borderColor: T.rule,
              background: "transparent",
            }}
          >
            <Wrench className="size-3.5 shrink-0" />
            Dev timing & routing
          </button>
        ) : null}
        {expanded ? (
          <p
            data-testid="atlas-persist-status"
            className="px-1"
            style={{
              fontFamily: atlasFont.mono,
              fontSize: 9,
              color:
                persistStatus === "error" || !persistConfigured
                  ? "#9A3412"
                  : persistStatus === "saved"
                    ? T.corpus
                    : T.inkFaint,
            }}
          >
            {persistStatusLabel(persistStatus, persistConfigured)}
          </p>
        ) : null}
        <div className={cn(!expanded && "flex flex-col items-center gap-2")}>
          <ConnectionStatus devMeta={devMeta} compact={!expanded} className="relative w-full" />
          <SurfaceViewModeToggle
            compact={!expanded}
            className={cn(
              expanded ? "w-full justify-center" : "flex-col border-0 bg-transparent p-0",
            )}
          />
        </div>
        {onNewSession ? (
          <button
            type="button"
            data-testid="atlas-new-question"
            disabled={chatPending}
            onClick={onNewSession}
            title="Clear and start fresh"
            className={cn(
              "flex w-full items-center gap-2 rounded-md border px-2 py-1.5 transition-opacity disabled:cursor-not-allowed disabled:opacity-50",
              !expanded && "justify-center",
            )}
            style={{
              fontFamily: atlasFont.mono,
              fontSize: 10,
              color: T.inkFaint,
              borderColor: T.rule,
              background: "transparent",
            }}
          >
            <Home className="size-3.5 shrink-0" />
            <span
              className={cn(
                "transition-all duration-500",
                expanded ? "opacity-100 w-auto" : "w-0 overflow-hidden opacity-0",
              )}
            >
              Back to entry
            </span>
          </button>
        ) : null}
      </div>

      {!expanded ? (
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-1/2 h-16 w-1 -translate-y-1/2 rounded-l-full bg-gradient-to-b from-transparent via-[#3F7A52]/40 to-transparent"
        />
      ) : null}

      {/* Legacy test hook — rail is always visible; hover expands */}
      <span data-testid="atlas-history-expand" className="sr-only">
        Session history rail
      </span>
    </aside>
  );
}
