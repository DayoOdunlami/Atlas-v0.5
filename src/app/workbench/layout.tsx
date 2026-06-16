/** Orchestrator / CopilotKit workbench — skip static prerender at build time. */
export const dynamic = "force-dynamic";

export default function WorkbenchLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
