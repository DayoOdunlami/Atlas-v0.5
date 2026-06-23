import { NextResponse } from "next/server";

import { validateFinalAnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";

const OFFLINE_HINT =
  "Atlas brain offline — start with: uvicorn agents.server:app --port 8000 --reload";

export async function POST(req: Request) {
  let body: { message?: string; thread_id?: string; current_spec?: unknown };
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
        body: JSON.stringify({
          message,
          thread_id: body.thread_id,
          current_spec: body.current_spec,
        }),
        cache: "no-store",
      });
      if (res.ok) {
        const data = (await res.json()) as { reply?: string; spec?: unknown };
        if (data.spec) {
          const validated = validateFinalAnswerSpec(data.spec);
          if (!validated.success) {
            console.warn("[/api/atlas/turn] Brain spec failed Zod:", validated.error.flatten());
          }
        }
        return NextResponse.json(data);
      }
    } catch (err) {
      console.warn("[/api/atlas/turn] Brain fetch failed:", err);
    }
  }

  return NextResponse.json({
    reply: `${OFFLINE_HINT}\n\nYou asked: “${message}”`,
  });
}
