"use client";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

type OppItem = {
  title?: string;
  source?: string;
  url?: string;
  publisher?: string;
  organisation?: string;
  fitNote?: string;
};

export function OpportunityList({
  instrument,
}: {
  instrument: NonNullable<AnswerSpec["instrument"]>;
}) {
  const data = instrument.data as { items?: OppItem[]; practitionerQuery?: string };
  const items = data.items ?? [];

  return (
    <div data-testid="opportunity-list" className="mb-4 max-w-[720px]">
      <div
        className="mb-3 uppercase"
        style={{
          fontFamily: atlasFont.mono,
          fontSize: 10,
          letterSpacing: "0.12em",
          color: "#56524C",
        }}
      >
        Practitioner signals · ranked
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div
            key={`${item.title}-${i}`}
            className="rounded-lg border px-3 py-2.5"
            style={{
              borderColor: item.source === "web" ? "#C5D4E8" : "#CFE0D4",
              background: item.source === "web" ? "#F4F7FB" : "#F4F8F4",
            }}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold" style={{ color: "#1A1714" }}>
                {item.title}
              </span>
              <span
                style={{
                  fontFamily: atlasFont.mono,
                  fontSize: 9,
                  color: item.source === "web" ? T.web : T.corpus,
                }}
              >
                {item.source ?? "corpus"}
              </span>
            </div>
            {item.fitNote ? (
              <p className="mt-1 text-xs" style={{ color: "#56524C" }}>
                {item.fitNote}
              </p>
            ) : null}
          </div>
        ))}
        {!items.length ? (
          <p className="text-sm" style={{ color: T.inkFaint }}>
            No ranked signals yet — enable web lane or broaden the query.
          </p>
        ) : null}
      </div>
    </div>
  );
}
