/** Tracks the last /atlas/session?q= value — rotate CopilotKit thread when it changes. */
export const ATLAS_V5_SESSION_QUERY_KEY = "atlas5-v5-session-query";

export function readAtlasSessionQuery(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(ATLAS_V5_SESSION_QUERY_KEY);
}

export function writeAtlasSessionQuery(query: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ATLAS_V5_SESSION_QUERY_KEY, query.trim());
}
