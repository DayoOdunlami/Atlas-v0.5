import { NextRequest, NextResponse } from "next/server";
import { getProcessManager, SERVICE_PORTS } from "@/lib/dev/process-manager";
import type { ServiceName } from "@/lib/dev/process-manager";

export const dynamic = "force-dynamic";

const MANAGED_SERVICES: ServiceName[] = ["agents", "langgraph"];

function isServiceName(v: unknown): v is ServiceName {
  return v === "agents" || v === "langgraph";
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const { action, service, port } = body;
  const pm = getProcessManager();

  switch (action) {
    case "start": {
      if (!isServiceName(service)) {
        return NextResponse.json({ error: "Unknown service" }, { status: 400 });
      }
      await pm.start(service);
      return NextResponse.json({ ok: true });
    }

    case "stop": {
      if (!isServiceName(service)) {
        return NextResponse.json({ error: "Unknown service" }, { status: 400 });
      }
      pm.stop(service);
      return NextResponse.json({ ok: true });
    }

    case "restart": {
      if (!isServiceName(service)) {
        return NextResponse.json({ error: "Unknown service" }, { status: 400 });
      }
      pm.restart(service);
      return NextResponse.json({ ok: true });
    }

    case "kill_port": {
      const targetPort =
        typeof port === "number"
          ? port
          : typeof service === "string" && service in SERVICE_PORTS
          ? SERVICE_PORTS[service as keyof typeof SERVICE_PORTS]
          : null;

      if (!targetPort) {
        return NextResponse.json({ error: "No port specified" }, { status: 400 });
      }

      const killed = pm.killPort(targetPort);

      // If we killed the port of a managed service, reset its status
      for (const svc of MANAGED_SERVICES) {
        if (SERVICE_PORTS[svc] === targetPort) {
          pm.stop(svc);
        }
      }

      return NextResponse.json({ ok: true, killed });
    }

    case "start_all": {
      await Promise.all(MANAGED_SERVICES.map((s) => pm.start(s)));
      return NextResponse.json({ ok: true });
    }

    case "stop_all": {
      MANAGED_SERVICES.forEach((s) => pm.stop(s));
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
