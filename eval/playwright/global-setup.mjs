/**
 * Playwright global setup — align E2E auth env with the running Next.js dev server.
 * Use the same secret the server accepts (BETTER_AUTH_SECRET or E2E_TOOL_SECRET fallback).
 */
export default async function globalSetup() {
  if (!process.env.ALLOW_E2E_AUTH_COOKIE) {
    process.env.ALLOW_E2E_AUTH_COOKIE = "true";
  }
  if (!process.env.BETTER_AUTH_SECRET && !process.env.E2E_TOOL_SECRET) {
    process.env.E2E_TOOL_SECRET = "atlas-playwright-e2e";
  }
  if (!process.env.ATLAS_OBJECT_ROUTING_V1) {
    process.env.ATLAS_OBJECT_ROUTING_V1 = "true";
  }
}
