"use client";

import * as React from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";

import {
  readSurfaceViewMode,
  writeSurfaceViewMode,
  SURFACE_VIEW_MODE_SIZES,
  type SurfaceViewMode,
} from "@/lib/layout/surface-split-prefs";

type SurfaceSplitContextValue = {
  autoSaveId: string;
  viewMode: SurfaceViewMode;
  setViewMode: (mode: SurfaceViewMode) => void;
  registerChatPanel: (panel: ImperativePanelHandle | null) => void;
  /** PanelGroup finished layout — imperative resize is safe after this. */
  markPanelGroupReady: () => void;
  mobileChatOpen: boolean;
  setMobileChatOpen: (open: boolean) => void;
};

const SurfaceSplitContext = React.createContext<SurfaceSplitContextValue | null>(
  null,
);

export function useSurfaceSplit() {
  const ctx = React.useContext(SurfaceSplitContext);
  if (!ctx) {
    throw new Error("useSurfaceSplit must be used within SurfaceSplitProvider");
  }
  return ctx;
}

export function useSurfaceSplitOptional() {
  return React.useContext(SurfaceSplitContext);
}

/** Imperative panel APIs throw until PanelGroup has computed sizes. */
function safeApplyPanelSize(
  panel: ImperativePanelHandle,
  size: number,
): boolean {
  try {
    if (panel.isCollapsed()) panel.expand();
    panel.resize(size);
    return true;
  } catch {
    return false;
  }
}

export function SurfaceSplitProvider({
  autoSaveId,
  viewModeStorageKey,
  children,
}: {
  autoSaveId: string;
  /** Defaults to autoSaveId when omitted. */
  viewModeStorageKey?: string;
  children: React.ReactNode;
}) {
  const storageKey = viewModeStorageKey ?? autoSaveId;
  const chatPanelRef = React.useRef<ImperativePanelHandle | null>(null);
  const viewModeRef = React.useRef<SurfaceViewMode>("balanced");
  const layoutReadyRef = React.useRef(false);
  const [viewMode, setViewModeState] = React.useState<SurfaceViewMode>("balanced");
  const [mobileChatOpen, setMobileChatOpen] = React.useState(false);

  React.useEffect(() => {
    const stored = readSurfaceViewMode(storageKey);
    viewModeRef.current = stored;
    setViewModeState(stored);
  }, [storageKey]);

  const applyViewMode = React.useCallback((mode: SurfaceViewMode) => {
    const panel = chatPanelRef.current;
    if (!panel || !layoutReadyRef.current) return false;
    return safeApplyPanelSize(panel, SURFACE_VIEW_MODE_SIZES[mode]);
  }, []);

  const markPanelGroupReady = React.useCallback(() => {
    layoutReadyRef.current = true;
  }, []);

  const setViewMode = React.useCallback(
    (mode: SurfaceViewMode) => {
      viewModeRef.current = mode;
      setViewModeState(mode);
      writeSurfaceViewMode(storageKey, mode);
      if (!applyViewMode(mode)) {
        requestAnimationFrame(() => {
          applyViewMode(mode);
        });
      }
    },
    [applyViewMode, storageKey],
  );

  const registerChatPanel = React.useCallback(
    (panel: ImperativePanelHandle | null) => {
      chatPanelRef.current = panel;
      if (!panel) layoutReadyRef.current = false;
    },
    [],
  );

  const value = React.useMemo(
    () => ({
      autoSaveId,
      viewMode,
      setViewMode,
      registerChatPanel,
      markPanelGroupReady,
      mobileChatOpen,
      setMobileChatOpen,
    }),
    [
      autoSaveId,
      viewMode,
      setViewMode,
      registerChatPanel,
      markPanelGroupReady,
      mobileChatOpen,
    ],
  );

  return (
    <SurfaceSplitContext.Provider value={value}>
      {children}
    </SurfaceSplitContext.Provider>
  );
}
