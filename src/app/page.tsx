"use client";

import { useState } from "react";
import { CopilotKitCSSProperties } from "@copilotkit/react-ui";
import { LabChat } from "@/components/lab/lab-chat";
import { MobileChat } from "@/components/chat/mobile-chat";
import { MainLayout } from "@/components/dashboard/dashboard";
import { useIsMobile } from "@/lib/isMobile";
import type { PanelId } from "@/components/lab/chat-panels/panel-switcher";

const ALL_PANELS: PanelId[] = ["A", "B", "C", "D"];

export default function CopilotKitPage() {
  const isMobile = useIsMobile();

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

  // Chat area grows with panel count; artifact stays at flex-[2].
  const panelFlex = selectedPanels.size;

  return (
    <main
      style={
        { "--copilot-kit-primary-color": "#6366f1" } as CopilotKitCSSProperties
      }
      className="h-screen overflow-hidden bg-background text-foreground antialiased flex flex-row"
    >
      {isMobile ? (
        <MobileChat />
      ) : (
        <LabChat
          className="min-h-0"
          style={{ flex: panelFlex }}
          selectedPanels={selectedPanels}
          onToggle={handleToggle}
          onSelectAll={handleSelectAll}
        />
      )}

      {/* Artifact / dashboard pane — always visible, takes flex-2 */}
      <div
        className="overflow-y-auto max-h-screen border-l"
        style={{ flex: 2, minWidth: 380 }}
      >
        <MainLayout className="w-full" />
      </div>
    </main>
  );
}
