import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  caseFilePersistEnabled,
  loadCaseFileForThread,
  patchCaseFileForThread,
} from "@/lib/atlas/case-file-store";
import { CASE_CLAIM_KINDS } from "@/lib/atlas/case-file-types";
import { isAtlasPgConfigured } from "@/lib/atlas/pg-pool";
import { getThreadForOwner } from "@/lib/atlas/thread-store";
import { resolveThreadOwnerId } from "@/lib/atlas/thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ threadId: string }> };

const ClaimPatchSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1).max(2000),
  kind: z.enum(CASE_CLAIM_KINDS),
  review_status: z.enum(["pending", "confirmed", "rejected"]).default("pending"),
});

const PatchBodySchema = z.object({
  claims: z.array(ClaimPatchSchema).max(12),
});

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { threadId } = await params;

  if (!isAtlasPgConfigured()) {
    return NextResponse.json(
      {
        thread_id: threadId,
        case_entity_id: null,
        claims: [],
        persist_enabled: false,
      },
      { status: 503 },
    );
  }

  const ownerId = await resolveThreadOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const thread = await getThreadForOwner(threadId, ownerId);
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const snapshot = await loadCaseFileForThread(threadId);
    return NextResponse.json({
      ...snapshot,
      persist_enabled: caseFilePersistEnabled(),
    });
  } catch (err) {
    console.error("[case-file/GET]", err);
    return NextResponse.json({ error: "Failed to load case file" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  if (!isAtlasPgConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  if (!caseFilePersistEnabled()) {
    return NextResponse.json(
      { error: "Case file persist disabled — set ATLAS_V5_CASEFILE_PERSIST=1" },
      { status: 503 },
    );
  }

  const ownerId = await resolveThreadOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { threadId } = await params;
  const thread = await getThreadForOwner(threadId, ownerId);
  if (!thread) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const claims = parsed.data.claims.map((c) => ({
      ...c,
      source: "declared" as const,
    }));
    const snapshot = await patchCaseFileForThread(threadId, claims);
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error("[case-file/PATCH]", err);
    return NextResponse.json({ error: "Failed to update case file" }, { status: 500 });
  }
}
