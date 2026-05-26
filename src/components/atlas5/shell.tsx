/**
 * Atlas 5 — Shell component (D9)
 *
 * Client component that manages the top-level mode switch:
 *   mode === 'chat'   → three-pane layout (header + chat + artifact)
 *   mode === 'canvas' → full-screen tldraw (CanvasPane overlays everything)
 *
 * Extracted from page.tsx because it needs client hooks (useSurfaceGateway).
 */
"use client";

import dynamic from "next/dynamic";

import { AgentSwitcher } from "./agent-switcher";
import { ArtifactPane } from "./artifact-pane";
import { ChatPane } from "./chat-pane";
import { LensSelector } from "./lens-selector";
import { useSurfaceGateway } from "@/lib/atlas5/surface-gateway";

// Lazy-load tldraw so it doesn't affect the chat/artifact bundle
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
      {/* Canvas mode — full-screen overlay, no header */}
      {isCanvas && <CanvasPane />}

      {/* Chat + artifact layout (hidden but not unmounted so state persists) */}
      <div
        className={`flex flex-col h-screen bg-background overflow-hidden ${
          isCanvas ? "hidden" : ""
        }`}
      >
        {/* ----------------------------------------------------------------
            Header — agent switcher + lens selector + canvas toggle
        ---------------------------------------------------------------- */}
        <header
          data-testid="atlas5-header"
          className="flex items-center gap-2 px-3 py-2 border-b border-border bg-background shrink-0"
        >
          <span className="text-sm font-semibold text-foreground mr-2 select-none">
            Atlas 5
          </span>

          {/* Agent tabs: ATLAS / JARVIS / CICERONE / HYVE */}
          <AgentSwitcher />

          <div className="flex-1" />

          {/* Lens selector: CPC / Atlas / Ecosystem / Funder / Mode */}
          <LensSelector />

          {/* Canvas mode toggle */}
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

        {/* ----------------------------------------------------------------
            Body — chat pane (left) + artifact pane (right)
        ---------------------------------------------------------------- */}
        <div className="flex flex-1 overflow-hidden">
          {/* Chat pane — left, ~40% width */}
          <div className="w-[40%] min-w-[320px] shrink-0">
            <ChatPane />
          </div>

          {/* Resizer */}
          <div
            aria-hidden="true"
            className="w-px bg-border shrink-0 cursor-col-resize hover:bg-primary/50 transition-colors"
          />

          {/* Artifact pane — right, fills remaining space */}
          <div className="flex-1 min-w-0">
            <ArtifactPane />
          </div>
        </div>
      </div>
    </>
  );
}
