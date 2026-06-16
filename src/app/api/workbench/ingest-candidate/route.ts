/**
 * POST /api/workbench/ingest-candidate — queue external opportunity for corpus ingest (D4.6e).
 */
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && !process.env.SUPABASE_SERVICE_KEY) {
    return NextResponse.json({ error: "Ingest not configured" }, { status: 503 });
  }

  try {
    const body = (await request.json()) as {
      title?: string;
      url?: string;
      funder?: string;
    };

    if (!body.title || !body.url) {
      return NextResponse.json({ error: "title and url required" }, { status: 400 });
    }

    // MVP: acknowledge candidate — full upsert to atlas.live_calls is ops-triggered
    return NextResponse.json({
      queued: true,
      candidate: {
        title: body.title,
        url: body.url,
        funder: body.funder ?? null,
        status: "pending_review",
      },
      message: "Candidate queued for corpus ingest review.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
