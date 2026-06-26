import "server-only";

import { getSession } from "@/lib/auth/server";

const DEV_OWNER_FALLBACK = "00000000-0000-0000-0000-000000000001";

/** Resolve owner for atlas.threads — session user or dev fallback when enabled. */
export async function resolveThreadOwnerId(): Promise<string | null> {
  const session = await getSession();
  if (session?.user?.id) return session.user.id;

  if (
    process.env.NODE_ENV === "development" &&
    process.env.ATLAS_V5_THREADS_DEV_OPEN === "1"
  ) {
    return process.env.ATLAS_V5_DEV_OWNER_ID ?? DEV_OWNER_FALLBACK;
  }

  return null;
}
