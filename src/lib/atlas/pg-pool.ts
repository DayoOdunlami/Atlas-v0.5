import "server-only";

import { Pool } from "pg";

let _pool: Pool | null = null;

/** Shared Postgres pool for atlas schema (threads, canvas_scenes, etc.). */
export function getAtlasPgPool(): Pool {
  if (_pool) return _pool;
  const raw = process.env.POSTGRES_URL ?? process.env.DATABASE_URL ?? "";
  if (!raw) {
    throw new Error("POSTGRES_URL or DATABASE_URL is required");
  }
  const url = raw.replace(/[?&]sslmode=[^&]*/g, "");
  _pool = new Pool({
    connectionString: url,
    ssl: !url.includes("localhost") && !url.includes("127.0.0.1")
      ? { rejectUnauthorized: false }
      : false,
    max: 5,
  });
  return _pool;
}

export function isAtlasPgConfigured(): boolean {
  return Boolean(process.env.POSTGRES_URL ?? process.env.DATABASE_URL);
}
