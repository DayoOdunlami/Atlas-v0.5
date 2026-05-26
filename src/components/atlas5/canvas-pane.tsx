/**
 * Atlas 5 — Canvas Pane (D9)
 *
 * Full-screen tldraw canvas. Activated when surface mode === 'canvas'.
 * Chat and artifact panes are hidden while this is active.
 *
 * Features:
 * - tldraw workspace (production surface — see CLAUDE.md)
 * - Save button (top right) — persists scene to atlas.canvas_scenes
 * - Load existing scene on mount for the current thread_id
 * - Agent output cards can be added as draggable tldraw shapes
 *
 * data-testid="canvas-pane" — stable selector for Playwright + Tier 1 eval.
 */
"use client";

import { Tldraw, type Editor, type TLShapeId } from "tldraw";
import "tldraw/tldraw.css";
import { useCallback, useEffect, useRef, useState } from "react";

import { useSurfaceGateway } from "@/lib/atlas5/surface-gateway";
import { useArtifactStore } from "@/lib/atlas5/artifact-store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CanvasScene {
  shapes: object[];
  camera: { x: number; y: number; z: number };
  savedAt: string;
}

// ---------------------------------------------------------------------------
// Save / load helpers
// ---------------------------------------------------------------------------

async function saveCanvasScene(
  threadId: string,
  scene: CanvasScene,
): Promise<void> {
  await fetch("/api/atlas5/canvas", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ thread_id: threadId, scene_json: scene }),
  });
}

async function loadCanvasScene(threadId: string): Promise<CanvasScene | null> {
  const res = await fetch(
    `/api/atlas5/canvas?thread_id=${encodeURIComponent(threadId)}`,
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { scene_json?: CanvasScene };
  return data.scene_json ?? null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CanvasPane() {
  const { surface, setMode } = useSurfaceGateway();
  const { artifact } = useArtifactStore();
  const editorRef = useRef<Editor | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">(
    "idle",
  );

  // Load existing scene when canvas opens (if thread exists)
  useEffect(() => {
    if (!surface.thread_id || !editorRef.current) return;
    let cancelled = false;
    loadCanvasScene(surface.thread_id).then((scene) => {
      if (cancelled || !scene || !editorRef.current) return;
      // Restore camera
      const { x, y, z } = scene.camera;
      editorRef.current.setCamera({ x, y, z });
    });
    return () => {
      cancelled = true;
    };
  }, [surface.thread_id]);

  // Handle save
  const handleSave = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;

    setSaving(true);
    setSaveStatus("idle");

    try {
      const camera = editor.getCamera();
      const shapes = editor.getCurrentPageShapes().map((s) => ({ ...s }));

      const scene: CanvasScene = {
        shapes,
        camera: { x: camera.x, y: camera.y, z: camera.z },
        savedAt: new Date().toISOString(),
      };

      const threadId = surface.thread_id ?? `canvas-${Date.now()}`;
      await saveCanvasScene(threadId, scene);
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2500);
    } catch {
      setSaveStatus("error");
    } finally {
      setSaving(false);
    }
  }, [surface.thread_id]);

  // Add artifact as a card on the canvas
  const addArtifactCard = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !artifact) return;

    const label =
      artifact.type === "brief"
        ? `ATLAS Brief — ${artifact.confidence_tier}\n${
            artifact.npv_value != null
              ? `NPV: £${artifact.npv_value.toLocaleString()}`
              : ""
          }`
        : artifact.analysis
          ? `${artifact.agent} — ${artifact.confidence_tier}\n${artifact.analysis.slice(0, 200)}`
          : `${artifact.agent} — ${artifact.confidence_tier}`;

    const viewportCenter = editor.getViewportScreenCenter();

    editor.createShape({
      type: "text",
      x: viewportCenter.x - 150,
      y: viewportCenter.y - 50,
      props: {
        text: label,
        w: 300,
      },
    });
  }, [artifact]);

  return (
    <div
      data-testid="canvas-pane"
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* ----------------------------------------------------------------
          Toolbar
      ---------------------------------------------------------------- */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background z-10 shrink-0">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMode("chat")}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Exit canvas mode"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Exit Canvas
          </button>
          <span className="text-muted-foreground">·</span>
          <span className="text-sm font-medium text-foreground">
            Atlas 5 Canvas
          </span>
          {surface.thread_id && (
            <span className="text-[10px] text-muted-foreground font-mono truncate max-w-[120px]">
              {surface.thread_id}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Add artifact card button */}
          {artifact && (
            <button
              type="button"
              onClick={addArtifactCard}
              data-testid="canvas-add-artifact"
              className="text-xs px-2.5 py-1.5 rounded border border-border text-foreground bg-muted/40 hover:bg-muted transition-colors"
            >
              + Add {artifact.agent} card
            </button>
          )}

          {/* Save button */}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            data-testid="canvas-save-button"
            className={`text-xs px-3 py-1.5 rounded font-medium transition-colors ${
              saveStatus === "saved"
                ? "bg-emerald-600 text-white"
                : saveStatus === "error"
                  ? "bg-red-600 text-white"
                  : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            }`}
          >
            {saving
              ? "Saving…"
              : saveStatus === "saved"
                ? "Saved ✓"
                : saveStatus === "error"
                  ? "Error"
                  : "Save"}
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------
          tldraw workspace
      ---------------------------------------------------------------- */}
      <div className="flex-1 relative" data-testid="tldraw-container">
        <Tldraw
          onMount={(editor) => {
            editorRef.current = editor;
          }}
        />
      </div>
    </div>
  );
}
