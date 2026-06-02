import { NextRequest } from "next/server";
import { getProcessManager } from "@/lib/dev/process-manager";
import type { ServiceName, LogEntry } from "@/lib/dev/process-manager";

export const dynamic = "force-dynamic";

function isServiceName(v: string): v is ServiceName {
  return v === "agents" || v === "langgraph";
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ service: string }> },
) {
  const { service } = await params;

  if (!isServiceName(service)) {
    return new Response("Unknown service", { status: 400 });
  }

  const pm = getProcessManager();

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Flush existing buffer
      const buffer = pm.getLogBuffer(service);
      for (const entry of buffer) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
      }

      // Stream new log entries
      const onLog = (entry: LogEntry) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
        } catch {
          pm.off(`log:${service}`, onLog);
        }
      };

      pm.on(`log:${service}`, onLog);

      // Stream status changes as synthetic log entries
      const onStatus = (status: string) => {
        const entry: LogEntry = {
          text: `[status] ${status}`,
          ts: Date.now(),
          stream: "stdout",
        };
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(entry)}\n\n`));
        } catch {
          pm.off(`status:${service}`, onStatus);
        }
      };
      pm.on(`status:${service}`, onStatus);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
