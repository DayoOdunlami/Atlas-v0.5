"use client";

import type { InspectorEntry } from "@/lib/workbench/atlas-render-model";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const KIND_BADGE: Record<string, string> = {
  claim:        "bg-indigo-50 text-indigo-700 border-indigo-200",
  gap:          "bg-red-50    text-red-700    border-red-200",
  evidence_map: "bg-sky-50    text-sky-700    border-sky-200",
  confidence:   "bg-amber-50  text-amber-700  border-amber-200",
};

function FieldRow({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;
  const str = typeof value === "string" ? value : JSON.stringify(value);
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 border-b border-border last:border-0">
      <dt className="text-xs font-medium text-muted-foreground col-span-1 capitalize">
        {label.replace(/_/g, " ")}
      </dt>
      <dd className="text-xs text-foreground col-span-2 leading-relaxed break-words">{str}</dd>
    </div>
  );
}

interface Props {
  inspectorKey: string | null;
  inspectorIndex: Record<string, InspectorEntry>;
  onClose: () => void;
}

export function InspectorDrawer({ inspectorKey, inspectorIndex, onClose }: Props) {
  const entry = inspectorKey
    ? (inspectorIndex[inspectorKey] ?? inspectorIndex["confidence"])
    : null;

  return (
    <Sheet open={!!entry} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        {entry && (
          <>
            <SheetHeader>
              <div className="flex items-center gap-2 mb-1">
                <span
                  className={cn(
                    "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-medium capitalize",
                    KIND_BADGE[entry.kind] ?? "bg-slate-50 text-slate-600 border-slate-200",
                  )}
                >
                  {entry.kind.replace(/_/g, " ")}
                </span>
              </div>
              <SheetTitle className="text-sm font-semibold leading-snug">{entry.title}</SheetTitle>
            </SheetHeader>

            <div className="px-4 pb-4">
              <dl>
                {Object.entries(entry.content).map(([k, v]) => (
                  <FieldRow key={k} label={k} value={v} />
                ))}
              </dl>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
