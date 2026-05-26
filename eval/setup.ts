/**
 * Atlas 5 — Vitest global setup for Tier 1 eval tests
 *
 * Loads environment variables from .env before any test runs,
 * so D2+ tests that call Supabase have the necessary credentials.
 * This mirrors what `dotenv --` does for other test scripts.
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Load from .env.local first, then .env (same precedence as Next.js)
const root = process.cwd();
for (const file of [".env.local", ".env"]) {
  const envPath = join(root, file);
  if (existsSync(envPath)) {
    config({ path: envPath });
    break;
  }
}
