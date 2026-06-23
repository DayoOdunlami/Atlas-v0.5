import "server-only";

import { assembleJ1T1Spec } from "@/lib/atlas/j1t1-spec-assembler";
import { fetchJ1T1CorpusStats } from "@/lib/atlas/j1t1-query";
import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";

export async function buildJ1T1SpecFromCorpus(): Promise<AnswerSpec> {
  const stats = await fetchJ1T1CorpusStats();
  return assembleJ1T1Spec(stats);
}
