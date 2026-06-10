/**
 * GET /api/workbench/db-check
 *
 * Tests Supabase admin client connectivity (HTTPS, same path as the builder).
 * Dev-only.
 */
import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "(not set)";
  const hasServiceKey = Boolean(process.env.SUPABASE_SERVICE_KEY);

  const sb = createAdminClient();
  const start = Date.now();

  try {
    const { count, error } = await sb
      .schema("atlas")
      .from("matches")
      .select("id", { count: "exact", head: true });

    if (error) {
      return NextResponse.json(
        { connected: false, url, has_service_key: hasServiceKey, error: error.message },
        { status: 503 },
      );
    }

    return NextResponse.json({
      connected: true,
      url,
      has_service_key: hasServiceKey,
      atlas_matches_count: count,
      latency_ms: Date.now() - start,
    });
  } catch (err) {
    return NextResponse.json(
      { connected: false, url, has_service_key: hasServiceKey, error: String(err) },
      { status: 503 },
    );
  }
}
