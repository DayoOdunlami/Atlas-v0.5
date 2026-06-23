"use client";

import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

export type ShowcaseOption = {
  id: string;
  label: string;
  command: string;
};

export function ShowcaseChips({
  options,
  onSelect,
  title,
}: {
  options: ShowcaseOption[];
  onSelect: (command: string) => void;
  title?: string;
}) {
  if (!options.length) return null;

  return (
    <div
      data-testid="showcase-chips"
      className="mb-3 rounded-lg border px-3 py-2.5"
      style={{ borderColor: T.rule, background: "#FBFAF7" }}
    >
      {title ? (
        <div
          className="mb-2 uppercase"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 9,
            letterSpacing: "0.1em",
            color: T.inkFaint,
          }}
        >
          {title}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.command)}
            className="cursor-pointer rounded-full border px-3 py-1 text-xs transition-colors hover:opacity-90"
            style={{
              borderColor: T.corpus,
              background: T.corpusWash,
              color: T.corpus,
              fontFamily: atlasFont.mono,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
