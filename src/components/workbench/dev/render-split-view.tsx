"use client";

/**
 * RenderSplitView (Dev Tool — Phase 2 Gate)
 *
 * Side-by-side comparison: blocks layout (left) vs document/prose layout (right).
 * Only renders when process.env.NEXT_PUBLIC_ATLAS5_DEV_SPLIT_VIEW=true.
 *
 * Used by Dayo at Phase 2 gate to decide which render mode is more useful
 * for each outcome type before the cutover.
 */

interface RenderSplitViewProps {
  renderModel: Record<string, unknown> | null;
  className?: string;
}

const IS_DEV_SPLIT =
  process.env.NEXT_PUBLIC_ATLAS5_DEV_SPLIT_VIEW === "true" &&
  process.env.NODE_ENV !== "production";

export function RenderSplitView({ renderModel, className }: RenderSplitViewProps) {
  if (!IS_DEV_SPLIT || !renderModel) return null;

  const blocks = (renderModel.blocks as string[]) ?? [];
  const renderMode = (renderModel.render_mode as string) ?? "blocks";
  const headline = (renderModel.headline as string) ?? "";
  const insightCard = (renderModel.insight_card as string) ?? "";
  const tier = (renderModel.confidence_tier as string) ?? "Speculative";
  const citations = (renderModel.corpus_citations as Array<Record<string, string>>) ?? [];
  const gapSignals = (renderModel.gap_signals as Array<Record<string, string>>) ?? [];

  return (
    <div className={`border border-dashed border-purple-400 rounded-lg p-3 bg-purple-50/30 ${className ?? ""}`}>
      <div className="text-xs font-mono text-purple-600 mb-2 flex items-center gap-2">
        <span className="bg-purple-600 text-white px-1.5 py-0.5 rounded text-[10px]">DEV</span>
        Render Split View — {renderMode} mode | {tier} | {citations.length} citations
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Left: Blocks layout */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
            Blocks ({blocks.length})
          </h3>
          {blocks.length === 0 ? (
            <p className="text-xs text-gray-400 italic">No blocks selected</p>
          ) : (
            <ol className="list-decimal pl-4 space-y-1">
              {blocks.map((id) => (
                <li key={id} className="text-xs font-mono text-gray-700">{id}</li>
              ))}
            </ol>
          )}
        </div>

        {/* Right: Document layout */}
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-purple-700 uppercase tracking-wide">
            Document
          </h3>
          <p className="text-xs font-semibold text-gray-800">{headline}</p>
          <p className="text-xs text-gray-600">{insightCard}</p>
          {citations.length > 0 && (
            <div className="text-xs text-gray-500">
              <span className="font-medium">Citations: </span>
              {citations.slice(0, 3).map((c) => c.title ?? c.id).join(", ")}
              {citations.length > 3 && ` +${citations.length - 3} more`}
            </div>
          )}
        </div>
      </div>

      {/* Gap signals */}
      {gapSignals.length > 0 && (
        <div className="mt-3 pt-2 border-t border-purple-200">
          <h3 className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-1">
            Gap Signals ({gapSignals.length})
          </h3>
          <ul className="space-y-1">
            {gapSignals.map((s, i) => (
              <li key={i} className={`text-xs rounded px-2 py-1 ${
                s.severity === "critical" ? "bg-red-100 text-red-800" :
                s.severity === "warn" ? "bg-amber-100 text-amber-800" :
                "bg-gray-100 text-gray-600"
              }`}>
                <span className="font-mono">[{s.signal_type}]</span> {s.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
