import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";

export const ENTRY_PLACEHOLDERS = [
  "a mode, a gap, a network, a decision…",
  "which transport mode should we back?",
  "where are we thinnest vs the national picture?",
  "who should we convene — and who is missing?",
  "is this gap real, or are we just not seeing it?",
];

export type EntryStarter = {
  query: string;
  highlight: "corpus" | "thin" | "maritime";
};

/** Starters from Canvas at Rest v3 — hover lights cluster on corpus field */
export const ENTRY_STARTERS: EntryStarter[] = [
  {
    query: "Show me what you can do",
    highlight: "corpus",
  },
  {
    query: "Which transport mode should we prioritise for decarbonisation?",
    highlight: "corpus",
  },
  {
    query: "Where is our funding thinnest against the national picture?",
    highlight: "thin",
  },
  {
    query: "Who should we convene on maritime — and who is missing?",
    highlight: "maritime",
  },
];

/** So-what copy while canvas is at rest — first turn has no AnswerSpec yet */
export const ENTRY_SO_WHAT: AnswerSpec["soWhat"] = {
  lookingAt:
    "Canvas at rest — the corpus field is live. Web evidence stays dormant until you ask.",
  oneDecision:
    "Ask your first question in the bar below. Atlas will compose a canvas from live corpus + optional web.",
  gate: "Every answer carries a confidence ceiling — the canvas cannot certify above it.",
  primaryAction: "State of play on rail decarbonisation in our corpus",
  turn: "—",
};
