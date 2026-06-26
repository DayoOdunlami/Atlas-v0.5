#!/usr/bin/env node
/**
 * Apply idempotent SQL migrations under supabase/migrations/ to Postgres.
 * Uses POSTGRES_URL and DATABASE_URL from .env.local (deduped).
 *
 * Usage: node scripts/apply-atlas-migrations.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

dotenv.config({ path: path.join(root, ".env") });
dotenv.config({ path: path.join(root, ".env.local"), override: true });

const migrationsDir = path.join(root, "supabase", "migrations");

function normalizeUrl(raw) {
  return raw.replace(/[?&]sslmode=[^&]*/g, "");
}

function poolFor(url) {
  return new pg.Pool({
    connectionString: normalizeUrl(url),
    ssl:
      !url.includes("localhost") && !url.includes("127.0.0.1")
        ? { rejectUnauthorized: false }
        : false,
    max: 2,
  });
}

async function applyFile(pool, filePath) {
  const sql = fs.readFileSync(filePath, "utf8");
  await pool.query(sql);
}

async function verify(pool) {
  const { rows } = await pool.query(
    `SELECT
       to_regclass('atlas.threads') AS threads,
       to_regclass('atlas.turns') AS turns,
       to_regclass('atlas.canvas_scenes') AS canvas_scenes,
       to_regclass('atlas.briefs') AS briefs`,
  );
  return rows[0];
}

async function main() {
  const urls = [
    process.env.POSTGRES_URL,
    process.env.DATABASE_URL,
  ].filter(Boolean);

  const unique = [...new Set(urls.map(normalizeUrl))];
  if (unique.length === 0) {
    console.error("No POSTGRES_URL or DATABASE_URL in environment.");
    process.exit(1);
  }

  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  console.log(`Applying ${files.length} migration(s) to ${unique.length} target(s)…`);

  for (const url of unique) {
    const label = url.includes("pooler") ? "Supabase pooler" : "Postgres";
    const pool = poolFor(url);
    try {
      for (const file of files) {
        const fp = path.join(migrationsDir, file);
        process.stdout.write(`  [${label}] ${file} … `);
        await applyFile(pool, fp);
        console.log("ok");
      }
      const v = await verify(pool);
      console.log(`  [${label}] verify:`, v);
    } catch (err) {
      console.error(`  [${label}] FAILED:`, err instanceof Error ? err.message : err);
      process.exitCode = 1;
    } finally {
      await pool.end();
    }
  }

  if (process.exitCode) {
    process.exit(process.exitCode);
  }
  console.log("All migrations applied.");
}

main();
