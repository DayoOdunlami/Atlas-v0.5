"use client";

import { useRef, useState, useCallback } from "react";
import { CopilotKitCSSProperties } from "@copilotkit/react-ui";
import { LabChat } from "@/components/lab/lab-chat";
import { MobileChat } from "@/components/chat/mobile-chat";
import { MainLayout } from "@/components/dashboard/dashboard";
import { useIsMobile } from "@/lib/isMobile";
import type { PanelId } from "@/components/lab/chat-panels/panel-switcher";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import {
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

const ALL_PANELS: PanelId[] = ["A", "B", "C", "D"];

// ---------------------------------------------------------------------------
// Collapse handle for the artifact divider
// ---------------------------------------------------------------------------

function ArtifactHandle({
  onToggle,
  collapsed,
}: {
  onToggle: () => void;
  collapsed: boolean;
}) {
  const Icon = collapsed ? PanelRightOpen : PanelRightClose;
  return (
    <PanelResizeHandle className="group relative flex w-px items-center justify-center bg-border transition-colors hover:bg-border/80 data-[resize-handle-active]:bg-primary/30">
      <button
        onClick={onToggle}
        className="absolute z-10 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm opacity-0 transition-opacity group-hover:opacity-100 hover:text-foreground"
        title={collapsed ? "Show artifact" : "Hide artifact"}
      >
        <Icon className="size-3" />
      </button>
    </PanelResizeHandle>
  );
}

export default function CopilotKitLabPage() {
  const isMobile = useIsMobile();
  const artifactRef = useRef<ImperativePanelHandle>(null);
  const [artifactCollapsed, setArtifactCollapsed] = useState(false);

  // Any combination of panels can be active. Default: D only (Atlas Custom with CoT).
  const [selectedPanels, setSelectedPanels] = useState<Set<PanelId>>(
    new Set(["D"])
  );

  const handleToggle = (id: PanelId) => {
    setSelectedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => setSelectedPanels(new Set(ALL_PANELS));

  const toggleArtifact = useCallback(() => {
    const panel = artifactRef.current;
    if (!panel) return;
    if (panel.isCollapsed()) panel.expand(); else panel.collapse();
  }, []);

  return (
    <main
      style={
        { "--copilot-kit-primary-color": "#6366f1" } as CopilotKitCSSProperties
      }
      className="h-screen overflow-hidden bg-background text-foreground antialiased flex flex-col"
    >
      <div className="shrink-0 flex items-center border-b bg-muted/30 px-3 py-1 text-[11px] text-muted-foreground">
        <span>CopilotKit lab — primary shell: <a href="/" className="underline hover:text-foreground">assistant-ui /</a></span>
      </div>
      <div className="min-h-0 flex-1">
      {isMobile ? (
        <MobileChat />
      ) : (
        <PanelGroup direction="horizontal" className="h-full">
          {/* Col 1: chat — narrower; artifact is primary workspace (Bloomberg/OpenBB pattern) */}
          <Panel minSize={28} defaultSize={38} className="min-w-0 min-h-0">
            <LabChat
              className="h-full"
              selectedPanels={selectedPanels}
              onToggle={handleToggle}
              onSelectAll={handleSelectAll}
            />
          </Panel>

          <ArtifactHandle
            onToggle={toggleArtifact}
            collapsed={artifactCollapsed}
          />

          {/* Col 2: artifact / dashboard — primary analysis surface (~62%) */}
          <Panel
            ref={artifactRef}
            defaultSize={62}
            minSize={32}
            collapsible
            collapsedSize={0}
            onCollapse={() => setArtifactCollapsed(true)}
            onExpand={() => setArtifactCollapsed(false)}
            className="border-l overflow-hidden"
          >
            <MainLayout className="h-full" />
          </Panel>
        </PanelGroup>
      )}
      </div>
    </main>
  );
}
