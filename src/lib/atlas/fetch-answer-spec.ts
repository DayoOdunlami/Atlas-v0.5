import "server-only";

import {
  validateFinalAnswerSpec,
  formatZodError,
  type AnswerSpec,
} from "@/lib/atlas/contracts/answer-spec.schema";
import { buildJ1T1SpecFromCorpus } from "@/lib/atlas/build-j1t1-spec";
import { loadJ1T1Golden } from "@/lib/atlas/golden-j1t1";

export type AnswerSpecSource = "brain" | "mouth" | "golden";

const J1T1_BRAIN_PATH = "/atlas-v5/j1t1";

export async function fetchAnswerSpecForPage(
  query?: string,
): Promise<{
  spec: AnswerSpec | null;
  dataSource: AnswerSpecSource;
}> {
  const agentsUrl = process.env.PYTHON_AGENTS_URL?.replace(/\/$/, "");
  const bootstrapQuery = query?.trim();

  // Entry → /atlas/session?q=… : CopilotKit owns the first turn on the client.
  // Do NOT fall back to the rail J1T1 demo canvas when the query is chat-first.
  if (bootstrapQuery) {
    return { spec: null, dataSource: "brain" };
  }

  if (agentsUrl) {
    try {
      const res = await fetch(`${agentsUrl}${J1T1_BRAIN_PATH}`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const payload = await res.json();
        const validated = validateFinalAnswerSpec(payload);
        if (validated.success) {
          return { spec: validated.data, dataSource: "brain" };
        }
        console.warn(
          "[/atlas] Brain AnswerSpec failed Zod validation:",
          formatZodError(validated.error),
        );
      } else {
        console.warn(`[/atlas] Brain fetch ${res.status}`);
      }
    } catch (err) {
      console.warn("[/atlas] Brain fetch failed:", err);
    }
  }

  try {
    const spec = await buildJ1T1SpecFromCorpus();
    return { spec, dataSource: "mouth" };
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[/atlas] Mouth bootstrap failed, using golden:", err);
      return { spec: loadJ1T1Golden(), dataSource: "golden" };
    }
    throw err;
  }
}
