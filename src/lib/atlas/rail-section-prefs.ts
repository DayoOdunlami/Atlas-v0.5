export type RailSectionId = "sessions" | "caseFile" | "tools";

const STORAGE_KEY = "atlas5:rail-sections";

type RailSectionPrefs = Partial<Record<RailSectionId, boolean>>;

function readAll(): RailSectionPrefs {
  if (typeof sessionStorage === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as RailSectionPrefs;
  } catch {
    return {};
  }
}

function writeAll(prefs: RailSectionPrefs): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

export function readRailSectionOpen(id: RailSectionId, defaultOpen: boolean): boolean {
  const prefs = readAll();
  return prefs[id] ?? defaultOpen;
}

export function writeRailSectionOpen(id: RailSectionId, open: boolean): void {
  const prefs = readAll();
  writeAll({ ...prefs, [id]: open });
}
