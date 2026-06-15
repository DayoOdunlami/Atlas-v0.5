"use client";

/**
 * /lab/orchestrator — Phase 3.5 gate page.
 *
 * One run → blocks canvas + dev split-view.
 * Requires NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1=true and Python agents on :8000.
 */

import { WorkbenchProvider } from "@/lib/workbench/workbench-context";
import { WorkbenchAgentBridge } from "@/components/workbench/workbench-agent-bridge";
import { OrchestratorChatPanel } from "@/components/workbench/orchestrator-chat-panel";
import { ArtifactCanvas } from "@/components/workbench/artifact-canvas";
import { useWorkbench } from "@/lib/workbench/workbench-context";

function OrchestratorLabInner() {
  const { model } = useWorkbench();

  return (
    <div className="flex h-screen overflow-hidden">
      <div className="w-[380px] shrink-0 border-r border-border h-full">
        <OrchestratorChatPanel />
      </div>
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <ArtifactCanvas />
      </div>
      <aside className="w-[300px] shrink-0 border-l border-border p-3 overflow-y-auto text-xs font-mono bg-muted/30">
        <p className="font-semibold mb-2 text-foreground">Canvas blocks</p>
        <pre className="whitespace-pre-wrap break-all text-[10px]">
          {JSON.stringify(
            model.blocks.map((b) => ({
              id: b.id,
              type: b.type,
              headline: b.headline,
            })),
            null,
            2,
          )}
        </pre>
      </aside>
    </div>
  );
}

export default function OrchestratorLabPage() {
  return (
    <WorkbenchProvider initialCqId="cq.match.workbench">
      <WorkbenchAgentBridge>
        <OrchestratorLabInner />
      </WorkbenchAgentBridge>
    </WorkbenchProvider>
  );
}
