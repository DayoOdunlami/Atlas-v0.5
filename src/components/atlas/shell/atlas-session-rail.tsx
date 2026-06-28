"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  FolderOpen,
  Home,
  MessageSquare,
  Pencil,
  Pin,
  Plus,
  Settings2,
  Sparkles,
  Trash2,
  Wrench,
} from "lucide-react";
import { useLayoutEffect, useMemo, useState } from "react";

import { ConnectionStatus } from "@/components/atlas/shell/connection-status";
import { CaseFilePanel } from "@/components/atlas/shell/case-file-panel";
import { openAtlasDevOverlay, type AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";
import { RailCollapsibleSection } from "@/components/atlas/shell/rail-collapsible-section";
import { SurfaceViewModeToggle } from "@/components/layout/surface-view-mode-toggle";
import {
  declaredClaimsFromSpec,
  SWOT_ON_CLAIMS_PROMPT,
} from "@/lib/atlas/case-file-types";
import type { PersistStatus, ThreadSummary } from "@/lib/atlas/thread-client";
import {
  readRailSectionOpen,
  writeRailSectionOpen,
  type RailSectionId,
} from "@/lib/atlas/rail-section-prefs";
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
  syncing = false,
  onSelectThread,
  onNewThread,
  onNewSession,
  onClearAllSessions,
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
  syncing?: boolean;
  onSelectThread: (threadId: string) => void;
  onNewThread: () => void;
  onNewSession?: () => void;
  onClearAllSessions?: () => void;
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
  const [pinned, setPinned] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [sessionsOpen, setSessionsOpen] = useState(true);
  const [caseFileOpen, setCaseFileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [sectionsHydrated, setSectionsHydrated] = useState(false);
  const isOpen = expanded || pinned;
  const claimCount = useMemo(
    () => declaredClaimsFromSpec(caseFileSpec ?? null).length,
    [caseFileSpec],
  );

  useLayoutEffect(() => {
    setSessionsOpen(readRailSectionOpen("sessions", true));
    setCaseFileOpen(readRailSectionOpen("caseFile", claimCount > 0));
    setToolsOpen(readRailSectionOpen("tools", false));
    setSectionsHydrated(true);
  }, [claimCount]);

  const showDevControls =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ATLAS_DEV_OVERLAY === "1";

  const toggleSection = (id: RailSectionId, open: boolean, setOpen: (v: boolean) => void) => {
    if (!isOpen) setExpanded(true);
    const next = isOpen ? !open : true;
    setOpen(next);
    writeRailSectionOpen(id, next);
  };

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
      data-expanded={isOpen ? "true" : "false"}
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => {
        if (!pinned) setExpanded(false);
      }}
      className={cn(
        "relative z-20 hidden h-full shrink-0 flex-col overflow-hidden border-r transition-all duration-500 ease-out lg:flex",
        isOpen ? "w-64" : "w-14",
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
          !isOpen && "justify-center",
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
            isOpen ? "opacity-100 w-auto" : "w-0 overflow-hidden opacity-0",
          )}
          style={{ color: T.ink }}
        >
          Atlas
        </span>
        {isOpen ? (
          <button
            type="button"
            title={pinned ? "Unpin sidebar" : "Pin sidebar open"}
            onClick={() => setPinned((v) => !v)}
            className="ml-auto rounded p-1"
            style={{ color: pinned ? T.corpus : T.inkFaint }}
          >
            <Pin className={cn("size-3.5", pinned && "fill-current")} />
          </button>
        ) : null}
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
            !isOpen && "justify-center px-0",
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
              isOpen ? "opacity-100 w-auto" : "w-0 overflow-hidden opacity-0",
            )}
          >
            New question
          </span>
        </button>
      </div>

      {/* Collapsible sections — single scroll stack */}
      <div
        className={cn(
          "flex min-h-0 flex-1 flex-col overflow-y-auto",
          !isOpen && "items-center gap-2 py-2",
        )}
      >
        <RailCollapsibleSection
          testId="atlas-rail-sessions"
          icon={<MessageSquare className="size-3.5" />}
          title="Sessions"
          subtitle={
            threads.length > 0
              ? `${threads.length} saved · ${syncing ? "syncing" : "ready"}`
              : syncing
                ? "Loading from database…"
                : "No saved sessions yet"
          }
          badge={threads.length || undefined}
          open={sectionsHydrated ? sessionsOpen : true}
          onToggle={() => toggleSection("sessions", sessionsOpen, setSessionsOpen)}
          railOpen={isOpen}
          maxBodyHeight="max-h-[min(50vh,320px)]"
        >
          {threads.length === 0 && syncing ? (
            <p style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}>
              Loading…
            </p>
          ) : threads.length === 0 ? (
            <p style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}>
              {persistConfigured
                ? "Complete a turn to save a session."
                : "Set POSTGRES_URL to enable session history."}
            </p>
          ) : (
            <>
              {rehydrating ? (
                <p
                  className="mb-2 px-1"
                  style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}
                >
                  Restoring session…
                </p>
              ) : null}
              <ul className="m-0 list-none space-y-1 p-0">
                {threads.map((t) => {
                  const active = t.id === activeThreadId;
                  const renaming = renamingId === t.id;
                  return (
                    <li key={t.id}>
                      <div
                        className="group flex w-full items-start rounded-md transition-colors"
                        style={{
                          background: active ? T.corpusWash : "transparent",
                          border: active ? `1px solid ${T.rule}` : "1px solid transparent",
                        }}
                      >
                        {renaming ? (
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
                            className="min-w-0 flex-1 rounded-md px-2 py-2 text-left"
                            style={{
                              fontFamily: atlasFont.sans,
                              fontSize: 12,
                              lineHeight: 1.35,
                              color: active ? T.ink : T.inkSoft,
                              background: "transparent",
                              border: "none",
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
                        )}
                        {onRenameThread && !renaming ? (
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
                        {onDeleteThread ? (
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
              {onClearAllSessions && threads.length > 1 ? (
                <button
                  type="button"
                  data-testid="atlas-clear-all-sessions"
                  disabled={disabled || chatPending}
                  onClick={() => void onClearAllSessions()}
                  className="mt-2 w-full rounded-md border px-2 py-1.5 text-left disabled:opacity-50"
                  style={{
                    fontFamily: atlasFont.mono,
                    fontSize: 9,
                    color: "#9A3412",
                    borderColor: T.rule,
                    background: "transparent",
                  }}
                >
                  Clear all sessions
                </button>
              ) : null}
            </>
          )}
        </RailCollapsibleSection>

        <RailCollapsibleSection
          testId="atlas-rail-case-file"
          icon={<FolderOpen className="size-3.5" />}
          title="Case file"
          subtitle={
            claimCount > 0
              ? `${claimCount} declared · max Indicative`
              : "Constraints, goals, uncertainties"
          }
          badge={claimCount || undefined}
          headerAction={
            claimCount > 0 && onCaseFileSwot ? (
              <button
                type="button"
                data-testid="case-file-swot-btn"
                disabled={disabled || chatPending}
                title="SWOT on your stated claims"
                onClick={(e) => {
                  e.stopPropagation();
                  onCaseFileSwot(SWOT_ON_CLAIMS_PROMPT);
                }}
                className="flex items-center gap-1 rounded border px-1.5 py-0.5 text-[9px] disabled:opacity-40"
                style={{
                  borderColor: T.declared,
                  color: T.declared,
                  background: T.declaredWash,
                  fontFamily: atlasFont.mono,
                }}
              >
                <Sparkles className="size-3" />
                SWOT
              </button>
            ) : null
          }
          open={sectionsHydrated ? caseFileOpen : claimCount > 0}
          onToggle={() => toggleSection("caseFile", caseFileOpen, setCaseFileOpen)}
          railOpen={isOpen}
          maxBodyHeight="max-h-[min(45vh,300px)]"
        >
          <CaseFilePanel
            threadId={activeThreadId}
            spec={caseFileSpec ?? null}
            expanded
            embedded
            disabled={disabled || chatPending}
            onSwotRequest={onCaseFileSwot}
            onEntityAttached={onCaseEntityAttached}
          />
        </RailCollapsibleSection>

        {showDevControls ? (
          <RailCollapsibleSection
            testId="atlas-rail-tools"
            icon={<Settings2 className="size-3.5" />}
            title="Tools"
            subtitle="Dev overlay & save status"
            open={sectionsHydrated ? toolsOpen : false}
            onToggle={() => toggleSection("tools", toolsOpen, setToolsOpen)}
            railOpen={isOpen}
            maxBodyHeight="max-h-40"
          >
            <div className="space-y-2 px-1">
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
              <p
                data-testid="atlas-persist-status"
                className="m-0 px-1"
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
            </div>
          </RailCollapsibleSection>
        ) : (
          isOpen ? (
            <p
              data-testid="atlas-persist-status"
              className="shrink-0 px-3 py-1"
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
          ) : null
        )}
      </div>

      {/* Footer — always visible */}
      <div
        className="shrink-0 space-y-2 border-t p-2"
        style={{ borderColor: T.ruleSoft }}
      >
        <div className={cn(!isOpen && "flex flex-col items-center gap-2")}>
          <ConnectionStatus devMeta={devMeta} compact={!isOpen} className="relative w-full" />
          <SurfaceViewModeToggle
            compact={!isOpen}
            className={cn(
              isOpen ? "w-full justify-center" : "flex-col border-0 bg-transparent p-0",
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
              !isOpen && "justify-center",
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
                isOpen ? "opacity-100 w-auto" : "w-0 overflow-hidden opacity-0",
              )}
            >
              Back to entry
            </span>
          </button>
        ) : null}
      </div>

      {!isOpen ? (
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
