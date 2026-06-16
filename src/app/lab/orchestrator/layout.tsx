/** CopilotKit hooks — skip static prerender (build-time SSR). */
export const dynamic = "force-dynamic";

export default function OrchestratorLabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
