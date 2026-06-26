import { type NextRequest, NextResponse } from "next/server";

import { titleFromQuery } from "@/lib/atlas/layout-signals";
import { isAtlasPgConfigured } from "@/lib/atlas/pg-pool";
import { appendTurn, createThread, getThreadForOwner } from "@/lib/atlas/thread-store";
import { resolveThreadOwnerId } from "@/lib/atlas/thread-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  if (!isAtlasPgConfigured()) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const ownerId = await resolveThreadOwnerId();
  if (!ownerId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: threadId } = await params;

  let body: {
    user_message?: string;
    assistant_reply?: string;
    route?: string | null;
    outcome_hint?: string | null;
    answer_spec?: Record<string, unknown> | null;
    answer_dev_meta?: Record<string, unknown> | null;
    layout_signals?: Record<string, unknown> | null;
    latency_ms?: number | null;
  };

  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.user_message?.trim() && !body.assistant_reply?.trim()) {
    return NextResponse.json(
      { error: "user_message or assistant_reply required" },
      { status: 400 },
    );
  }

  try {
    let thread = await getThreadForOwner(threadId, ownerId);
    if (!thread) {
      const title = titleFromQuery(body.user_message ?? "");
      thread = await createThread(ownerId, threadId, title);
    } else if (!thread.title && body.user_message?.trim()) {
      // First turn may set title lazily via separate patch — optional here
    }

    const turn = await appendTurn(threadId, ownerId, {
      user_message: body.user_message ?? "",
      assistant_reply: body.assistant_reply ?? "",
      route: body.route ?? null,
      outcome_hint: body.outcome_hint ?? null,
      answer_spec: body.answer_spec ?? null,
      answer_dev_meta: body.answer_dev_meta ?? null,
      layout_signals: (body.layout_signals as never) ?? null,
      latency_ms: body.latency_ms ?? null,
    });

    return NextResponse.json({ turn });
  } catch (err) {
    if (err instanceof Error && err.message === "thread_not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    console.error("[threads/[id]/turns/POST]", err);
    return NextResponse.json({ error: "Failed to append turn" }, { status: 500 });
  }
}
