"use client";

import { useWorkbench } from "@/lib/workbench/workbench-context";
import { ChatPanel } from "./chat-panel";
import { ArtifactCanvas } from "./artifact-canvas";
import { HomeCanvas } from "./home-canvas";
import { InspectorDrawer } from "./inspector-drawer";
import { SnapshotPreview } from "./snapshot-preview";
import { PatchConfirmationPanel } from "./patch-confirmation-panel";

export function AtlasShell() {
  const { model, cqId, inspectorKey, closeInspector, snapshotOpen, setSnapshotOpen } =
    useWorkbench();
  const isHome = cqId === "cq.home";

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat panel — narrow but readable; clamps so the canvas keeps the spotlight */}
      <div className="hidden lg:flex flex-col w-[320px] xl:w-[360px] shrink-0 h-full max-w-[28vw]">
        <ChatPanel />
      </div>

      {/* Main canvas — gets all remaining real estate */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        {isHome ? <HomeCanvas /> : <ArtifactCanvas />}
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

      {/* Patch confirmation panel (M0.9) — bottom Sheet, shown when agent proposes */}
      <PatchConfirmationPanel />
    </div>
  );
}
