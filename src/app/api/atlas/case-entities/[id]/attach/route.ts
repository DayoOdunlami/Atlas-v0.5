import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  archiveCaseEntity,
  attachThreadToEntity,
} from "@/lib/atlas/case-entity-store";
import { isAtlasPgConfigured } from "@/lib/atlas/pg-pool";
import { getThreadForOwner } from "@/lib/atlas/thread-store";
import { resolveThreadOwnerId } from "@/lib/atlas/thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

const AttachBodySchema = z.object({
  thread_id: z.string().uuid(),
});

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!isAtlasPgConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const ownerId = await resolveThreadOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: entityId } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = AttachBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const thread = await getThreadForOwner(parsed.data.thread_id, ownerId);
  if (!thread) {
    return NextResponse.json({ error: "Thread not found" }, { status: 404 });
  }

  try {
    await attachThreadToEntity(parsed.data.thread_id, entityId, ownerId);
    return NextResponse.json({ ok: true, case_entity_id: entityId });
  } catch (err) {
    console.error("[case-entities/attach]", err);
    return NextResponse.json({ error: "Failed to attach entity" }, { status: 500 });
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

  const { id: entityId } = await params;

  try {
    await archiveCaseEntity(entityId, ownerId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[case-entities/DELETE]", err);
    return NextResponse.json({ error: "Failed to archive entity" }, { status: 500 });
  }
}
