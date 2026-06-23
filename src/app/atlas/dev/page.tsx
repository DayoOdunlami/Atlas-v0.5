import { AtlasSpineSmokeFromGolden } from "@/components/atlas/atlas-spine-smoke";
import { validateGoldenFixture } from "@/lib/atlas/golden-j1t1";
import { atlasTokens as T } from "@/lib/atlas/tokens";

export const metadata = {
  title: "Atlas v5 — GATE 0b spine smoke",
  description: "Trust primitives against J1T1 golden fixture",
};

export default function AtlasDevPage() {
  const validation = validateGoldenFixture();

  return (
    <div
      data-testid="atlas-dev-root"
      className="min-h-screen px-6 py-10 md:px-10"
      style={{ background: T.page }}
    >
      <div className="mx-auto max-w-4xl">
        {!validation.ok ? (
          <div
            data-testid="atlas-dev-validation-error"
            className="mb-6 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900"
          >
            <p className="font-semibold">Golden fixture failed Zod validation</p>
            <ul className="mt-2 list-disc pl-5">
              {validation.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </div>
        ) : (
        <p
          data-testid="atlas-dev-validation-ok"
          className="mb-6 rounded-lg border px-3 py-2 text-xs"
          style={{ borderColor: T.corpus, color: T.corpus, background: T.corpusWash, fontFamily: "var(--font-atlas-mono)" }}
        >
          ✓ j1t1-rail-decarb.golden.json · AnswerSpec v0.2.1 valid ·{" "}
          <a href="/atlas" className="underline">
            GATE 1 product surface →
          </a>
        </p>
        )}
        <AtlasSpineSmokeFromGolden />
      </div>
    </div>
  );
}
