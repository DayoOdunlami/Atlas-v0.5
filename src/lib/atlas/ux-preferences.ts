/**
 * Atlas session UX toggles — persisted in sessionStorage.
 * Tier 3/4 (costlier streaming) default off; tier 2 interim chat defaults on.
 */

export type AtlasUxPrefs = {
  /** After gather: short assistant status before canvas completes (cheap). */
  streamInterimChat: boolean;
  /** Stream deep-pass chat tokens before final message (extra LLM cost). */
  streamChatTokens: boolean;
  /** Emit visual-stage partial envelopes during compose (more graph work). */
  streamCompose: boolean;
  /** Fold chain-of-thought steps by default on canvas. */
  collapsibleCot: boolean;
};

const STORAGE_KEY = "atlas-v5-ux-prefs";

export const DEFAULT_ATLAS_UX_PREFS: AtlasUxPrefs = {
  streamInterimChat: true,
  streamChatTokens: false,
  streamCompose: false,
  collapsibleCot: true,
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function readAtlasUxPrefs(): AtlasUxPrefs {
  if (!canUseStorage()) return { ...DEFAULT_ATLAS_UX_PREFS };
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_ATLAS_UX_PREFS };
    const parsed = JSON.parse(raw) as Partial<AtlasUxPrefs>;
    return { ...DEFAULT_ATLAS_UX_PREFS, ...parsed };
  } catch {
    return { ...DEFAULT_ATLAS_UX_PREFS };
  }
}

export function writeAtlasUxPrefs(prefs: AtlasUxPrefs): void {
  if (!canUseStorage()) return;
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

export function patchAtlasUxPrefs(patch: Partial<AtlasUxPrefs>): AtlasUxPrefs {
  const next = { ...readAtlasUxPrefs(), ...patch };
  writeAtlasUxPrefs(next);
  return next;
}

/** Snake-free keys mirrored on LangGraph co-agent state. */
export function uxPrefsForAgent(prefs: AtlasUxPrefs): Record<string, boolean> {
  return {
    streamInterimChat: prefs.streamInterimChat,
    streamChatTokens: prefs.streamChatTokens,
    streamCompose: prefs.streamCompose,
    collapsibleCot: prefs.collapsibleCot,
  };
}
