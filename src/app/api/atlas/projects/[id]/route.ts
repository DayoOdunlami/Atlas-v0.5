/**
 * GET /api/atlas/projects/[id] — corpus proof (single atlas.projects row).
 */
import { NextResponse } from "next/server";

import { getProject } from "@/lib/atlas5/corpus-queries";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: "Invalid project id" }, { status: 400 });
  }

  try {
    const project = await getProject(id);
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }
    return NextResponse.json({ project, verified: true });
  } catch (err) {
    console.error("[atlas/projects/GET]", err);
    return NextResponse.json({ error: "Failed to fetch project" }, { status: 500 });
  }
}
