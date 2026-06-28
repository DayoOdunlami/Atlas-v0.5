"use client";

import * as React from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/ui/resizable";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsLargeScreen } from "@/hooks/use-large-screen";
import {
  useSurfaceSplit,
  useSurfaceSplitOptional,
} from "@/components/layout/surface-split-provider";
import { SURFACE_VIEW_MODE_SIZES } from "@/lib/layout/surface-split-prefs";
import { cn } from "@/lib/utils";

export function SurfaceSplitPanels({
  chatPanel,
  canvasPanel,
  defaultChatSize = SURFACE_VIEW_MODE_SIZES.balanced,
  minChatSize = 18,
  maxChatSize = 42,
  mobileChatTitle = "Chat",
  className,
}: {
  chatPanel: React.ReactNode;
  canvasPanel: React.ReactNode;
  defaultChatSize?: number;
  minChatSize?: number;
  maxChatSize?: number;
  mobileChatTitle?: string;
  className?: string;
}) {
  const isLarge = useIsLargeScreen();
  const { autoSaveId, registerChatPanel, markPanelGroupReady, mobileChatOpen, setMobileChatOpen, viewMode } =
    useSurfaceSplit();

  const chatPanelRef = React.useCallback(
    (node: ImperativePanelHandle | null) => {
      registerChatPanel(node);
    },
    [registerChatPanel],
  );

  if (!isLarge) {
    return (
      <>
        <div className={cn("flex h-full min-h-0 flex-1 flex-col overflow-hidden", className)}>
          {canvasPanel}
        </div>
        <Sheet open={mobileChatOpen} onOpenChange={setMobileChatOpen}>
          <SheetContent
            side="bottom"
            className="flex h-[min(88vh,720px)] flex-col gap-0 p-0"
          >
            <SheetHeader className="shrink-0 border-b border-border px-4 py-3 text-left">
              <SheetTitle className="text-sm font-semibold">{mobileChatTitle}</SheetTitle>
            </SheetHeader>
            <div className="min-h-0 flex-1 overflow-hidden">{chatPanel}</div>
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <ResizablePanelGroup
      direction="horizontal"
      autoSaveId={autoSaveId}
      onLayout={markPanelGroupReady}
      className={cn("h-full min-h-0 flex-1", className)}
    >
      <ResizablePanel
        ref={chatPanelRef}
        defaultSize={SURFACE_VIEW_MODE_SIZES[viewMode] ?? defaultChatSize}
        minSize={minChatSize}
        maxSize={maxChatSize}
        collapsible
        collapsedSize={0}
        className="min-w-0"
      >
        <div className="flex h-full min-h-0 flex-col overflow-hidden border-r border-border">
          {chatPanel}
        </div>
      </ResizablePanel>

      <ResizableHandle
        withHandle
        className={cn(
          "group w-px bg-transparent transition-opacity",
          "opacity-0 hover:opacity-100 focus-visible:opacity-100",
          "data-[resize-handle-state=drag]:opacity-100",
        )}
      />

      <ResizablePanel minSize={45} className="min-w-0">
        <div className="flex h-full min-h-0 flex-col overflow-hidden">
          {canvasPanel}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

export function MobileChatTrigger({
  className,
  label = "Chat",
}: {
  className?: string;
  label?: string;
}) {
  const ctx = useSurfaceSplitOptional();
  if (!ctx) return null;

  return (
    <button
      type="button"
      onClick={() => ctx.setMobileChatOpen(true)}
      className={cn(
        "fixed bottom-4 right-4 z-40 inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 text-sm font-medium shadow-lg transition-colors hover:bg-muted lg:hidden",
        className,
      )}
      aria-label="Open chat panel"
    >
      <MessageSquareIcon />
      {label}
    </button>
  );
}

function MessageSquareIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}
