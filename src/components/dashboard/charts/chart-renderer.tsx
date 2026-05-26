import { useMemo } from "react";
import {
  ResponsiveContainer,
  LineChart as RLineChart,
  Line,
  AreaChart as RAreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  BarChart as RBarChart,
  Bar,
  PieChart as RPieChart,
  Pie,
  Cell,
  ScatterChart as RScatterChart,
  Scatter,
  RadialBarChart as RRadialBarChart,
  RadialBar,
  Legend,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type {
  ChartSpec,
  LineChartSpec,
  BarChartSpec,
  AreaChartSpec,
  PieChartSpec,
  ScatterChartSpec,
  RadialBarChartSpec,
  StackedBarChartSpec,
  ChartDataRecord,
} from "@/lib/types";

function safeVar(name: string) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
}

const chartColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface ChartRendererProps {
  spec: ChartSpec;
  data: ChartDataRecord[];
}

export function ChartRenderer({ spec, data }: ChartRendererProps) {
  switch (spec.type) {
    case "line":
      return <LineChart spec={spec} data={data} />;
    case "area":
      return <AreaChart spec={spec} data={data} />;
    case "bar":
      return <BarChart spec={spec} data={data} />;
    case "pie":
      return <PieChart spec={spec} data={data} />;
    case "scatter":
      return <ScatterPlot spec={spec} data={data} />;
    case "radial-bar":
      return <RadialBarChart spec={spec} data={data} />;
    case "stacked-bar":
      return <StackedBarChart spec={spec} data={data} />;
    default:
      return (
        <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
          Unknown chart type
        </div>
      );
  }
}

// ── Line ─────────────────────────────────────────────────────────────────────

function LineChart({ spec, data }: { spec: LineChartSpec; data: ChartDataRecord[] }) {
  const config: ChartConfig = useMemo(
    () => ({ [spec.y]: { label: spec.y, color: "var(--chart-1)" } }),
    [spec.y],
  );
  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RLineChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={spec.x} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Line
            type="monotone"
            dataKey={spec.y}
            stroke={`var(--color-${safeVar(spec.y)})`}
            strokeWidth={2}
            dot={false}
          />
        </RLineChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// ── Area ─────────────────────────────────────────────────────────────────────

function AreaChart({ spec, data }: { spec: AreaChartSpec; data: ChartDataRecord[] }) {
  const config: ChartConfig = useMemo(
    () => ({ [spec.y]: { label: spec.y, color: "var(--chart-1)" } }),
    [spec.y],
  );
  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RAreaChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={spec.x} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Area
            type="monotone"
            dataKey={spec.y}
            stroke={`var(--color-${safeVar(spec.y)})`}
            fill={`var(--color-${safeVar(spec.y)})`}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RAreaChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// ── Bar ──────────────────────────────────────────────────────────────────────

function BarChart({ spec, data }: { spec: BarChartSpec; data: ChartDataRecord[] }) {
  const config: ChartConfig = useMemo(
    () => ({ [spec.y]: { label: spec.y, color: "var(--chart-2)" } }),
    [spec.y],
  );
  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart data={data} margin={{ top: 10, right: 12, bottom: 0, left: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={spec.x} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar dataKey={spec.y} radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
            ))}
          </Bar>
        </RBarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// ── Pie ──────────────────────────────────────────────────────────────────────

function PieChart({ spec, data }: { spec: PieChartSpec; data: ChartDataRecord[] }) {
  const categories = data.map((s) => String(s[spec.x ?? "category"]));
  const config: ChartConfig = useMemo(
    () =>
      Object.fromEntries(
        categories.map((cat, i) => [
          cat,
          { label: cat, color: chartColors[i % chartColors.length] },
        ]),
      ) as ChartConfig,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, spec.x],
  );
  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RPieChart>
          <ChartTooltip content={<ChartTooltipContent />} />
          <Pie
            data={data}
            dataKey={spec.y ?? "value"}
            nameKey={spec.x ?? "category"}
            innerRadius="20%"
            outerRadius="80%"
            paddingAngle={2}
            labelLine={false}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={chartColors[i % chartColors.length]} />
            ))}
          </Pie>
        </RPieChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// ── Scatter ──────────────────────────────────────────────────────────────────

function ScatterPlot({ spec, data }: { spec: ScatterChartSpec; data: ChartDataRecord[] }) {
  const config: ChartConfig = useMemo(
    () => ({ scatter: { label: spec.title, color: "var(--chart-3)" } }),
    [spec.title],
  );
  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RScatterChart margin={{ top: 10, right: 12, bottom: 0, left: 12 }}>
          <CartesianGrid />
          <XAxis dataKey={spec.x} name={spec.x} tickLine={false} axisLine={false} />
          <YAxis dataKey={spec.y} name={spec.y} tickLine={false} axisLine={false} />
          <ChartTooltip cursor={{ strokeDasharray: "3 3" }} content={<ChartTooltipContent />} />
          <Scatter data={data} fill="var(--chart-3)" fillOpacity={0.7} />
        </RScatterChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// ── Radial bar ───────────────────────────────────────────────────────────────

function RadialBarChart({ spec, data }: { spec: RadialBarChartSpec; data: ChartDataRecord[] }) {
  const enriched = data.map((d, i) => ({
    ...d,
    fill: chartColors[i % chartColors.length],
  }));
  // Build a config so ChartContainer context is available for ChartTooltipContent
  const config: ChartConfig = useMemo(
    () =>
      Object.fromEntries(
        data.map((d, i) => [
          String(d[spec.x] ?? i),
          { label: String(d[spec.x] ?? i), color: chartColors[i % chartColors.length] },
        ]),
      ) as ChartConfig,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, spec.x],
  );
  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RRadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="20%"
          outerRadius="90%"
          data={enriched}
          barSize={16}
        >
          <RadialBar dataKey={spec.y} cornerRadius={4} background />
          <Legend
            iconSize={10}
            formatter={(_value, entry) =>
              String((entry.payload as ChartDataRecord)?.[spec.x] ?? "")
            }
          />
          <ChartTooltip content={<ChartTooltipContent />} />
        </RRadialBarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}

// ── Stacked bar ──────────────────────────────────────────────────────────────
// Expects flat rows: { [x]: string, [series]: string, [y]: number }
// Pivots client-side to grouped stacks.

function StackedBarChart({ spec, data }: { spec: StackedBarChartSpec; data: ChartDataRecord[] }) {
  const seriesValues = useMemo(
    () => Array.from(new Set(data.map((d) => String(d[spec.series] ?? "other")))),
    [data, spec.series],
  );

  const pivoted = useMemo(() => {
    const map = new Map<string, Record<string, string | number>>();
    for (const row of data) {
      const xVal = String(row[spec.x] ?? "?");
      const sVal = String(row[spec.series] ?? "other");
      const yVal = Number(row[spec.y] ?? 0);
      if (!map.has(xVal)) map.set(xVal, { [spec.x]: xVal });
      const entry = map.get(xVal)!;
      entry[sVal] = ((entry[sVal] as number) ?? 0) + yVal;
    }
    // Sort by total descending
    return Array.from(map.values()).sort(
      (a, b) =>
        seriesValues.reduce((s, sv) => s + Number(b[sv] ?? 0), 0) -
        seriesValues.reduce((s, sv) => s + Number(a[sv] ?? 0), 0),
    );
  }, [data, spec.x, spec.series, spec.y, seriesValues]);

  const config: ChartConfig = useMemo(
    () =>
      Object.fromEntries(
        seriesValues.map((sv, i) => [
          sv,
          { label: sv, color: chartColors[i % chartColors.length] },
        ]),
      ) as ChartConfig,
    [seriesValues],
  );

  return (
    <ChartContainer config={config} className="aspect-auto h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RBarChart data={pivoted} margin={{ top: 10, right: 12, bottom: 0, left: 12 }}>
          <CartesianGrid vertical={false} />
          <XAxis dataKey={spec.x} tickLine={false} axisLine={false} tickMargin={8} />
          <YAxis tickLine={false} axisLine={false} tickMargin={8} />
          <ChartTooltip content={<ChartTooltipContent />} />
          <ChartLegend content={<ChartLegendContent />} />
          {seriesValues.map((sv, i) => (
            <Bar
              key={sv}
              dataKey={sv}
              stackId="a"
              fill={chartColors[i % chartColors.length]}
              radius={i === seriesValues.length - 1 ? [4, 4, 0, 0] : [0, 0, 0, 0]}
            />
          ))}
        </RBarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );
}
