"use client";

/**
 * /lab/shell — Polished production chat shell (safe test route).
 *
 * One clean view: agent tabs + model selector + CoT + citations.
 * Shares the CopilotKit provider from the root layout — no extra wiring.
 * Artifact panel (MainLayout) on the right, identical to /lab/chat-test.
 *
 * Once validated here, this shell replaces src/app/page.tsx.
 */

import { CopilotKitCSSProperties } from "@copilotkit/react-ui";
import { ShellChat } from "@/components/lab/shell/shell-chat";
import { MobileChat } from "@/components/chat/mobile-chat";
import { MainLayout } from "@/components/dashboard/dashboard";
import { useIsMobile } from "@/lib/isMobile";

export default function ShellPage() {
  const isMobile = useIsMobile();

  return (
    <main
      style={{ "--copilot-kit-primary-color": "#6366f1" } as CopilotKitCSSProperties}
      className="h-screen overflow-hidden bg-background text-foreground antialiased flex flex-row"
    >
      {isMobile ? (
        <MobileChat />
      ) : (
        <div className="flex flex-col min-h-0 overflow-hidden" style={{ flex: 1, minWidth: 320 }}>
          <ShellChat />
        </div>
      )}

      {/* Artifact + dashboard pane — always visible */}
      <div
        className="overflow-y-auto max-h-screen border-l shrink-0"
        style={{ flex: 2, minWidth: 380 }}
      >
        <MainLayout className="w-full" />
      </div>
    </main>
  );
}
