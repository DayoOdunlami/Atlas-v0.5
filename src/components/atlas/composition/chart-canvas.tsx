"use client";

import { lazy, Suspense, useCallback, useMemo } from "react";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { provIdForChartKey } from "@/lib/atlas/chart-provenance";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

const ReactECharts = lazy(() => import("echarts-for-react"));

const LANE_COLOR: Record<string, string> = {
  corpus: T.corpus,
  web: T.web,
  declared: T.declared,
};

export function ChartCanvas({
  chart,
  provenance,
  onProv,
}: {
  chart: NonNullable<AnswerSpec["chart"]>;
  provenance?: AnswerSpec["provenance"];
  onProv?: (id: string) => void;
}) {
  const option = useMemo(() => chart.option ?? {}, [chart.option]);

  const handleChartClick = useCallback(
    (params: { componentType?: string; name?: string; seriesName?: string }) => {
      if (!onProv || !provenance) return;
      const keys = chart.data_keys ?? [];
      const provMap = provenance as Record<string, unknown>;
      for (const key of keys) {
        const provId = provIdForChartKey(key, provMap);
        if (provId) {
          onProv(provId);
          return;
        }
      }
      if (provMap["stat-corpus"]) onProv("stat-corpus");
    },
    [chart.data_keys, onProv, provenance],
  );

  const onEvents = useMemo(
    () =>
      onProv
        ? {
            click: handleChartClick,
          }
        : undefined,
    [handleChartClick, onProv],
  );

  if (chart.gate_status && chart.gate_status !== "pass") {
    return null;
  }

  const lanes = chart.series_lanes?.length
    ? chart.series_lanes
    : chart.lead_lane
      ? [chart.lead_lane]
      : [];

  return (
    <div
      data-testid="chart-canvas"
      data-chart-kind={chart.kind}
      data-lead-lane={chart.lead_lane ?? undefined}
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
          onEvents={onEvents}
        />
      </Suspense>
      {chart.story ? (
        <p
          className="border-t px-3 py-1.5"
          style={{
            fontFamily: atlasFont.sans,
            fontSize: 11,
            color: T.inkSoft,
            borderColor: T.ruleSoft,
          }}
        >
          {chart.story}
        </p>
      ) : null}
      {lanes.length > 0 ? (
        <div
          className="flex flex-wrap gap-2 border-t px-3 py-2"
          style={{ borderColor: T.ruleSoft, fontFamily: atlasFont.mono, fontSize: 9 }}
        >
          {lanes.map((lane, i) => (
            <span key={`${lane}-${i}`} style={{ color: LANE_COLOR[lane] ?? T.inkFaint }}>
              {lane}
              {chart.validation_statuses?.[i]
                ? ` · ${chart.validation_statuses[i]}`
                : ""}
            </span>
          ))}
          {chart.lead_lane ? (
            <span style={{ color: T.inkFaint }}>lead: {chart.lead_lane}</span>
          ) : null}
        </div>
      ) : null}
      {chart.reconciliation_note ? (
        <p
          className="border-t px-3 py-1.5 italic"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 9,
            color: T.gap,
            borderColor: T.ruleSoft,
          }}
        >
          {chart.reconciliation_note}
        </p>
      ) : null}
      {chart.title ? (
        <div
          className="flex flex-wrap items-center gap-2 border-t px-3 py-2"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 9,
            color: T.inkFaint,
            borderColor: T.ruleSoft,
          }}
        >
          <span>{chart.title}</span>
          <span>· keys:</span>
          {(chart.data_keys ?? []).length ? (
            (chart.data_keys ?? []).map((key) => {
              const provId =
                provenance && onProv
                  ? provIdForChartKey(key, provenance as Record<string, unknown>)
                  : null;
              return provId && onProv ? (
                <button
                  key={key}
                  type="button"
                  data-testid={`chart-prov-${key}`}
                  onClick={() => onProv(provId)}
                  style={{
                    border: "none",
                    background: "none",
                    cursor: "pointer",
                    color: T.corpus,
                    textDecoration: "underline",
                    fontFamily: atlasFont.mono,
                    fontSize: 9,
                    padding: 0,
                  }}
                >
                  {key}
                </button>
              ) : (
                <span key={key}>{key}</span>
              );
            })
          ) : (
            <span>—</span>
          )}
        </div>
      ) : null}
    </div>
  );
}
