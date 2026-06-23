/** Client-side showcase helpers — mirrors agents/atlas_v5/showcase.py triggers */

const MENU_RE =
  /\b(show\s+me\s+what\s+you\s+can\s+do|what\s+can\s+you\s+do|showcase|demo\s+mode|run\s+(?:a\s+)?demo|flex\s+your\s+digital\s+muscle)\b/i;

export function isShowcaseMenuQuery(query: string): boolean {
  return MENU_RE.test(query.trim());
}

export const SHOWCASE_CHIP_OPTIONS = [
  { id: "rail", label: "Rail journey", command: "demo rail" },
  { id: "aviation", label: "Aviation journey", command: "demo aviation" },
  { id: "flex", label: "Flex digital muscle", command: "demo flex" },
];
