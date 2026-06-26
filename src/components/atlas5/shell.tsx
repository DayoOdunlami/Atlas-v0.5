/**
 * Atlas 5 — Shell component (D9)
 *
 * Client component that manages the top-level mode switch:
 *   mode === 'chat'   → three-pane layout (header + chat + artifact)
 *   mode === 'canvas' → full-screen tldraw (CanvasPane overlays everything)
 */
"use client";

import dynamic from "next/dynamic";

import { AgentSwitcher } from "./agent-switcher";
import { ArtifactPane } from "./artifact-pane";
import { ChatPane } from "./chat-pane";
import { LensSelector } from "./lens-selector";
import { useSurfaceGateway } from "@/lib/atlas5/surface-gateway";
import { SurfaceSplitProvider } from "@/components/layout/surface-split-provider";
import {
  MobileChatTrigger,
  SurfaceSplitPanels,
} from "@/components/layout/surface-split-panels";
import { SurfaceViewModeToggle } from "@/components/layout/surface-view-mode-toggle";

const CanvasPane = dynamic(
  () => import("./canvas-pane").then((m) => m.CanvasPane),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center text-muted-foreground text-sm">
        Loading canvas…
      </div>
    ),
  },
);

export function Atlas5Shell() {
  const { surface, setMode } = useSurfaceGateway();
  const isCanvas = surface.mode === "canvas";

  return (
    <>
      {isCanvas && <CanvasPane />}

      <SurfaceSplitProvider autoSaveId="atlas5-chat-artifact-split">
        <div
          className={`flex flex-col h-svh bg-background overflow-hidden ${
            isCanvas ? "hidden" : ""
          }`}
        >
          <header
            data-testid="atlas5-header"
            className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background shrink-0"
          >
            <span className="text-sm font-semibold text-foreground mr-2 select-none">
              Atlas 5
            </span>

            <AgentSwitcher />

            <div className="flex-1" />

            <SurfaceViewModeToggle compact className="hidden md:inline-flex mr-2" />

            <LensSelector />

            <button
              type="button"
              onClick={() => setMode("canvas")}
              data-testid="canvas-mode-button"
              aria-label="Open canvas mode"
              className="ml-1 flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="m9 15 6-6" />
                <path d="m9 9 6 6" />
              </svg>
              Canvas
            </button>
          </header>

          <div className="relative flex flex-1 min-h-0 overflow-hidden">
            <SurfaceSplitPanels
              defaultChatSize={40}
              minChatSize={22}
              maxChatSize={55}
              chatPanel={<ChatPane />}
              canvasPanel={<ArtifactPane />}
              mobileChatTitle="Atlas 5 Chat"
              className="min-w-0 flex-1"
            />
            <MobileChatTrigger label="Chat" />
          </div>
        </div>
      </SurfaceSplitProvider>
    </>
  );
}
