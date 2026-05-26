/**
 * Atlas 5 — server-only Supabase client.
 *
 * SECURITY:
 * - This file imports "server-only" — Next.js will throw if it is
 *   imported by a client component, preventing key leakage.
 * - SUPABASE_SERVICE_KEY must NEVER appear in .next/static/.
 * - All queries MUST use explicit schema: supabase.schema('atlas') or
 *   supabase.schema('hive'). Never supabase.from() without a schema.
 */
import "server-only";

import { createAdminClient } from "@/lib/supabase/server";

/**
 * Returns a Supabase admin client scoped to the atlas schema.
 * Use this in Atlas 5 server routes and context assembler.
 *
 * Example:
 *   const { data } = await atlasClient()
 *     .schema('atlas')
 *     .from('projects')
 *     .select('id, title')
 *     .limit(10);
 */
export function atlasClient() {
  return createAdminClient();
}
