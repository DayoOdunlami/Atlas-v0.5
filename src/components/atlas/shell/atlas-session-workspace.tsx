"use client";

import type { ReactNode } from "react";

import { DevOverlay, type AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";
import { AtlasSessionRail } from "@/components/atlas/shell/atlas-session-rail";
import { SurfaceSplitProvider } from "@/components/layout/surface-split-provider";
import {
  MobileChatTrigger,
  SurfaceSplitPanels,
} from "@/components/layout/surface-split-panels";
import type { AtlasUxPrefs } from "@/lib/atlas/ux-preferences";
import type { ThreadSummary, PersistStatus } from "@/lib/atlas/thread-client";
import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

type AtlasSessionWorkspaceProps = {
  dataTestAttrs?: Record<string, string | undefined>;
  banners?: ReactNode;
  canvasPanel: ReactNode;
  chatPanel: ReactNode;
  devMeta?: AtlasDevMeta | null;
  dataSource?: string;
  uxPrefs?: AtlasUxPrefs;
  onUxPrefsChange?: (patch: Partial<AtlasUxPrefs>) => void;
  turnTiming?: { elapsedMs: number | null; running: boolean };
  threads: ThreadSummary[];
  activeThreadId: string | null;
  threadsLoading?: boolean;
  onSelectThread?: (threadId: string) => void;
  onNewThread?: () => void;
  onNewSession?: () => void;
  chatPending?: boolean;
  historyDisabled?: boolean;
  persistStatus?: PersistStatus;
  persistConfigured?: boolean;
  onDeleteThread?: (threadId: string) => void;
  onRenameThread?: (threadId: string, title: string) => void | Promise<void>;
  rehydrating?: boolean;
  caseFileSpec?: AnswerSpec | null;
  onCaseFileSwot?: (message: string) => void;
  onCaseEntityAttached?: (entityId: string | null) => void;
};

/** Full-bleed Claude-style session shell: hover rail + resizable chat/canvas. */
export function AtlasSessionWorkspace({
  dataTestAttrs,
  banners,
  canvasPanel,
  chatPanel,
  devMeta,
  dataSource,
  uxPrefs,
  onUxPrefsChange,
  turnTiming,
  threads,
  activeThreadId,
  threadsLoading,
  onSelectThread,
  onNewThread,
  onNewSession,
  chatPending,
  historyDisabled,
  persistStatus,
  persistConfigured,
  onDeleteThread,
  onRenameThread,
  rehydrating,
  caseFileSpec,
  onCaseFileSwot,
  onCaseEntityAttached,
}: AtlasSessionWorkspaceProps) {
  const showRail = Boolean(onSelectThread && onNewThread);

  return (
    <SurfaceSplitProvider autoSaveId="atlas-session-split">
      <div
        data-testid="atlas-surface-root"
        data-datasource={dataSource}
        {...dataTestAttrs}
        className="flex h-svh flex-col overflow-hidden"
        style={{ background: T.canvas, fontFamily: atlasFont.sans }}
      >
        {banners}

        <div className="flex min-h-0 flex-1 overflow-hidden">
          {showRail ? (
            <AtlasSessionRail
              threads={threads}
              activeThreadId={activeThreadId}
              loading={threadsLoading}
              onSelectThread={onSelectThread!}
              onNewThread={onNewThread!}
              onNewSession={onNewSession}
              chatPending={chatPending}
              disabled={historyDisabled}
              devMeta={devMeta}
              persistStatus={persistStatus}
              persistConfigured={persistConfigured}
              onDeleteThread={onDeleteThread}
              onRenameThread={onRenameThread}
              rehydrating={rehydrating}
              caseFileSpec={caseFileSpec}
              onCaseFileSwot={onCaseFileSwot}
              onCaseEntityAttached={onCaseEntityAttached}
            />
          ) : null}

          <SurfaceSplitPanels
            className="min-h-0 min-w-0 flex-1"
            mobileChatTitle="Atlas chat"
            canvasPanel={canvasPanel}
            chatPanel={chatPanel}
          />
        </div>

        <MobileChatTrigger label="Chat" />

        <DevOverlay
          meta={devMeta ?? null}
          dataSource={dataSource as "brain" | "mouth" | "golden" | undefined}
          uxPrefs={uxPrefs}
          onUxPrefsChange={onUxPrefsChange}
          turnTiming={turnTiming}
        />
      </div>
    </SurfaceSplitProvider>
  );
}
