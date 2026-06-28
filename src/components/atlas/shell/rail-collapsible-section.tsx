"use client";

import type { ReactNode } from "react";

import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";
import { cn } from "@/lib/utils";

export function RailCollapsibleSection({
  testId,
  icon,
  title,
  subtitle,
  badge,
  headerAction,
  open,
  onToggle,
  railOpen,
  maxBodyHeight = "max-h-[min(42vh,280px)]",
  children,
}: {
  testId: string;
  icon: ReactNode;
  title: string;
  subtitle?: string;
  badge?: string | number;
  headerAction?: ReactNode;
  open: boolean;
  onToggle: () => void;
  railOpen: boolean;
  maxBodyHeight?: string;
  children: ReactNode;
}) {
  if (!railOpen) {
    return (
      <button
        type="button"
        data-testid={`${testId}-collapsed`}
        title={title}
        onClick={onToggle}
        className="mx-auto flex size-9 items-center justify-center rounded-md border transition-colors hover:bg-white/60"
        style={{ borderColor: T.ruleSoft, color: open ? T.corpus : T.inkFaint }}
      >
        {icon}
      </button>
    );
  }

  return (
    <section
      data-testid={testId}
      data-open={open ? "true" : "false"}
      className="border-b"
      style={{ borderColor: T.ruleSoft }}
    >
      <div className="flex items-start gap-1 px-2 py-1.5">
        <button
          type="button"
          data-testid={`${testId}-toggle`}
          onClick={onToggle}
          className="flex min-w-0 flex-1 items-start gap-2 rounded-md px-1 py-0.5 text-left transition-colors hover:bg-white/50"
          aria-expanded={open}
        >
          <span className="mt-0.5 shrink-0" style={{ color: T.inkFaint }}>
            {icon}
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block uppercase"
              style={{
                fontFamily: atlasFont.mono,
                fontSize: 9,
                letterSpacing: "0.12em",
                color: T.inkFaint,
              }}
            >
              {title}
              {badge != null && badge !== "" ? (
                <span style={{ color: T.corpus, marginLeft: 6 }}>({badge})</span>
              ) : null}
            </span>
            {subtitle ? (
              <span
                className="mt-0.5 block truncate"
                style={{ fontFamily: atlasFont.sans, fontSize: 10, color: T.inkSoft }}
              >
                {subtitle}
              </span>
            ) : null}
          </span>
          <span
            className="shrink-0 pt-0.5"
            style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}
            aria-hidden
          >
            {open ? "▾" : "▸"}
          </span>
        </button>
        {headerAction ? <div className="shrink-0 pt-0.5">{headerAction}</div> : null}
      </div>
      {open ? (
        <div className={cn("overflow-y-auto px-2 pb-2", maxBodyHeight)}>{children}</div>
      ) : null}
    </section>
  );
}
