/** Tracks the last /atlas/session?q= value — rotate CopilotKit thread when it changes. */
export const ATLAS_V5_SESSION_QUERY_KEY = "atlas5-v5-session-query";

/** Entry → session handoff: session consumes this to rotate thread + bootstrap send. */
export const ATLAS_V5_PENDING_BOOTSTRAP_KEY = "atlas5-v5-pending-bootstrap";

/** Prevents duplicate bootstrap send when CopilotKit re-renders. */
export const ATLAS_V5_BOOTSTRAP_SENT_KEY = "atlas5-v5-bootstrap-sent";

export function readAtlasSessionQuery(): string | null {
  if (typeof sessionStorage === "undefined") return null;
  return sessionStorage.getItem(ATLAS_V5_SESSION_QUERY_KEY);
}

export function writeAtlasSessionQuery(query: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ATLAS_V5_SESSION_QUERY_KEY, query.trim());
}

export function markPendingBootstrap(query: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ATLAS_V5_PENDING_BOOTSTRAP_KEY, query.trim());
  sessionStorage.removeItem(ATLAS_V5_BOOTSTRAP_SENT_KEY);
}

export function consumePendingBootstrap(expectedQuery: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  const pending = sessionStorage.getItem(ATLAS_V5_PENDING_BOOTSTRAP_KEY);
  if (!pending || pending !== expectedQuery.trim()) return false;
  sessionStorage.removeItem(ATLAS_V5_PENDING_BOOTSTRAP_KEY);
  return true;
}

export function markBootstrapSent(query: string): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.setItem(ATLAS_V5_BOOTSTRAP_SENT_KEY, query.trim());
}

export function wasBootstrapSent(query: string): boolean {
  if (typeof sessionStorage === "undefined") return false;
  return sessionStorage.getItem(ATLAS_V5_BOOTSTRAP_SENT_KEY) === query.trim();
}

export function clearBootstrapSent(): void {
  if (typeof sessionStorage === "undefined") return;
  sessionStorage.removeItem(ATLAS_V5_BOOTSTRAP_SENT_KEY);
}
