/** View presets for chat ↔ canvas split layouts. */
export type SurfaceViewMode = "balanced" | "canvas-focus" | "chat-focus";

export const SURFACE_VIEW_MODE_SIZES: Record<SurfaceViewMode, number> = {
  balanced: 28,
  "canvas-focus": 18,
  "chat-focus": 40,
};

const VIEW_MODE_PREFIX = "atlas-surface-view-mode:";

export function readSurfaceViewMode(storageKey: string): SurfaceViewMode {
  if (typeof window === "undefined") return "balanced";
  try {
    const raw = localStorage.getItem(`${VIEW_MODE_PREFIX}${storageKey}`);
    if (raw === "balanced" || raw === "canvas-focus" || raw === "chat-focus") {
      return raw;
    }
  } catch {
    /* ignore */
  }
  return "balanced";
}

export function writeSurfaceViewMode(
  storageKey: string,
  mode: SurfaceViewMode,
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`${VIEW_MODE_PREFIX}${storageKey}`, mode);
  } catch {
    /* ignore */
  }
}
