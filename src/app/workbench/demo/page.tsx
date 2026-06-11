// /workbench/demo — Atlas Workbench DEMO mode (no LangGraph, no Supabase)
//
// Purpose: showcase every block type using pre-baked fixtures so the UI can
// be evaluated and shared without a live corpus connection.
//
// URL param:
//   ?scenario=<id>   — one of DEMO_SCENARIO_ORDER
//                      (falls back to DEFAULT_DEMO_SCENARIO_ID)
//
// Differences from the live workbench page:
//   - No WorkbenchAgentBridge (LangGraph is not contacted)
//   - DemoChatPanel renders the canned transcript instead of ThreadPrimitive
//   - DemoScenarioPicker bar lives above the canvas for quick switching
//   - WorkbenchProvider receives the fixture as initialModel + initialMessages

import { DemoWorkbenchPage } from "@/components/workbench/demo/demo-workbench-page";
import {
  DEMO_SCENARIO_ORDER,
  DEFAULT_DEMO_SCENARIO_ID,
} from "@/data/demo-fixtures";

export const metadata = {
  title: "Atlas Workbench — Demo",
};

interface DemoPageProps {
  searchParams: Promise<{
    scenario?: string;
  }>;
}

export default async function DemoRoute({ searchParams }: DemoPageProps) {
  const params = await searchParams;
  const scenarioId =
    params.scenario && DEMO_SCENARIO_ORDER.includes(params.scenario)
      ? params.scenario
      : DEFAULT_DEMO_SCENARIO_ID;

  return <DemoWorkbenchPage scenarioId={scenarioId} />;
}
