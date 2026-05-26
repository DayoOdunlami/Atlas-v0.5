#!/usr/bin/env tsx
/**
 * Seed the JARVIS agent for Innovation Atlas.
 *
 * Finds the first admin user in the database and creates (or updates) a
 * public JARVIS agent owned by that user.
 *
 * If no admin user exists yet, pass --bootstrap to create a seed admin
 * account, then JARVIS, in one step (no need to open the app first):
 *
 *   pnpm seed:jarvis --bootstrap --email admin@example.com --password S3cret!
 *
 * Otherwise (after signing up via the app UI):
 *   pnpm seed:jarvis
 */

import "load-env";
import type { MCPServerConfig, McpServerInsert } from "app-types/mcp";
import { auth } from "auth/auth-instance";
import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { ATLAS_SYSTEM_PROMPT } from "lib/ai/prompts/atlas-strategist";
import { HYVE_SYSTEM_PROMPT } from "lib/ai/prompts/hyve";
import { JARVIS_SYSTEM_PROMPT } from "lib/ai/prompts/jarvis";
import { AgentTable, UserTable } from "lib/db/pg/schema.pg";
import { mcpRepository } from "lib/db/repository";
import { generateUUID } from "lib/utils";
import { Pool } from "pg";

const SUPABASE_HIVE_MCP_SERVER_INSTRUCTIONS =
  "READ ONLY. SELECT queries only on hive schema. NEVER INSERT, UPDATE, DELETE, or ALTER any records. This is a live DfT-commissioned production database.";

const SUPABASE_ATLAS_MCP_SERVER_INSTRUCTIONS =
  "READ ONLY. SELECT queries only on atlas schema. NEVER INSERT, UPDATE, DELETE, or ALTER. " +
  "Correct column names on atlas.projects: id, title, abstract, lead_funder, lead_org_name, " +
  "funding_amount, start_date, end_date, research_topics[], embedding, transport_relevance_score, viz_x, viz_y. " +
  "Never use lead_org (column does not exist); always use lead_org_name for the lead organisation name.";

// ────────────────────────────────────────────────────────────────────────────
// JARVIS agent instructions — supabase-atlas attached as mcpServer mention
// serverId for file-based MCP = the server name itself
// ────────────────────────────────────────────────────────────────────────────
const JARVIS_INSTRUCTIONS = {
  role: "strategic intelligence assistant for cross-sector transport innovation",
  systemPrompt: JARVIS_SYSTEM_PROMPT,
  mentions: [
    {
      type: "mcpServer" as const,
      name: "supabase-atlas",
      description:
        "Direct SQL access to Supabase atlas schema: atlas.projects (622), atlas.organisations (319), atlas.project_edges (shared_org, shared_topic, semantic), atlas.lens_categories (14), passports, claims, matches. NEVER touch hive.* or public.*. " +
        SUPABASE_ATLAS_MCP_SERVER_INSTRUCTIONS,
      serverId: "supabase-atlas",
    },
  ],
};

const ATLAS_INSTRUCTIONS = {
  role: "CPC strategic intelligence agent for landscape exploration",
  systemPrompt: ATLAS_SYSTEM_PROMPT,
  mentions: [
    {
      type: "mcpServer" as const,
      name: "supabase-atlas",
      description:
        "Direct SQL access to Supabase atlas schema: atlas.projects (622), atlas.organisations (319), atlas.project_edges, atlas.live_calls, atlas.project_outcomes, atlas.lens_categories (14). NEVER touch hive.* or public.*. " +
        SUPABASE_ATLAS_MCP_SERVER_INSTRUCTIONS,
      serverId: "supabase-atlas",
    },
  ],
};

// supabase-hive — same Supabase Postgres project as Atlas; use DATABASE_URL (not HIVE_SUPABASE_*).
// For Cursor MCP / .mcp-config.json, set serverInstructions exactly as below (read-only contract).

const HYVE_INSTRUCTIONS = {
  role: "climate adaptation intelligence — HIVE evidence, Atlas funding corpus, academic research",
  systemPrompt: HYVE_SYSTEM_PROMPT,
  mentions: [
    {
      type: "mcpServer" as const,
      name: "supabase-hive",
      description: `${SUPABASE_HIVE_MCP_SERVER_INSTRUCTIONS} Query hive.articles, hive.document_chunks, hive.sources, hive.options. Always use hive.* schema qualification. NEVER atlas.* or public.* on this connection.`,
      serverId: "supabase-hive",
    },
    {
      type: "mcpServer" as const,
      name: "supabase-atlas",
      description:
        "Innovation Atlas corpus: atlas.projects, atlas.organisations, atlas.project_edges, atlas.live_calls, atlas.project_outcomes, atlas.lens_categories. NEVER hive.* or public.*. " +
        SUPABASE_ATLAS_MCP_SERVER_INSTRUCTIONS,
      serverId: "supabase-atlas",
    },
  ],
};

// ────────────────────────────────────────────────────────────────────────────
// DB connection — same SSL fix as db.pg.ts
// ────────────────────────────────────────────────────────────────────────────
const rawUrl = process.env.POSTGRES_URL!;
const connectionString = rawUrl.replace(/[?&]sslmode=[^&]*/g, "");
const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
const db = drizzle(pool);

// Parse CLI args for optional bootstrap mode
const args = process.argv.slice(2);
const bootstrap = args.includes("--bootstrap");
const emailArg =
  args[args.indexOf("--email") + 1] ?? "admin@innovation-atlas.local";
const passwordArg = args[args.indexOf("--password") + 1] ?? "ChangeMe123!";

async function ensureAdminUser(): Promise<{
  id: string;
  email: string;
  role: string;
}> {
  const admins = await db
    .select({ id: UserTable.id, email: UserTable.email, role: UserTable.role })
    .from(UserTable)
    .where(eq(UserTable.role, "admin"))
    .orderBy(asc(UserTable.createdAt))
    .limit(1);

  if (admins.length > 0) return admins[0];

  if (!bootstrap) {
    console.error(`
❌ No admin user found.

Options:
  1. Open the app (pnpm dev), sign up, then re-run: pnpm seed:jarvis
  2. Bootstrap without opening the app:
       pnpm seed:jarvis --bootstrap --email you@example.com --password S3cret!
`);
    process.exit(1);
  }

  console.log(`🔑 --bootstrap: creating admin user ${emailArg}…`);
  const result = await auth.api.signUpEmail({
    body: { email: emailArg, password: passwordArg, name: "Atlas Admin" },
    headers: new Headers({ "content-type": "application/json" }),
  });
  if (!result?.user) throw new Error("Bootstrap sign-up failed");

  // First user is already set to admin by the auth hook; confirm
  const [newAdmin] = await db
    .select({ id: UserTable.id, email: UserTable.email, role: UserTable.role })
    .from(UserTable)
    .where(eq(UserTable.id, result.user.id));

  console.log(
    `✅ Admin created: ${newAdmin.email} (role: ${newAdmin.role}) — CHANGE THIS PASSWORD before production`,
  );
  return newAdmin;
}

/**
 * DB-backed MCP registration (same persistence as POST /api/mcp → saveMcpClientAction
 * → mcpClientsManager.persistClient → mcpRepository.save).
 * Config matches Master Handoff stdio postgres MCP; connection URI is resolved from env
 * (same as app db.pg.ts — literal "${DATABASE_URL}" is not executable by npx).
 */
async function ensureSupabaseHiveMcpServer(adminUserId: string): Promise<void> {
  const raw =
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    (() => {
      throw new Error(
        "POSTGRES_URL or DATABASE_URL is required to register supabase-hive MCP.",
      );
    })();
  const pooled = raw.replace(/[?&]sslmode=[^&]*/g, "");

  const config = {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", pooled],
    env: { NODE_TLS_REJECT_UNAUTHORIZED: "0" },
    serverInstructions: SUPABASE_HIVE_MCP_SERVER_INSTRUCTIONS,
  } as unknown as MCPServerConfig;

  const existing = await mcpRepository.selectByServerName("supabase-hive");
  const row: McpServerInsert = {
    name: "supabase-hive",
    config,
    userId: adminUserId,
    visibility: "public",
    ...(existing ? { id: existing.id } : {}),
  };

  const saved = await mcpRepository.save(row);
  const verify = await mcpRepository.selectByServerName("supabase-hive");
  if (!verify?.id) {
    throw new Error("supabase-hive MCP was not persisted to mcp_server.");
  }
  console.log(
    `✅ MCP server supabase-hive ${existing ? "updated" : "created"} (id: ${saved.id}, visibility: ${saved.visibility})`,
  );
}

async function ensureSupabaseAtlasMcpServer(
  adminUserId: string,
): Promise<void> {
  const raw =
    process.env.POSTGRES_URL ??
    process.env.DATABASE_URL ??
    (() => {
      throw new Error(
        "POSTGRES_URL or DATABASE_URL is required to register supabase-atlas MCP.",
      );
    })();
  const pooled = raw.replace(/[?&]sslmode=[^&]*/g, "");

  const config = {
    command: "npx",
    args: ["-y", "@modelcontextprotocol/server-postgres", pooled],
    env: { NODE_TLS_REJECT_UNAUTHORIZED: "0" },
    serverInstructions: SUPABASE_ATLAS_MCP_SERVER_INSTRUCTIONS,
  } as unknown as MCPServerConfig;

  const existing = await mcpRepository.selectByServerName("supabase-atlas");
  const row: McpServerInsert = {
    name: "supabase-atlas",
    config,
    userId: adminUserId,
    visibility: "public",
    ...(existing ? { id: existing.id } : {}),
  };

  const saved = await mcpRepository.save(row);
  const verify = await mcpRepository.selectByServerName("supabase-atlas");
  if (!verify?.id) {
    throw new Error("supabase-atlas MCP was not persisted to mcp_server.");
  }
  console.log(
    `✅ MCP server supabase-atlas ${existing ? "updated" : "created"} (id: ${saved.id}, visibility: ${saved.visibility})`,
  );
}

async function seedJarvis() {
  console.log("🤖 Seeding JARVIS agent for Innovation Atlas…");

  const admin = await ensureAdminUser();
  console.log(`✅ Using admin: ${admin.email} (${admin.id})`);

  await ensureSupabaseHiveMcpServer(admin.id);
  await ensureSupabaseAtlasMcpServer(admin.id);

  const upsertPublicAgent = async (opts: {
    name: string;
    description: string;
    iconValue: string;
    iconBackgroundColor: string;
    instructions: typeof JARVIS_INSTRUCTIONS;
  }) => {
    const existing = await db
      .select({ id: AgentTable.id })
      .from(AgentTable)
      .where(eq(AgentTable.name, opts.name));

    if (existing.length > 0) {
      await db
        .update(AgentTable)
        .set({
          instructions: opts.instructions,
          description: opts.description,
          icon: {
            type: "emoji" as const,
            value: opts.iconValue,
            style: {
              backgroundColor: opts.iconBackgroundColor,
              color: "#FFFFFF",
            },
          },
          visibility: "public",
          updatedAt: new Date(),
        })
        .where(eq(AgentTable.name, opts.name));
      return { id: existing[0].id, action: "Updated" as const };
    }

    const [inserted] = await db
      .insert(AgentTable)
      .values({
        id: generateUUID(),
        name: opts.name,
        description: opts.description,
        icon: {
          type: "emoji" as const,
          value: opts.iconValue,
          style: {
            backgroundColor: opts.iconBackgroundColor,
            color: "#FFFFFF",
          },
        },
        userId: admin.id,
        instructions: opts.instructions,
        visibility: "public",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning({ id: AgentTable.id });

    return { id: inserted.id, action: "Created" as const };
  };

  const jarvisResult = await upsertPublicAgent({
    name: "JARVIS",
    description:
      "Innovation Atlas strategic intelligence assistant. Upload evidence → extract claims → match against GtR corpus → surface cross-sector funding → gap analysis → draft pitch.",
    iconValue: "🤖",
    iconBackgroundColor: "#006E51",
    instructions: JARVIS_INSTRUCTIONS,
  });

  console.log(
    `✅ ${jarvisResult.action} JARVIS agent (id: ${jarvisResult.id})`,
  );

  const atlasResult = await upsertPublicAgent({
    name: "ATLAS",
    description:
      "CPC Strategic Intelligence — landscape exploration, cross-sector synthesis, strategic positioning.",
    iconValue: "⚡",
    iconBackgroundColor: "#0F766E",
    instructions: ATLAS_INSTRUCTIONS,
  });

  console.log(`✅ ${atlasResult.action} ATLAS agent (id: ${atlasResult.id})`);

  const hyveResult = await upsertPublicAgent({
    name: "HYVE",
    description:
      "Climate adaptation intelligence — HIVE case studies and guidance, Atlas GtR corpus, OpenAlex research, and live web context.",
    iconValue: "🌿",
    iconBackgroundColor: "#166534",
    instructions: HYVE_INSTRUCTIONS,
  });

  console.log(`✅ ${hyveResult.action} HYVE agent (id: ${hyveResult.id})`);

  // Check if JARVIS already exists for this admin
  const existing = await db
    .select({ id: AgentTable.id })
    .from(AgentTable)
    .where(eq(AgentTable.name, "JARVIS"));

  if (existing.length === 0) throw new Error("Failed to create JARVIS agent");

  console.log(`
📋 Public agents (JARVIS, ATLAS, HYVE) are ready.

  • Visibility: public (all users can see and use JARVIS, ATLAS, and HYVE)
  • Model to select in chat: anthropic / sonnet-4-6 (claude-sonnet-4-6)
  • MCP: supabase-atlas (atlas.*) — JARVIS, ATLAS, HYVE
  • MCP: supabase-hive (hive.*, READ ONLY) — HYVE only; same DATABASE_URL as Atlas
  • supabase-hive serverInstructions (verbatim for MCP config):
    ${SUPABASE_HIVE_MCP_SERVER_INSTRUCTIONS}
  • supabase-atlas serverInstructions (verbatim for MCP config):
    ${SUPABASE_ATLAS_MCP_SERVER_INSTRUCTIONS}
  • To switch from file-based MCP to DB-based: add MCP servers via the app UI,
    then set FILE_BASED_MCP_CONFIG=false in .env
`);
}

seedJarvis()
  .then(() => pool.end())
  .then(() => process.exit(0))
  .catch(async (err) => {
    console.error("❌ JARVIS seed failed:", err);
    await pool.end();
    process.exit(1);
  });
