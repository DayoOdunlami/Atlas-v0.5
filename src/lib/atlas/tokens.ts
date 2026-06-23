/** Atlas v5 design tokens — locked reference palette (AtlasSurface.jsx) */

export const atlasTokens = {
  page: "#e7e5df",
  canvas: "#FBFAF7",
  ink: "#1A1714",
  inkSoft: "#5A5249",
  inkFaint: "#94908A",
  rule: "#d4d0c8",
  ruleSoft: "#EFEBE4",
  corpus: "#3F7A52",
  corpusWash: "#EEF4EE",
  web: "#B6CADB",
  gap: "#B07A2E",
  gapWash: "#FBF4E8",
} as const;

export const atlasFont = {
  serif: "var(--font-atlas-serif), Georgia, serif",
  sans: "var(--font-atlas-sans), system-ui, sans-serif",
  mono: "var(--font-atlas-mono), ui-monospace, monospace",
} as const;
