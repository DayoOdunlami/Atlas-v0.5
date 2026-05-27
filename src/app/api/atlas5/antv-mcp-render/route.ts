import "server-only";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Proxy: POST /api/atlas5/antv-mcp-render
 *
 * Forwards a chart spec to the AntV MCP rendering service and returns
 * the image URL. Runs server-side to:
 *   - Avoid CORS issues calling Alipay from the browser
 *   - Keep VIS_REQUEST_SERVER secret (private endpoint in production)
 *   - Return 404 in production (lab-only endpoint)
 *
 * Request body: any AntV GPT-vis chart spec object
 * Response:     { imageUrl: string } | { error: string }
 *
 * Service API contract (Alipay / self-hosted):
 *   POST VIS_REQUEST_SERVER
 *   Body: { type: "venn", data: [...], ... }
 *   Response: { success: boolean, resultObj: string (image URL), errorMessage?: string }
 */

const VIS_SERVER =
  process.env.VIS_REQUEST_SERVER ??
  "https://antv-studio.alipay.com/api/gpt-vis";

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let spec: Record<string, unknown>;
  try {
    spec = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const res = await fetch(VIS_SERVER, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(spec),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return NextResponse.json(
        { error: `AntV MCP service returned ${res.status}: ${text.slice(0, 200)}` },
        { status: 502 },
      );
    }

    const data = (await res.json()) as {
      success?: boolean;
      resultObj?: string;
      errorMessage?: string;
    };

    if (!data.success || !data.resultObj) {
      return NextResponse.json(
        { error: data.errorMessage ?? "Render service returned no image URL" },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { imageUrl: data.resultObj },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    const msg =
      process.env.NODE_ENV === "development" ? String(err) : "Render failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
