"use client";

import { cn } from "@/lib/utils";
import type { ArtifactBlock } from "@/lib/atlas5/artifact-store";
import { ChevronDown, ChevronRight, ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { useState } from "react";

type QaStatus = "pass" | "warn" | "fail";

const STATUS_STYLE: Record<QaStatus, string> = {
  pass: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300",
  warn: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200",
  fail: "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/30 dark:text-red-300",
};

const STATUS_ICON: Record<QaStatus, React.ReactNode> = {
  pass: <ShieldCheck className="size-3.5" />,
  warn: <ShieldAlert className="size-3.5" />,
  fail: <ShieldX className="size-3.5" />,
};

export function ArtifactQAPanel({ artifact }: { artifact: ArtifactBlock }) {
  const qa = artifact.artifact_qa;
  const [open, setOpen] = useState(qa?.status !== "pass");

  if (!qa) return null;

  const status = (qa.status ?? "warn") as QaStatus;
  const metrics = qa.metrics ?? {};

  return (
    <div
      data-testid="artifact-qa-panel"
      className={cn("shrink-0 border-b px-4 py-2", STATUS_STYLE[status])}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between gap-2 text-left"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          {STATUS_ICON[status]}
          Artifact QA — {status}
        </span>
        <span className="flex items-center gap-3 text-[11px] font-medium normal-case">
          <span>Content {metrics.content_score ?? 0}%</span>
          <span>Evidence {metrics.evidence_score ?? 0}%</span>
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
        </span>
      </button>
      {open && (qa.issues?.length ?? 0) > 0 && (
        <ul className="mt-2 space-y-1.5 text-[11px] leading-snug">
          {qa.issues!.map((issue, i) => (
            <li key={i} className="flex gap-2">
              <span className="shrink-0 font-semibold uppercase opacity-70">
                {issue.severity}
              </span>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
      )}
      {artifact.falsification?.status === "contradictions_found" && (
        <p className="mt-2 text-[11px] opacity-90">
          Falsification: {artifact.falsification.finding_count} disconfirming source
          {artifact.falsification.finding_count === 1 ? "" : "s"} reviewed (web only).
        </p>
      )}
    </div>
  );
}
