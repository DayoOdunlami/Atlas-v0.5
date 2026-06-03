"use client";

/**
 * Escalation bridge — artifact surface actions → chat turn-2 messages.
 *
 * Surfaces call requestEscalation(message); ChatPane consumes and sends via CopilotKit.
 */
import { create } from "zustand";

interface EscalationStore {
  pendingMessage: string | null;
  requestEscalation: (message: string) => void;
  clearPending: () => void;
}

export const useEscalationStore = create<EscalationStore>((set) => ({
  pendingMessage: null,
  requestEscalation: (message) => set({ pendingMessage: message.trim() }),
  clearPending: () => set({ pendingMessage: null }),
}));

/** Build a turn-2 Act escalation from prior artifact context. */
export function buildActEscalationPrompt(headline: string, recipe?: string): string {
  const ctx = headline ? `Context from prior ${recipe ?? "analysis"}: ${headline}. ` : "";
  return (
    `${ctx}Build a Green Book Five Case investment brief for this opportunity, ` +
    "carrying forward the evidence and gaps identified above."
  );
}

/** Build a turn-2 Diagnose escalation from Connect/Orient context. */
export function buildDiagnoseEscalationPrompt(
  subject: string,
  headline?: string,
): string {
  const ctx = headline ? ` (${headline})` : "";
  return (
    `Diagnose evidence fit and value translation for: ${subject}${ctx}. ` +
    "Surface specific gaps, entry friction, and recommended next move."
  );
}

/** Build a turn-2 Connect escalation from Orient context. */
export function buildConnectEscalationPrompt(headline?: string): string {
  const ctx = headline ? `Given: ${headline}. ` : "";
  return (
    `${ctx}Find funding opportunities and credible connection routes ` +
    "aligned with this landscape assessment."
  );
}
