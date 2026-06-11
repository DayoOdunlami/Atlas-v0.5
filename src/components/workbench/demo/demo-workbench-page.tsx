"use client";

// DemoWorkbenchPage — mirror of AtlasWorkbenchPage minus the agent bridge.
//
// Architecture diff vs the live page:
//   AtlasWorkbenchPage         DemoWorkbenchPage
//   ──────────────────         ─────────────────
//   WorkbenchProvider          WorkbenchProvider (initialModel + initialMessages)
//     → AgentBridge            (no agent bridge — LangGraph is not contacted)
//       → RuntimeProvider      (no runtime provider)
//         → AtlasShell         → DemoShell  (DemoChatPanel + ArtifactCanvas)

import { WorkbenchProvider } from "@/lib/workbench/workbench-context";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { WorkbenchSidebar } from "@/components/workbench/app-sidebar";
import { WorkbenchHeader } from "@/components/workbench/site-header";
import { Toaster } from "@/components/ui/ui/sonner";
import { DemoShell } from "./demo-shell";
import { DemoScenarioPicker } from "./demo-scenario-picker";
import { getDemoScenario } from "@/data/demo-fixtures";

export interface DemoWorkbenchPageProps {
  scenarioId: string;
}

export function DemoWorkbenchPage({ scenarioId }: DemoWorkbenchPageProps) {
  const scenario = getDemoScenario(scenarioId);

  return (
    <WorkbenchProvider
      initialMatchId={null}
      initialCqId="cq.match.workbench"
      initialModel={scenario.model}
      initialMessages={scenario.messages}
      initialRoute={scenario.lastRoute ?? null}
      initialCitations={scenario.lastCitations ?? []}
      demoMode
    >
      <SidebarProvider defaultOpen={false}>
        <WorkbenchSidebar />
        <SidebarInset className="overflow-hidden flex flex-col h-svh">
          <WorkbenchHeader />
          <DemoScenarioPicker activeScenarioId={scenarioId} />
          <div className="flex-1 min-h-0 overflow-hidden">
            <DemoShell />
          </div>
        </SidebarInset>
      </SidebarProvider>
      <Toaster position="bottom-right" richColors closeButton />
    </WorkbenchProvider>
  );
}
