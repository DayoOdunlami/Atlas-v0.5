"use client";

/**
 * /lab/objects — object-layer index (blocks + profile fixtures).
 */

import Link from "next/link";

const LINKS = [
  {
    href: "/lab/blocks",
    title: "Block Gallery",
    description: "All ready art-director block types — golden + empty states",
  },
  {
    href: "/lab/stakeholder-maps",
    title: "Stakeholder Maps",
    description: "stakeholder_map block regression gallery",
  },
  {
    href: "/lab/objects?fixture=organisation_profile",
    title: "Organisation profile (fixture)",
    description: "S5b organisation_profile recipe preview via atlas5-test",
    external: false,
  },
];

export default function LabObjectsPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-4 py-3">
        <div className="mx-auto max-w-3xl flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold">Object Layer Lab</h1>
            <p className="text-xs text-muted-foreground">
              Vocabulary, stakeholder maps, and profile fixtures (no agent run)
            </p>
          </div>
          <Link href="/" className="text-xs underline text-muted-foreground hover:text-foreground">
            ← Workspace
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-4 space-y-4">
        <ul className="space-y-3">
          {LINKS.map((item) => (
            <li key={item.href}>
              <Link
                href={
                  item.href.includes("fixture=")
                    ? "/atlas5-test?fixture=organisation_profile"
                    : item.href
                }
                className="block rounded-lg border border-border bg-card p-4 hover:bg-muted/30 transition-colors"
              >
                <p className="text-sm font-semibold">{item.title}</p>
                <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
