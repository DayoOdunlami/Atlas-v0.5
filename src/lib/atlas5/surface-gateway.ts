/**
 * Atlas 5 — Surface Gateway
 *
 * Tracks the active agent, lens, mode, and thread. On every change it:
 * 1. Updates in-memory Zustand state
 * 2. Writes surface_state.json to sessionStorage (Playwright-readable)
 * 3. Exposes window.__atlas5_surface_state for debugging
 *
 * Mode (added D9):
 *   'chat'     — default two-pane layout (chat + artifact)
 *   'canvas'   — tldraw full-screen mode (chat + artifact hidden)
 *   'showcase' — demo layout: full-width visuals, minimal chrome
 */
"use client";

import { useCallback } from "react";
import { create } from "zustand";

import type { AgentId, LensId, SurfaceMode, SurfaceState } from "./types";

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_AGENT: AgentId = "ATLAS";
const DEFAULT_LENS: LensId = "CPC";
const DEFAULT_MODE: SurfaceMode = "chat";

function makeSurfaceState(overrides: Partial<SurfaceState> = {}): SurfaceState {
  return {
    active_agent: DEFAULT_AGENT,
    active_lens: DEFAULT_LENS,
    mode: DEFAULT_MODE,
    thread_id: null,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

interface SurfaceStore {
  surface: SurfaceState;
  setSurface: (update: Partial<SurfaceState>) => void;
}

export const useSurfaceStore = create<SurfaceStore>((set) => ({
  surface: makeSurfaceState(),
  setSurface: (update) =>
    set((prev) => ({
      surface: {
        ...prev.surface,
        ...update,
        timestamp: new Date().toISOString(),
      },
    })),
}));

// ---------------------------------------------------------------------------
// Surface gateway hook
// ---------------------------------------------------------------------------

export const SURFACE_STATE_KEY = "surface_state.json";

/**
 * Primary hook for Atlas 5 surfaces.
 *
 * Usage:
 *   const { surface, setAgent, setLens, setMode, setThreadId } = useSurfaceGateway();
 */
export function useSurfaceGateway() {
  const { surface, setSurface } = useSurfaceStore();

  /** Write state to sessionStorage + window debug var */
  const persist = useCallback((next: SurfaceState) => {
    if (typeof window === "undefined") return;
    const json = JSON.stringify(next);
    try {
      window.sessionStorage.setItem(SURFACE_STATE_KEY, json);
      (window as unknown as Record<string, unknown>).__atlas5_surface_state =
        next;
    } catch {
      // sessionStorage may be unavailable in some test environments
    }
  }, []);

  const setAgent = useCallback(
    (agent: AgentId) => {
      setSurface({ active_agent: agent });
      persist({
        ...surface,
        active_agent: agent,
        timestamp: new Date().toISOString(),
      });
    },
    [surface, setSurface, persist],
  );

  const setLens = useCallback(
    (lens: LensId) => {
      setSurface({ active_lens: lens });
      persist({
        ...surface,
        active_lens: lens,
        timestamp: new Date().toISOString(),
      });
    },
    [surface, setSurface, persist],
  );

  const setMode = useCallback(
    (mode: SurfaceMode) => {
      setSurface({ mode });
      persist({
        ...surface,
        mode,
        timestamp: new Date().toISOString(),
      });
    },
    [surface, setSurface, persist],
  );

  const setThreadId = useCallback(
    (threadId: string | null) => {
      setSurface({ thread_id: threadId });
      persist({
        ...surface,
        thread_id: threadId,
        timestamp: new Date().toISOString(),
      });
    },
    [surface, setSurface, persist],
  );

  return { surface, setAgent, setLens, setMode, setThreadId };
}
