"use client";

/**
 * /lab/legacy-workbench — D4.5 side-by-side diff route.
 *
 * Always uses the legacy assistant-ui → LangGraph :2024 path regardless of
 * NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1.
 */

import { WorkbenchProvider } from "@/lib/workbench/workbench-context";
import { WorkbenchAgentBridge } from "@/components/workbench/workbench-agent-bridge";
import { AtlasShell } from "@/components/workbench/atlas-shell";
import {
  SidebarProvider,
  SidebarInset,
} from "@/components/ui/sidebar";
import { WorkbenchSidebar } from "@/components/workbench/app-sidebar";
import { WorkbenchHeader } from "@/components/workbench/site-header";
import { Toaster } from "@/components/ui/ui/sonner";

export default function LegacyWorkbenchLabPage() {
  return (
    <WorkbenchProvider initialCqId="cq.match.workbench">
      <WorkbenchAgentBridge forceLegacy>
        <SidebarProvider defaultOpen={false}>
          <WorkbenchSidebar />
          <SidebarInset className="overflow-hidden flex flex-col h-svh">
            <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-xs text-amber-800">
              Legacy workbench graph (pre-ADR-0001) — for diff comparison only
            </div>
            <WorkbenchHeader />
            <div className="flex-1 min-h-0 overflow-hidden">
              <AtlasShell />
            </div>
          </SidebarInset>
        </SidebarProvider>
        <Toaster position="bottom-right" richColors closeButton />
      </WorkbenchAgentBridge>
    </WorkbenchProvider>
  );
}
