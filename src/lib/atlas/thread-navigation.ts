/** Build a thread-only session URL — strips bootstrap `q` to avoid re-bootstrap on switch. */
export function buildAtlasThreadUrl(threadId: string): string {
  const id = threadId.trim();
  return `/atlas?thread=${encodeURIComponent(id)}`;
}

export function buildAtlasBootstrapUrl(threadId: string, query: string): string {
  const id = threadId.trim();
  const q = query.trim();
  return `/atlas?thread=${encodeURIComponent(id)}&q=${encodeURIComponent(q)}`;
}

/** Parse thread id from `/atlas?thread=…` search string. */
export function parseAtlasThreadId(search: string): string | null {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const thread = params.get("thread")?.trim();
  return thread || null;
}
