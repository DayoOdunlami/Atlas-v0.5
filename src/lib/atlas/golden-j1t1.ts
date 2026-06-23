import goldenRaw from "../../../contracts/atlas-v5/fixtures/j1t1-rail-decarb.golden.json";
import {
  AnswerSpecSchema,
  validateFinalAnswerSpec,
  type AnswerSpec,
} from "@/lib/atlas/contracts/answer-spec.schema";

/** GATE 0b golden fixture — corpus stress-test verified J1T1 */
export function loadJ1T1Golden(): AnswerSpec {
  const result = validateFinalAnswerSpec(goldenRaw);
  if (!result.success) {
    throw new Error(
      `J1T1 golden fixture invalid: ${result.error.issues.map((i) => i.message).join("; ")}`,
    );
  }
  return result.data;
}

export function validateGoldenFixture(): { ok: boolean; issues: string[] } {
  const result = AnswerSpecSchema.safeParse(goldenRaw);
  if (result.success) return { ok: true, issues: [] };
  return {
    ok: false,
    issues: result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
  };
}
