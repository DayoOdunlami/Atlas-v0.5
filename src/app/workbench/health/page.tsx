"use client";

import { useEffect, useState } from "react";

type HealthPayload = {
  ok?: boolean;
  agents?: {
    ok: boolean;
    corpus?: boolean;
    detail?: string;
    transport?: string;
    orchestrator_v1?: boolean;
  };
  flags?: {
    ATLAS5_ORCHESTRATOR_V1?: boolean;
    NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1?: boolean;
  };
  error?: string;
};

export default function WorkbenchHealthPage() {
  const [data, setData] = useState<HealthPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/workbench/health");
        const json = (await res.json()) as HealthPayload;
        if (!res.ok) {
          setError(json.error ?? `HTTP ${res.status}`);
        }
        setData(json);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Health check failed");
      }
    }
    load();
  }, []);

  const allGreen = data?.ok === true;

  return (
    <main className="mx-auto max-w-xl p-8 font-sans">
      <h1 className="text-2xl font-semibold mb-2">Workbench health</h1>
      <p className="text-muted-foreground mb-6">
        MVP pre-flight — agents, corpus, orchestrator flags (via server proxy).
      </p>
      {error && <p className="text-red-600">{error}</p>}
      {data && (
        <ul className="space-y-2 text-sm">
          <li>
            Agents service: <Status ok={!!data.agents?.ok} />
          </li>
          <li>
            Corpus transport: <Status ok={!!data.agents?.corpus} />
            {data.agents?.transport && (
              <span className="text-muted-foreground ml-2">({data.agents.transport})</span>
            )}
            {data.agents?.detail && (
              <span className="text-muted-foreground ml-2">{data.agents.detail}</span>
            )}
          </li>
          <li>
            Orchestrator (Python):{" "}
            <Status ok={!!data.agents?.orchestrator_v1} />
          </li>
          <li>
            ATLAS5_ORCHESTRATOR_V1:{" "}
            <Status ok={!!data.flags?.ATLAS5_ORCHESTRATOR_V1} />
          </li>
          <li>
            NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1:{" "}
            <Status ok={!!data.flags?.NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1} />
          </li>
          <li className="pt-4 font-medium">
            Overall:{" "}
            <Status ok={!!allGreen} label={allGreen ? "MVP-ready" : "Not ready"} />
          </li>
        </ul>
      )}
    </main>
  );
}

function Status({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className={ok ? "text-green-700" : "text-amber-700"}>
      {label ?? (ok ? "OK" : "FAIL")}
    </span>
  );
}
