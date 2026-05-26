/**
 * Atlas 5 — Surface Gateway Init
 *
 * Tiny client component that writes the initial surface_state.json to
 * sessionStorage when the page first mounts. Playwright reads this to
 * verify the surface gateway hook is wired up correctly.
 */
"use client";

import { useEffect } from "react";

import {
  SURFACE_STATE_KEY,
  useSurfaceStore,
} from "@/lib/atlas5/surface-gateway";

export function SurfaceGatewayInit() {
  const surface = useSurfaceStore((s) => s.surface);

  useEffect(() => {
    // Write initial state to sessionStorage
    try {
      const json = JSON.stringify(surface);
      window.sessionStorage.setItem(SURFACE_STATE_KEY, json);
      // biome-ignore lint/suspicious/noExplicitAny: debug convenience
      (window as any).__atlas5_surface_state = surface;
    } catch {
      // May fail in certain test environments
    }
  }, [surface]);

  return null;
}
