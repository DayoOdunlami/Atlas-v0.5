/**
 * Presentation plan — emitted by format_pass compose_presentation (Phase A).
 */
export type ChatSurface =
  | "artifact_primary"
  | "hybrid"
  | "chat_only"
  | "chat_primary";

export interface PresentationPlan {
  chat_surface: ChatSurface;
  turn_lane: string;
  above_fold: string[];
  collapsed: string[];
  reference?: string[];
  hidden: string[];
  dominant_visual_id: string | null;
  primary_action: string;
  evidence_collapsed: boolean;
  citation_count: number;
  max_expanded_blocks: number;
}

export function blockIdToDom(id: string): string {
  return id.replace(/_/g, "-");
}

export function domIdToBlock(id: string): string {
  return id.replace(/-/g, "_");
}

export function parsePresentationPlan(raw: unknown): PresentationPlan | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as Record<string, unknown>;
  return {
    chat_surface: (p.chat_surface as ChatSurface) ?? "hybrid",
    turn_lane: String(p.turn_lane ?? "analyze"),
    above_fold: Array.isArray(p.above_fold) ? p.above_fold.map(String) : [],
    collapsed: Array.isArray(p.collapsed) ? p.collapsed.map(String) : [],
    reference: Array.isArray(p.reference) ? p.reference.map(String) : [],
    hidden: Array.isArray(p.hidden) ? p.hidden.map(String) : [],
    dominant_visual_id:
      p.dominant_visual_id == null ? null : String(p.dominant_visual_id),
    primary_action: String(p.primary_action ?? "Ask a follow-up →"),
    evidence_collapsed: Boolean(p.evidence_collapsed),
    citation_count: typeof p.citation_count === "number" ? p.citation_count : 0,
    max_expanded_blocks:
      typeof p.max_expanded_blocks === "number" ? p.max_expanded_blocks : 1,
  };
}
