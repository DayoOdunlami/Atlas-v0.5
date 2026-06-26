"use client";

import { useWorkbench } from "@/lib/workbench/workbench-context";
import { ChatPanel } from "./chat-panel";
import { OrchestratorChatPanel } from "./orchestrator-chat-panel";
import { ArtifactCanvas } from "./artifact-canvas";
import { HomeCanvas } from "./home-canvas";
import { InspectorDrawer } from "./inspector-drawer";
import { SnapshotPreview } from "./snapshot-preview";
import { PatchConfirmationPanel } from "./patch-confirmation-panel";
import {
  MobileChatTrigger,
  SurfaceSplitPanels,
} from "@/components/layout/surface-split-panels";

const ORCHESTRATOR_V1 =
  process.env.NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1 === "true";

export function AtlasShell() {
  const { model, cqId, inspectorKey, closeInspector, snapshotOpen, setSnapshotOpen } =
    useWorkbench();
  const isHome = cqId === "cq.home";

  const chatPanel = ORCHESTRATOR_V1 ? (
    <OrchestratorChatPanel />
  ) : (
    <ChatPanel />
  );

  return (
    <div className="relative flex h-full overflow-hidden">
      <SurfaceSplitPanels
        chatPanel={chatPanel}
        canvasPanel={isHome ? <HomeCanvas /> : <ArtifactCanvas />}
        mobileChatTitle="Atlas Copilot"
        className="min-w-0 flex-1"
      />

      <MobileChatTrigger label="Copilot" />

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
