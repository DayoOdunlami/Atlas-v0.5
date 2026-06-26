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
  const [viewMode, setViewModeState] = React.useState<SurfaceViewMode>("balanced");
  const [mobileChatOpen, setMobileChatOpen] = React.useState(false);

  React.useEffect(() => {
    setViewModeState(readSurfaceViewMode(storageKey));
  }, [storageKey]);

  const applyViewMode = React.useCallback((mode: SurfaceViewMode) => {
    const panel = chatPanelRef.current;
    const size = SURFACE_VIEW_MODE_SIZES[mode];
    if (panel) {
      if (panel.isCollapsed()) panel.expand();
      panel.resize(size);
    }
  }, []);

  const setViewMode = React.useCallback(
    (mode: SurfaceViewMode) => {
      setViewModeState(mode);
      writeSurfaceViewMode(storageKey, mode);
      applyViewMode(mode);
    },
    [applyViewMode, storageKey],
  );

  const registerChatPanel = React.useCallback(
    (panel: ImperativePanelHandle | null) => {
      chatPanelRef.current = panel;
      if (panel) applyViewMode(readSurfaceViewMode(storageKey));
    },
    [applyViewMode, storageKey],
  );

  const value = React.useMemo(
    () => ({
      autoSaveId,
      viewMode,
      setViewMode,
      registerChatPanel,
      mobileChatOpen,
      setMobileChatOpen,
    }),
    [
      autoSaveId,
      viewMode,
      setViewMode,
      registerChatPanel,
      mobileChatOpen,
    ],
  );

  return (
    <SurfaceSplitContext.Provider value={value}>
      {children}
    </SurfaceSplitContext.Provider>
  );
}
