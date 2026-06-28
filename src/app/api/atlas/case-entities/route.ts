import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  createCaseEntity,
  listCaseEntities,
  promoteThreadToEntity,
} from "@/lib/atlas/case-entity-store";
import { isAtlasPgConfigured } from "@/lib/atlas/pg-pool";
import { resolveThreadOwnerId } from "@/lib/atlas/thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PostBodySchema = z.object({
  title: z.string().min(1).max(200),
  from_thread_id: z.string().uuid().optional(),
  promote: z.boolean().optional(),
});

export async function GET() {
  if (!isAtlasPgConfigured()) {
    return NextResponse.json({ entities: [], configured: false }, { status: 503 });
  }

  const ownerId = await resolveThreadOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const entities = await listCaseEntities(ownerId);
    return NextResponse.json({ entities, configured: true });
  } catch (err) {
    console.error("[case-entities/GET]", err);
    return NextResponse.json({ error: "Failed to list entities" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isAtlasPgConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const ownerId = await resolveThreadOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const { title, from_thread_id: fromThreadId, promote } = parsed.data;
    const entity =
      promote && fromThreadId
        ? await promoteThreadToEntity(fromThreadId, ownerId, title)
        : await createCaseEntity(ownerId, title, fromThreadId);

    return NextResponse.json({
      entity: {
        id: entity.id,
        title: entity.title,
        created_at: entity.created_at,
        updated_at: entity.updated_at,
      },
    });
  } catch (err) {
    console.error("[case-entities/POST]", err);
    return NextResponse.json({ error: "Failed to create entity" }, { status: 500 });
  }
}
