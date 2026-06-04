import { NextRequest, NextResponse } from "next/server";

import { isDevTestLoginEnabled } from "@/lib/auth/dev-test-login";

/**
 * Playwright / Cloud Agent session bootstrap (non-production only).
 *
 * POST with header:
 *   x-tool-secret: <BETTER_AUTH_SECRET or E2E_TOOL_SECRET in dev>
 *
 * Sets atlas_e2e_auth cookie; getSession() honours it when ALLOW_E2E_AUTH_COOKIE=true.
 * Same trust model as passport internal routes (x-tool-secret).
 */
export async function POST(request: NextRequest) {
  if (!isDevTestLoginEnabled() && process.env.ALLOW_E2E_AUTH_COOKIE !== "true") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const toolSecret = request.headers.get("x-tool-secret");
  const secret =
    process.env.BETTER_AUTH_SECRET ??
    (isDevTestLoginEnabled() ? process.env.E2E_TOOL_SECRET : undefined);
  if (!secret || toolSecret !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true, mode: "e2e-cookie" });
  response.cookies.set("atlas_e2e_auth", "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 4,
  });
  return response;
}
