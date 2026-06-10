import { cn } from "@/lib/utils";
import type { EvidenceState } from "@/lib/workbench/atlas-render-model";

const STATE: Record<EvidenceState, { label: string; className: string }> = {
  verified:        { label: "verified",       className: "bg-green-50  text-green-700  border-green-200"  },
  "self-reported": { label: "self-reported",  className: "bg-amber-50  text-amber-700  border-amber-200"  },
  inferred:        { label: "inferred",       className: "bg-sky-50    text-sky-700    border-sky-200"    },
  unknown:         { label: "unknown",        className: "bg-slate-100 text-slate-500  border-slate-200"  },
  contested:       { label: "contested",      className: "bg-red-50    text-red-700    border-red-200"    },
};

export function EvidenceStateBadge({
  state,
  className,
}: {
  state: EvidenceState;
  className?: string;
}) {
  const cfg = STATE[state] ?? STATE.unknown;
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium whitespace-nowrap",
        cfg.className,
        className,
      )}
    >
      {cfg.label}
    </span>
  );
}
