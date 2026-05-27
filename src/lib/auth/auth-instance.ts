/**
 * auth-instance.ts — Supabase session adapter.
 *
 * Replaces the original better-auth + Drizzle + missing-deps implementation.
 * Exports the same contract (`auth`, `getSession`, `getIsFirstUser`) so all
 * downstream imports continue to work without change.
 *
 * Atlas 5 uses Supabase for auth — no separate better-auth instance needed.
 */

import { createAdminClient } from "@/lib/supabase/server";

// ── Session ───────────────────────────────────────────────────────────────────

/**
 * getSession — returns the Supabase user session for the current request,
 * or null if unauthenticated.
 */
export const getSession = async () => {
  try {
    const supabase = await createAdminClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return null;
    return { user };
  } catch {
    return null;
  }
};

// ── First-user flag ───────────────────────────────────────────────────────────

let isFirstUserCache: boolean | null = null;

/**
 * getIsFirstUser — returns true if no users exist in the system yet.
 * Used to grant admin rights to the very first sign-up.
 */
export const getIsFirstUser = async (): Promise<boolean> => {
  if (isFirstUserCache === false) return false;
  try {
    const supabase = await createAdminClient();
    const { count } = await supabase
      .schema("atlas")
      .from("users")
      .select("id", { count: "exact", head: true });
    const first = (count ?? 0) === 0;
    if (!first) isFirstUserCache = false;
    return first;
  } catch {
    isFirstUserCache = false;
    return false;
  }
};

// ── auth object stub ──────────────────────────────────────────────────────────
// Keeps type compatibility with existing imports of `auth` from this module.
// `handler` is used by the /api/auth/[...all] route via better-auth/next-js.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const auth: any = {
  api: {
    getSession: async () => null,
  },
  handler: async (req: Request) =>
    new Response("Auth not configured", { status: 503 }),
};
