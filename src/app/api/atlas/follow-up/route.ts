import { NextResponse } from "next/server";

export async function POST(req: Request) {
  let body: { message?: string; thread_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const message = body.message?.trim();
  if (!message) {
    return NextResponse.json({ error: "message required" }, { status: 400 });
  }

  const agentsUrl = process.env.PYTHON_AGENTS_URL?.replace(/\/$/, "");
  if (agentsUrl) {
    try {
      const res = await fetch(`${agentsUrl}/atlas-v5/turn`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, thread_id: body.thread_id }),
        cache: "no-store",
      });
      if (res.ok) {
        return NextResponse.json(await res.json());
      }
    } catch {
      /* fall through */
    }
  }

  return NextResponse.json({
    reply:
      "Atlas brain offline — start: uvicorn agents.server:app --port 8000 --reload",
  });
}
