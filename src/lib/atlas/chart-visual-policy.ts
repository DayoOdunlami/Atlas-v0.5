import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import type { AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";

/** Product rule: hide decorative charts when the visual engine suppressed attach. */
export function shouldRenderCharts(
  spec: AnswerSpec | null,
  devMeta?: AtlasDevMeta | null,
): boolean {
  if (!spec) return false;
  if (devMeta?.visual_suppressed) return false;
  const hasCharts =
    Boolean(spec.chart?.option) || (spec.charts?.length ?? 0) > 0;
  return hasCharts;
}

export function chartsForRender(
  spec: AnswerSpec,
  devMeta?: AtlasDevMeta | null,
): NonNullable<AnswerSpec["charts"]> {
  if (!shouldRenderCharts(spec, devMeta)) return [];
  if (spec.charts?.length) return spec.charts;
  if (spec.chart?.option) return [spec.chart];
  return [];
}

export function chartSupportsVerdictLabel(chart: {
  story?: string;
  role?: string;
  title?: string;
}): string | null {
  if (chart.story?.trim()) return chart.story.trim();
  if (chart.role?.trim()) {
    return `Shows ${chart.role.replace(/_/g, " ")} evidence for this turn`;
  }
  if (chart.title?.trim()) return chart.title.trim();
  return null;
}
