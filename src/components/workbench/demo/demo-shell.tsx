"use client";

// DemoShell — same 3-column shape as AtlasShell but uses DemoChatPanel
// (no LangGraph runtime). Keeps all other surfaces (canvas, inspector,
// snapshot, patch panel) so visual parity with live mode holds.

import { useWorkbench } from "@/lib/workbench/workbench-context";
import { ArtifactCanvas } from "../artifact-canvas";
import { InspectorDrawer } from "../inspector-drawer";
import { SnapshotPreview } from "../snapshot-preview";
import { PatchConfirmationPanel } from "../patch-confirmation-panel";
import { DemoChatPanel } from "./demo-chat-panel";

export function DemoShell() {
  const { model, inspectorKey, closeInspector, snapshotOpen, setSnapshotOpen } =
    useWorkbench();

  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat panel — slightly wider than live mode so canned transcripts breathe */}
      <div className="hidden lg:flex flex-col w-[380px] xl:w-[420px] 2xl:w-[460px] shrink-0 h-full max-w-[32vw]">
        <DemoChatPanel />
      </div>

      {/* Main canvas — gets all remaining real estate */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        <ArtifactCanvas />
      </div>

      <InspectorDrawer
        inspectorKey={inspectorKey}
        inspectorIndex={model.inspector_index}
        onClose={closeInspector}
      />

      <SnapshotPreview
        open={snapshotOpen}
        onClose={() => setSnapshotOpen(false)}
        model={model}
      />

      <PatchConfirmationPanel />
    </div>
  );
}
