/** Workbench lab uses client-only agent runtime — skip static prerender. */
export const dynamic = "force-dynamic";

export default function LegacyWorkbenchLabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
