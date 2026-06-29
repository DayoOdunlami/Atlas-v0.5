import "server-only";

import { getSession } from "@/lib/auth/server";
import { isAtlasPgConfigured } from "@/lib/atlas/pg-pool";

const DEV_OWNER_FALLBACK = "00000000-0000-0000-0000-000000000001";

function devThreadsEnabled(): boolean {
  const flag = process.env.ATLAS_V5_THREADS_DEV_OPEN?.trim().toLowerCase();
  if (flag === "0" || flag === "false") return false;
  if (flag === "1" || flag === "true") return true;
  // Vercel preview URLs: persist without login when Postgres is configured.
  if (process.env.VERCEL_ENV === "preview" && isAtlasPgConfigured()) {
    return true;
  }
  // Local dev: persist when Postgres is configured unless explicitly disabled.
  return process.env.NODE_ENV === "development" && isAtlasPgConfigured();
}

/** Resolve owner for atlas.threads — session user or dev fallback when enabled. */
export async function resolveThreadOwnerId(): Promise<string | null> {
  const session = await getSession();
  if (session?.user?.id) return session.user.id;

  if (devThreadsEnabled()) {
    return process.env.ATLAS_V5_DEV_OWNER_ID ?? DEV_OWNER_FALLBACK;
  }

  return null;
}

export async function resolveThreadAuthMeta(): Promise<{
  ownerId: string | null;
  configured: boolean;
  authorized: boolean;
}> {
  const configured = isAtlasPgConfigured();
  const ownerId = await resolveThreadOwnerId();
  return {
    ownerId,
    configured,
    authorized: Boolean(ownerId),
  };
}
