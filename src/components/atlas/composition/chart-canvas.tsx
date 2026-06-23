"use client";

import { lazy, Suspense, useMemo } from "react";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

const ReactECharts = lazy(() => import("echarts-for-react"));

export function ChartCanvas({
  chart,
}: {
  chart: NonNullable<AnswerSpec["chart"]>;
}) {
  const option = useMemo(() => chart.option ?? {}, [chart.option]);

  if (chart.gate_status && chart.gate_status !== "pass") {
    return null;
  }

  return (
    <div
      data-testid="chart-canvas"
      data-chart-kind={chart.kind}
      className="mb-6 overflow-hidden rounded-lg border"
      style={{ borderColor: T.rule, background: "#FFFFFF" }}
    >
      <Suspense
        fallback={
          <div
            className="flex items-center justify-center text-xs"
            style={{ height: 240, color: T.inkFaint, fontFamily: atlasFont.mono }}
          >
            Loading chart…
          </div>
        }
      >
        <ReactECharts
          option={option}
          style={{ height: 260, width: "100%" }}
          opts={{ renderer: "canvas" }}
        />
      </Suspense>
      {chart.title ? (
        <p
          className="border-t px-3 py-2"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 9,
            color: T.inkFaint,
            borderColor: T.ruleSoft,
          }}
        >
          {chart.title} · corpus keys: {(chart.data_keys ?? []).join(", ") || "—"}
        </p>
      ) : null}
    </div>
  );
}
