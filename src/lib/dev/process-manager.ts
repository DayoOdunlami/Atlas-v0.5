/**
 * Dev Process Manager — singleton via globalThis so it survives Next.js HMR.
 *
 * Manages the two Python backend services (agents:8000, langgraph:2024).
 * The Next.js server itself (3005) is "external" — monitored but not spawned here.
 */

import { ChildProcess, spawn, execSync } from "child_process";
import { EventEmitter } from "events";
import * as net from "net";
import * as path from "path";

export type ServiceName = "agents" | "langgraph";
export type ServiceStatus = "stopped" | "starting" | "running" | "error";

export interface LogEntry {
  text: string;
  ts: number;
  stream: "stdout" | "stderr";
}

interface ServiceState {
  process: ChildProcess | null;
  status: ServiceStatus;
  logs: LogEntry[];
}

const AGENTS_DIR = path.resolve(process.cwd(), "agents");
const LOG_LIMIT = 500;

const SERVICE_CONFIG: Record<ServiceName, { port: number; cmd: string; args: string[] }> = {
  agents: {
    port: 8000,
    cmd: "uv",
    args: ["run", "uvicorn", "server:app", "--port", "8000", "--reload"],
  },
  langgraph: {
    port: 2024,
    cmd: "uv",
    args: ["run", "langgraph", "dev"],
  },
};

// Patterns that indicate a service is ready
const READY_PATTERNS: Record<ServiceName, RegExp> = {
  agents:    /Application startup complete|Uvicorn running on|Started server process/i,
  langgraph: /API: http|Application startup complete|Starting In-Memory runtime/i,
};

class ProcessManager extends EventEmitter {
  private services = new Map<ServiceName, ServiceState>([
    ["agents",    { process: null, status: "stopped", logs: [] }],
    ["langgraph", { process: null, status: "stopped", logs: [] }],
  ]);

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------

  async start(name: ServiceName): Promise<void> {
    const state = this.services.get(name)!;
    if (state.status === "running" || state.status === "starting") return;

    const { cmd, args } = SERVICE_CONFIG[name];

    this.setStatus(name, "starting");
    this.addLog(name, `▶ Starting ${name} (${cmd} ${args.join(" ")})…`, "stdout");

    const proc = spawn(cmd, args, {
      cwd: AGENTS_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
      windowsHide: true,
    });

    state.process = proc;

    const onData = (text: string, stream: "stdout" | "stderr") => {
      for (const line of text.split(/\r?\n/).filter(Boolean)) {
        this.addLog(name, line, stream);
        if (state.status === "starting" && READY_PATTERNS[name].test(line)) {
          this.setStatus(name, "running");
        }
      }
    };

    proc.stdout?.on("data", (d) => onData(String(d), "stdout"));
    proc.stderr?.on("data", (d) => onData(String(d), "stderr"));

    proc.on("exit", (code) => {
      state.process = null;
      this.setStatus(name, code === 0 || code === null ? "stopped" : "error");
      this.addLog(name, `Process exited (code ${code})`, "stderr");
    });

    proc.on("error", (err) => {
      state.process = null;
      this.setStatus(name, "error");
      this.addLog(name, `Spawn error: ${err.message}`, "stderr");
    });

    // Fallback: mark running after 8 s if still alive and still "starting"
    setTimeout(() => {
      if (this.services.get(name)?.process && this.services.get(name)?.status === "starting") {
        this.setStatus(name, "running");
      }
    }, 8000);
  }

  // ---------------------------------------------------------------------------
  // Stop / restart
  // ---------------------------------------------------------------------------

  stop(name: ServiceName): void {
    const state = this.services.get(name)!;
    if (state.process) {
      state.process.kill("SIGTERM");
      // Force-kill after 3 s on Windows
      setTimeout(() => {
        if (state.process) {
          try { state.process.kill("SIGKILL"); } catch {}
          state.process = null;
        }
      }, 3000);
    }
    state.process = null;
    this.setStatus(name, "stopped");
    this.addLog(name, "■ Stopped by user", "stdout");
  }

  restart(name: ServiceName): void {
    this.stop(name);
    setTimeout(() => this.start(name), 600);
  }

  // ---------------------------------------------------------------------------
  // Kill whatever is using a port (Windows: netstat + taskkill)
  // ---------------------------------------------------------------------------

  killPort(port: number): string[] {
    const killed: string[] = [];
    try {
      const out = execSync(`netstat -ano | findstr :${port}`, {
        encoding: "utf8",
        timeout: 3000,
      });
      const pids = [
        ...new Set(
          out
            .split("\n")
            .map((l) => l.trim().split(/\s+/).pop() ?? "")
            .filter((p) => /^\d+$/.test(p) && p !== "0"),
        ),
      ];
      for (const pid of pids) {
        try {
          execSync(`taskkill /PID ${pid} /F`, { encoding: "utf8", timeout: 2000 });
          killed.push(pid);
        } catch {}
      }
    } catch {}
    return killed;
  }

  // ---------------------------------------------------------------------------
  // Port reachability check (TCP connect)
  // ---------------------------------------------------------------------------

  checkPort(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const s = new net.Socket();
      s.setTimeout(400);
      s.on("connect", () => { s.destroy(); resolve(true); });
      s.on("error", () => resolve(false));
      s.on("timeout", () => { s.destroy(); resolve(false); });
      s.connect(port, "127.0.0.1");
    });
  }

  // ---------------------------------------------------------------------------
  // Accessors
  // ---------------------------------------------------------------------------

  getStatus(name: ServiceName): ServiceStatus {
    return this.services.get(name)!.status;
  }

  getLogBuffer(name: ServiceName): LogEntry[] {
    return [...(this.services.get(name)?.logs ?? [])];
  }

  // ---------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------

  private setStatus(name: ServiceName, status: ServiceStatus) {
    const s = this.services.get(name)!;
    s.status = status;
    this.emit(`status:${name}`, status);
  }

  private addLog(name: ServiceName, text: string, stream: "stdout" | "stderr") {
    const s = this.services.get(name)!;
    const entry: LogEntry = { text, ts: Date.now(), stream };
    s.logs.push(entry);
    if (s.logs.length > LOG_LIMIT) s.logs.shift();
    this.emit(`log:${name}`, entry);
  }
}

// Persist across HMR via globalThis
declare global {
  // eslint-disable-next-line no-var
  var __devPM: ProcessManager | undefined;
}

export function getProcessManager(): ProcessManager {
  if (!globalThis.__devPM) globalThis.__devPM = new ProcessManager();
  return globalThis.__devPM;
}

export const SERVICE_PORTS: Record<"nextjs" | ServiceName, number> = {
  nextjs: 3005,
  agents: 8000,
  langgraph: 2024,
};
