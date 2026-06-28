import type { ThreadSummary } from "@/lib/atlas/thread-client";

const CACHE_KEY = "atlas5:thread-list";
const MAX_CACHED = 50;

export function readCachedThreadList(): ThreadSummary[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ThreadSummary[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_CACHED) : [];
  } catch {
    return [];
  }
}

export function writeCachedThreadList(threads: ThreadSummary[]): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(threads.slice(0, MAX_CACHED)));
  } catch {
    /* ignore quota */
  }
}

export function upsertCachedThread(thread: ThreadSummary): void {
  const rest = readCachedThreadList().filter((t) => t.id !== thread.id);
  writeCachedThreadList([thread, ...rest]);
}

export function removeCachedThread(threadId: string): void {
  writeCachedThreadList(readCachedThreadList().filter((t) => t.id !== threadId));
}

export function clearCachedThreadList(): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
