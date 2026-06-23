"use client";

import { motion } from "framer-motion";

import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

const sectionMotion = {
  hidden: { opacity: 0, y: 10 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.35, ease: [0.22, 1, 0.36, 1] },
  }),
};

export function ProgressiveCanvasSection({
  visible,
  index = 0,
  children,
  testId,
}: {
  visible: boolean;
  index?: number;
  children: React.ReactNode;
  testId?: string;
}) {
  if (!visible) return null;
  return (
    <motion.div
      data-testid={testId}
      custom={index}
      initial="hidden"
      animate="show"
      variants={sectionMotion}
    >
      {children}
    </motion.div>
  );
}

export function progressiveStageRank(stage: string | null | undefined): number {
  switch (stage) {
    case "stats":
      return 1;
    case "spine":
      return 2;
    case "visual":
      return 3;
    case "complete":
      return 4;
    default:
      return 4;
  }
}

export function stageAtLeast(
  current: string | null | undefined,
  required: "stats" | "spine" | "visual" | "complete",
): boolean {
  if (!current || current === "complete") return true;
  const order = ["stats", "spine", "visual", "complete"];
  return order.indexOf(current) >= order.indexOf(required);
}

/** Pulse placeholder while a section is pending during an active turn. */
export function CanvasSectionSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="mb-4 space-y-2" aria-hidden>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="atlas-pulse-dot h-3 rounded-sm"
          style={{
            width: i === 0 ? "72%" : "54%",
            background: T.ruleSoft,
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}

export { sectionMotion, atlasFont };
