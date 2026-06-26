import { redirect } from "next/navigation";

/** Legacy route — canonical surface is `/atlas?q=…`. */
export default async function AtlasSessionRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; thread?: string }>;
}) {
  const { q, thread } = await searchParams;
  const params = new URLSearchParams();
  if (q?.trim()) params.set("q", q.trim());
  if (thread?.trim()) params.set("thread", thread.trim());
  const qs = params.toString();
  redirect(qs ? `/atlas?${qs}` : "/atlas");
}
