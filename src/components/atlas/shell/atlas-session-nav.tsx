"use client";

import Link from "next/link";

import { ConnectionStatus } from "@/components/atlas/shell/connection-status";
import type { AtlasDevMeta } from "@/components/atlas/shell/dev-overlay";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

type AtlasSessionNavProps = {
  devMeta?: AtlasDevMeta | null;
  onNewSession?: () => void;
  chatPending?: boolean;
  className?: string;
};

/** Top bar — corpus connectivity + escape hatch to a fresh question. */
export function AtlasSessionNav({
  devMeta,
  onNewSession,
  chatPending = false,
  className = "",
}: AtlasSessionNavProps) {
  return (
    <div
      className={`flex shrink-0 items-center justify-between gap-3 px-6 pt-2 pb-1 ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Link
          href="/atlas"
          className="shrink-0 no-underline"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 10,
            letterSpacing: "0.12em",
            color: T.inkFaint,
          }}
        >
          ATLAS
        </Link>
        <ConnectionStatus devMeta={devMeta} className="relative" />
      </div>

      {onNewSession ? (
        <button
          type="button"
          data-testid="atlas-new-question"
          disabled={chatPending}
          onClick={onNewSession}
          title="Clear chat and canvas — start a new question"
          className="cursor-pointer shrink-0 rounded border transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
          style={{
            fontFamily: atlasFont.mono,
            fontSize: 10,
            letterSpacing: "0.06em",
            padding: "6px 12px",
            color: T.corpus,
            borderColor: "#D4CFC4",
            background: "#FAF8F4",
          }}
        >
          New question
        </button>
      ) : null}
    </div>
  );
}
