"use client";

// DemoScenarioPicker — sticky strip above the canvas that lets the user
// switch between pre-baked fixtures. Uses real <a href> navigation rather
// than client routing so each scenario gets a fresh provider mount (which
// re-seeds chat + model cleanly without needing a reset action).

import * as React from "react";
import Link from "next/link";
import {
  DEMO_SCENARIO_ORDER,
  DEMO_SCENARIOS,
  type DemoScenario,
} from "@/data/demo-fixtures";
import { cn } from "@/lib/utils";
import { Compass, Microscope, Target, Info } from "lucide-react";

const GROUP_META: Record<DemoScenario["group"], { label: string; Icon: React.ElementType; tone: string }> = {
  explore: {
    label: "Explore",
    Icon: Compass,
    tone: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800",
  },
  analyse: {
    label: "Analyse",
    Icon: Microscope,
    tone: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800",
  },
  decide: {
    label: "Decide",
    Icon: Target,
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800",
  },
};

export function DemoScenarioPicker({
  activeScenarioId,
}: {
  activeScenarioId: string;
}) {
  const scenarios = DEMO_SCENARIO_ORDER.map((id) => DEMO_SCENARIOS[id]);

  return (
    <div className="border-b border-border bg-amber-50/40 dark:bg-amber-950/15 shrink-0">
      {/* Demo-mode banner */}
      <div className="flex items-center gap-2 px-5 py-2 text-xs text-amber-900 dark:text-amber-100">
        <Info className="w-3.5 h-3.5 shrink-0" />
        <span className="font-medium">Demo mode</span>
        <span className="text-amber-800/80 dark:text-amber-200/80">
          — pre-baked fixtures, no live corpus or agent. Switch scenarios to
          preview each block type.
        </span>
      </div>

      {/* Scenario chips */}
      <div className="px-5 pb-2.5 flex flex-wrap items-center gap-1.5">
        {scenarios.map((s) => {
          const meta = GROUP_META[s.group];
          const Icon = meta.Icon;
          const active = s.id === activeScenarioId;
          return (
            <Link
              key={s.id}
              href={`/workbench/demo?scenario=${s.id}`}
              prefetch={false}
              title={s.description ?? s.prompt}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[13px] transition-colors",
                active
                  ? "bg-foreground text-background border-foreground"
                  : cn(meta.tone, "hover:border-foreground/30"),
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="font-medium">{s.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
