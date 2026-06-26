import { NextResponse } from "next/server";

import { isAtlasPgConfigured } from "@/lib/atlas/pg-pool";
import { createThread, listThreads } from "@/lib/atlas/thread-store";
import { resolveThreadOwnerId } from "@/lib/atlas/thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!isAtlasPgConfigured()) {
    return NextResponse.json({ threads: [], configured: false });
  }

  const ownerId = await resolveThreadOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const threads = await listThreads(ownerId);
    return NextResponse.json({ threads, configured: true });
  } catch (err) {
    console.error("[threads/GET]", err);
    return NextResponse.json({ error: "Failed to list threads" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  if (!isAtlasPgConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const ownerId = await resolveThreadOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { id?: string; title?: string; lens?: string } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    body = {};
  }

  const id = body.id?.trim() || crypto.randomUUID();
  const title = body.title?.trim() || "New session";

  try {
    const thread = await createThread(ownerId, id, title || "New session", body.lens ?? "CPC");
    return NextResponse.json({ thread });
  } catch (err) {
    console.error("[threads/POST]", err);
    return NextResponse.json({ error: "Failed to create thread" }, { status: 500 });
  }
}
