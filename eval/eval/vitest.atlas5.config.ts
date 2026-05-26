/**
 * Vitest config for Atlas 5 Tier 1 mechanical checks.
 *
 * Separate from the main vitest.config.ts so Atlas 5 eval does not
 * interfere with existing Brief v2 tests and vice versa.
 *
 * Run: npx vitest run --config eval/vitest.atlas5.config.ts
 * Or:  npm run eval:tier1
 */
import path from "node:path";
import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
// rootDir is the /eval directory; project root is one level up
const projectRoot = path.resolve(rootDir, "..");

export default defineConfig({
  plugins: [
    // Pin to the project-root tsconfig only — prevents tsconfck from crawling
    // into .claude/worktrees/ and hitting stale Svelte/Vue/Expo tsconfigs.
    tsconfigPaths({ projects: [path.join(projectRoot, "tsconfig.json")] }),
  ],
  resolve: {
    alias: [
      // Stub `server-only` so server-side lib modules can be imported in tests
      {
        find: "server-only",
        replacement: path.join(
          projectRoot,
          "src/test-utils/server-only-stub.ts",
        ),
      },
      // Stub `next/headers` for any modules that use cookies/headers
      {
        find: /^next\/headers$/,
        replacement: path.join(
          projectRoot,
          "src/test-utils/next-headers-stub.ts",
        ),
      },
    ],
  },
  test: {
    name: "atlas5-tier1",
    // Only run files in eval/ that match *.test.ts (not Playwright *.spec.ts)
    include: ["eval/**/*.test.ts"],
    exclude: ["eval/**/*.spec.ts", "node_modules/**", ".claude/**"],
    environment: "node",
    reporters: ["verbose"],
    // Load dotenv and other global setup before any test file
    setupFiles: ["eval/setup.ts"],
    globals: false,
    // Allow each test to run for up to 30s (Supabase queries at D2+)
    testTimeout: 30_000,
    // Fail fast is OFF — show all failures so we see the full tier1 picture
    bail: 0,
    // D2+ imports lib/atlas5/* which uses better-auth internally
    server: {
      deps: {
        inline: ["better-auth"],
      },
    },
  },
});
