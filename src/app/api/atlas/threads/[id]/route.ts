import { type NextRequest, NextResponse } from "next/server";

import { isAtlasPgConfigured } from "@/lib/atlas/pg-pool";
import {
  archiveThread,
  getThreadForOwner,
  listTurns,
  updateThreadTitle,
} from "@/lib/atlas/thread-store";
import { resolveThreadOwnerId } from "@/lib/atlas/thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  if (!isAtlasPgConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const ownerId = await resolveThreadOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;
  try {
    const thread = await getThreadForOwner(threadId, ownerId);
    if (!thread) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const turns = await listTurns(threadId, ownerId);
    return NextResponse.json({
      id: thread.id,
      title: thread.title,
      lens: thread.lens,
      created_at: thread.created_at,
      updated_at: thread.updated_at,
      turns,
    });
  } catch (err) {
    console.error("[threads/[id]/GET]", err);
    return NextResponse.json({ error: "Failed to load thread" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!isAtlasPgConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const ownerId = await resolveThreadOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;
  let body: { title?: string; archive?: boolean } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    if (body.archive) {
      await archiveThread(threadId, ownerId);
      return NextResponse.json({ ok: true });
    }
    if (body.title?.trim()) {
      await updateThreadTitle(threadId, ownerId, body.title.trim());
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  } catch (err) {
    console.error("[threads/[id]/PATCH]", err);
    return NextResponse.json({ error: "Failed to update thread" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  if (!isAtlasPgConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const ownerId = await resolveThreadOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;
  try {
    await archiveThread(threadId, ownerId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[threads/[id]/DELETE]", err);
    return NextResponse.json({ error: "Failed to delete thread" }, { status: 500 });
  }
}
