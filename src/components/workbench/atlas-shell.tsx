"use client";

import { useWorkbench } from "@/lib/workbench/workbench-context";
import { ChatPanel } from "./chat-panel";
import { ArtifactCanvas } from "./artifact-canvas";
import { InspectorDrawer } from "./inspector-drawer";
import { SnapshotPreview } from "./snapshot-preview";

export function AtlasShell() {
  const { model, inspectorKey, closeInspector, snapshotOpen, setSnapshotOpen } = useWorkbench();

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat panel — fixed width, static */}
      <div className="hidden lg:flex flex-col w-72 shrink-0 h-full">
        <ChatPanel />
      </div>

      {/* Main artifact canvas */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        <ArtifactCanvas />
      </div>

      {/* Inspector drawer — shadcn Sheet, right side */}
      <InspectorDrawer
        inspectorKey={inspectorKey}
        inspectorIndex={model.inspector_index}
        onClose={closeInspector}
      />

      {/* Snapshot preview modal */}
      <SnapshotPreview
        open={snapshotOpen}
        onClose={() => setSnapshotOpen(false)}
        model={model}
      />
    </div>
  );
}
