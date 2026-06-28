"use client";

import { TrustSwatch } from "@/components/atlas/spine/trust-badge";
import {
  CASE_CLAIM_KIND_LABELS,
  declaredClaimsFromSpec,
  type CaseClaim,
} from "@/lib/atlas/case-file-types";
import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

function DeclaredClaimLine({ claim }: { claim: CaseClaim }) {
  if (claim.review_status === "rejected") return null;
  return (
    <li
      data-material="declared"
      data-claim-id={claim.id}
      data-claim-kind={claim.kind}
      className="flex items-start gap-2"
      style={{
        fontFamily: atlasFont.sans,
        fontSize: 12.5,
        lineHeight: 1.45,
        color: T.ink,
      }}
    >
      <TrustSwatch trust="declared" />
      <span>
        <span
          className="mr-2 inline-block uppercase"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 9,
            letterSpacing: "0.06em",
            color: T.declared,
          }}
        >
          {CASE_CLAIM_KIND_LABELS[claim.kind]}
        </span>
        {claim.text}
      </span>
    </li>
  );
}

/** React equivalent of `declared_markup_block` — gold declared lane on canvas. */
export function DeclaredClaimsBlock({ spec }: { spec: AnswerSpec | null }) {
  const claims = declaredClaimsFromSpec(spec).filter((c) => c.review_status !== "rejected");
  if (!claims.length) return null;

  return (
    <section
      data-testid="declared-situation"
      data-material="declared"
      className="mb-4 rounded-lg border border-dashed px-3 py-3"
      style={{
        borderColor: T.declared,
        background: T.declaredWash,
      }}
    >
      <div
        className="mb-2 uppercase"
        style={{
          fontFamily: atlasFont.mono,
          fontSize: 10,
          letterSpacing: "0.08em",
          color: T.declared,
        }}
      >
        Stated by user · declared · max Indicative
      </div>
      <ul className="m-0 list-none space-y-2 p-0 pl-0">
        {claims.slice(0, 6).map((c) => (
          <DeclaredClaimLine key={c.id} claim={c} />
        ))}
      </ul>
    </section>
  );
}
