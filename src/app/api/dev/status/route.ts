import { NextResponse } from "next/server";
import { getProcessManager, SERVICE_PORTS } from "@/lib/dev/process-manager";

export const dynamic = "force-dynamic";

export async function GET() {
  const pm = getProcessManager();

  const [agentsPort, langgraphPort, nextjsPort] = await Promise.all([
    pm.checkPort(SERVICE_PORTS.agents),
    pm.checkPort(SERVICE_PORTS.langgraph),
    pm.checkPort(SERVICE_PORTS.nextjs),
  ]);

  return NextResponse.json({
    nextjs: {
      status: nextjsPort ? "running" : "stopped",
      port: SERVICE_PORTS.nextjs,
      portOpen: nextjsPort,
    },
    agents: {
      status: pm.getStatus("agents"),
      port: SERVICE_PORTS.agents,
      portOpen: agentsPort,
    },
    langgraph: {
      status: pm.getStatus("langgraph"),
      port: SERVICE_PORTS.langgraph,
      portOpen: langgraphPort,
    },
  });
}
