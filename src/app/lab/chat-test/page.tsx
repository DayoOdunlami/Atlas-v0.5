"use client";

/**
 * /lab/chat-test — Chat Panel Bake-off
 *
 * Panels A/B/C/D are individually toggleable. Any combination shows them
 * side-by-side at full height. The artifact pane (MainLayout) is always visible
 * on the right. The original /app/page.tsx is never touched.
 */

import { useState } from "react";
import { CopilotKitCSSProperties } from "@copilotkit/react-ui";
import { LabChat } from "@/components/lab/lab-chat";
import { MobileChat } from "@/components/chat/mobile-chat";
import { MainLayout } from "@/components/dashboard/dashboard";
import { useIsMobile } from "@/lib/isMobile";
import type { PanelId } from "@/components/lab/chat-panels/panel-switcher";

const ALL_PANELS: PanelId[] = ["A", "B", "C", "D"];

export default function ChatTestPage() {
  const isMobile = useIsMobile();

  // Any combination of panels can be active. Default: A only (identical to /atlas5).
  const [selectedPanels, setSelectedPanels] = useState<Set<PanelId>>(
    new Set(["A"])
  );

  const handleToggle = (id: PanelId) => {
    setSelectedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        // Keep at least one panel active
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () =>
    setSelectedPanels(new Set(ALL_PANELS));

  // Panels area grows proportionally with panel count; artifact stays at flex-[2].
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

      {/* Artifact pane — always visible, takes flex-2 */}
      <div
        className="overflow-y-auto max-h-screen border-l"
        style={{ flex: 2, minWidth: 380 }}
      >
        <MainLayout className="w-full" />
      </div>
    </main>
  );
}
