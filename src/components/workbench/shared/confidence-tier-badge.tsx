import { cn } from "@/lib/utils";
import type { ConfidenceTier } from "@/lib/workbench/atlas-render-model";

const TIER: Record<ConfidenceTier, { dot: string; className: string }> = {
  Speculative: { dot: "bg-red-500",   className: "bg-red-50   text-red-700   border-red-200"   },
  Indicative:  { dot: "bg-amber-500", className: "bg-amber-50 text-amber-700 border-amber-200" },
  Supported:   { dot: "bg-blue-500",  className: "bg-blue-50  text-blue-700  border-blue-200"  },
  Robust:      { dot: "bg-green-500", className: "bg-green-50 text-green-700 border-green-200" },
};

export function ConfidenceTierBadge({
  tier,
  className,
  onClick,
}: {
  tier: ConfidenceTier;
  className?: string;
  onClick?: () => void;
}) {
  const cfg = TIER[tier];
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold",
        cfg.className,
        onClick && "cursor-pointer hover:opacity-80 transition-opacity",
        className,
      )}
    >
      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", cfg.dot)} />
      {tier}
    </Tag>
  );
}
