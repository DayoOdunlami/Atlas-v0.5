"use client";

import { useWorkbench } from "@/lib/workbench/workbench-context";
import { ArtifactCanvas } from "../artifact-canvas";
import { InspectorDrawer } from "../inspector-drawer";
import { SnapshotPreview } from "../snapshot-preview";
import { PatchConfirmationPanel } from "../patch-confirmation-panel";
import { DemoChatPanel } from "./demo-chat-panel";
import {
  MobileChatTrigger,
  SurfaceSplitPanels,
} from "@/components/layout/surface-split-panels";

export function DemoShell() {
  const { model, inspectorKey, closeInspector, snapshotOpen, setSnapshotOpen } =
    useWorkbench();

  return (
    <div className="relative flex h-full overflow-hidden">
      <SurfaceSplitPanels
        defaultChatSize={30}
        chatPanel={<DemoChatPanel />}
        canvasPanel={<ArtifactCanvas />}
        mobileChatTitle="Demo chat"
        className="min-w-0 flex-1"
      />

      <MobileChatTrigger label="Demo chat" />

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
