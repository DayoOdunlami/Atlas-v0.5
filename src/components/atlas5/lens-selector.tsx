/**
 * Atlas 5 — Lens Selector
 *
 * Dropdown that switches between the five analytical lenses.
 * Each option carries data-lens="<id>" for Playwright assertions.
 */
"use client";

import { useSurfaceGateway } from "@/lib/atlas5/surface-gateway";
import type { LensId } from "@/lib/atlas5/types";

const LENSES: Array<{ id: LensId; label: string; description: string }> = [
  {
    id: "CPC",
    label: "CPC",
    description: "Connected Places Catapult — full corpus view",
  },
  {
    id: "Atlas",
    label: "Atlas",
    description: "Innovation Atlas — strategic projects only",
  },
  {
    id: "Ecosystem",
    label: "Ecosystem",
    description: "Ecosystem — partners, orgs, and networks",
  },
  {
    id: "Funder",
    label: "Funder",
    description: "Funder — grant and investment lens",
  },
  {
    id: "Mode",
    label: "Mode",
    description: "Mode — transport mode filter",
  },
];

export function LensSelector() {
  const { surface, setLens } = useSurfaceGateway();

  return (
    <div
      aria-label="Lens selector"
      data-testid="lens-selector"
      className="flex items-center gap-1 px-2"
    >
      <span className="text-xs text-muted-foreground mr-1 select-none">
        Lens:
      </span>
      <div className="flex items-center gap-0.5">
        {LENSES.map((lens) => {
          const isActive = surface.active_lens === lens.id;
          return (
            <button
              key={lens.id}
              type="button"
              data-lens={lens.id}
              data-testid={`lens-${lens.id}`}
              aria-pressed={isActive}
              aria-label={lens.description}
              onClick={() => setLens(lens.id)}
              className={[
                "px-2 py-1 rounded text-xs font-medium transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isActive
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              ].join(" ")}
            >
              {lens.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
