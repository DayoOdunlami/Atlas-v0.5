import { expect, type APIRequestContext, type Page } from "@playwright/test";

import {
  DEFAULT_DEV_ADMIN_BYPASS,
  DEFAULT_DEV_GUEST_BYPASS,
} from "../../../src/lib/auth/dev-test-login";

export type DevBypassRole = "admin" | "guest";

function bypassPassword(role: DevBypassRole): string {
  if (role === "admin") {
    return process.env.DEV_ADMIN_BYPASS_PASSWORD?.trim() || DEFAULT_DEV_ADMIN_BYPASS;
  }
  return process.env.DEV_GUEST_BYPASS_PASSWORD?.trim() || DEFAULT_DEV_GUEST_BYPASS;
}

/**
 * Establish a Better Auth session via POST /api/auth/dev-bypass (non-production only).
 * Uses page.request so Set-Cookie applies to subsequent page navigations.
 */
export async function loginViaDevBypass(
  page: Page,
  role: DevBypassRole = "guest",
): Promise<void> {
  const res = await page.request.post("/api/auth/dev-bypass", {
    data: { role, password: bypassPassword(role) },
  });
  expect(res.status(), await res.text()).toBe(200);
  const body = (await res.json()) as { ok?: boolean };
  expect(body.ok).toBe(true);
}

/**
 * E2E cookie session via x-tool-secret (works when better-auth is stubbed).
 * Requires ALLOW_E2E_AUTH_COOKIE=true and BETTER_AUTH_SECRET in .env.local.
 */
function e2eToolSecret(): string {
  return (
    process.env.BETTER_AUTH_SECRET ??
    process.env.E2E_TOOL_SECRET ??
    "atlas-playwright-e2e"
  );
}

export async function loginViaE2eToolSecret(page: Page): Promise<void> {
  const secret = e2eToolSecret();
  const res = await page.request.post("/api/test/e2e-bypass", {
    headers: { "x-tool-secret": secret },
  });
  expect(res.status(), await res.text()).toBe(200);
  const body = (await res.json()) as { ok?: boolean };
  expect(body.ok).toBe(true);
}

/**
 * Prefer dev-bypass when better-auth + POSTGRES public.user are wired; else E2E tool secret.
 */
export async function loginForPlaywright(page: Page): Promise<void> {
  const bypass = await page.request.post("/api/auth/dev-bypass", {
    data: { role: "guest", password: bypassPassword("guest") },
  });
  if (bypass.status() === 200) {
    const body = (await bypass.json()) as { ok?: boolean };
    if (body.ok) return;
  }
  await loginViaE2eToolSecret(page);
}

/**
 * Same as loginViaDevBypass but for APIRequestContext-only setups.
 */
export async function loginViaDevBypassRequest(
  request: APIRequestContext,
  baseURL: string,
  role: DevBypassRole = "guest",
): Promise<void> {
  const res = await request.post(`${baseURL}/api/auth/dev-bypass`, {
    data: { role, password: bypassPassword(role) },
  });
  expect(res.status(), await res.text()).toBe(200);
}

/**
 * Internal tool auth header for server-side routes (passport describe/preview, etc.).
 */
export function toolSecretHeaders(): Record<string, string> {
  return { "x-tool-secret": e2eToolSecret() };
}
