import { useCoAgent } from "@copilotkit/react-core";
import { AgentState, initialState } from "@/lib/types";
import { cn } from "@/lib/utils";
import { PinnedMetrics } from "@/components/dashboard/layout/metrics";
import { Charts } from "@/components/dashboard/layout/charts";
import { useChartActions, useSearchActions } from "@/components/chat/actions";
import { SurfaceSwitcher } from "@/components/dashboard/layout/surface-switcher";
import { DecisionSpineCard } from "@/components/dashboard/layout/decision-spine";
import { ArtifactPanel } from "@/components/dashboard/layout/artifact-panel";
import { TrustRail } from "@/components/dashboard/layout/trust-rail";

export function MainLayout({ className }: { className?: string }) {
  const { state, setState } = useCoAgent<AgentState>({
    name: "my_agent",
    initialState,
  });

  // Setup tool rendering and front-end tools
  useChartActions({ state, setState });
  useSearchActions();

  const artifact = state?.artifact_block;
  const spine = state?.decision_spine;
  const hasCharts = (state?.charts?.length ?? 0) > 0;

  return (
    <div
      className={cn("min-h-screen bg-background text-foreground", className)}
    >
      <div className="max-w-6xl mx-auto p-4 grid gap-4">
        {/* Atlas surface controls */}
        <SurfaceSwitcher state={state} setState={setState} />

        {/* Decision Spine */}
        {spine && <DecisionSpineCard spine={spine} />}

        {/* Artifact + Trust rail side by side */}
        {artifact && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <ArtifactPanel artifact={artifact} />
            </div>
            <div className="lg:col-span-1">
              <TrustRail artifact={artifact} />
            </div>
          </div>
        )}

        {/* Secondary: metrics */}
        <PinnedMetrics state={state} setState={setState} />

        {/* Secondary: charts (only shown when agent has populated them) */}
        {hasCharts && <Charts state={state} setState={setState} />}
      </div>
    </div>
  );
}
