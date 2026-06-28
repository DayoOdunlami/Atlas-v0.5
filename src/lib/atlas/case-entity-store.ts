import "server-only";

import { getAtlasPgPool } from "@/lib/atlas/pg-pool";
import type { CaseEntitySummary } from "@/lib/atlas/case-file-types";
import { copySessionClaimsToEntity } from "@/lib/atlas/case-file-store";

export type CaseEntityRow = {
  id: string;
  owner_id: string;
  title: string;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export async function listCaseEntities(ownerId: string): Promise<CaseEntitySummary[]> {
  const pool = getAtlasPgPool();
  const result = await pool.query<CaseEntitySummary>(
    `SELECT e.id, e.title, e.created_at, e.updated_at,
            COALESCE(c.cnt, 0)::int AS claim_count
     FROM atlas.case_entities e
     LEFT JOIN LATERAL (
       SELECT COUNT(*) AS cnt
       FROM atlas.claims
       WHERE entity_type = 'case_entity' AND entity_id = e.id::text AND source = 'declared'
     ) c ON true
     WHERE e.owner_id = $1::uuid AND e.archived_at IS NULL
     ORDER BY e.updated_at DESC
     LIMIT 50`,
    [ownerId],
  );
  return result.rows;
}

export async function createCaseEntity(
  ownerId: string,
  title: string,
  fromThreadId?: string | null,
): Promise<CaseEntityRow> {
  const pool = getAtlasPgPool();
  const result = await pool.query<CaseEntityRow>(
    `INSERT INTO atlas.case_entities (owner_id, title)
     VALUES ($1::uuid, $2)
     RETURNING id, owner_id, title, created_at, updated_at, archived_at`,
    [ownerId, title.trim() || "Untitled case"],
  );
  const entity = result.rows[0];
  if (fromThreadId) {
    await copySessionClaimsToEntity(fromThreadId, entity.id);
    await attachThreadToEntity(fromThreadId, entity.id, ownerId);
  }
  return entity;
}

export async function getThreadCaseEntityId(threadId: string): Promise<string | null> {
  const pool = getAtlasPgPool();
  try {
    const result = await pool.query<{ case_entity_id: string | null }>(
      `SELECT case_entity_id::text
       FROM atlas.threads
       WHERE id = $1::uuid`,
      [threadId],
    );
    return result.rows[0]?.case_entity_id ?? null;
  } catch {
    return null;
  }
}

export async function attachThreadToEntity(
  threadId: string,
  entityId: string,
  ownerId: string,
): Promise<void> {
  const pool = getAtlasPgPool();
  const check = await pool.query(
    `UPDATE atlas.threads t
     SET case_entity_id = $2::uuid, updated_at = now()
     FROM atlas.case_entities e
     WHERE t.id = $1::uuid AND t.owner_id = $3::uuid
       AND e.id = $2::uuid AND e.owner_id = $3::uuid AND e.archived_at IS NULL`,
    [threadId, entityId, ownerId],
  );
  if (check.rowCount === 0) {
    throw new Error("Thread or entity not found");
  }
}

export async function archiveCaseEntity(entityId: string, ownerId: string): Promise<void> {
  const pool = getAtlasPgPool();
  await pool.query(
    `UPDATE atlas.case_entities
     SET archived_at = now(), updated_at = now()
     WHERE id = $1::uuid AND owner_id = $2::uuid`,
    [entityId, ownerId],
  );
  await pool.query(
    `UPDATE atlas.threads
     SET case_entity_id = NULL, updated_at = now()
     WHERE case_entity_id = $1::uuid AND owner_id = $2::uuid`,
    [entityId, ownerId],
  );
}

export async function promoteThreadToEntity(
  threadId: string,
  ownerId: string,
  title: string,
): Promise<CaseEntityRow> {
  const existing = await getThreadCaseEntityId(threadId);
  if (existing) {
    const pool = getAtlasPgPool();
    const result = await pool.query<CaseEntityRow>(
      `SELECT id, owner_id, title, created_at, updated_at, archived_at
       FROM atlas.case_entities
       WHERE id = $1::uuid AND owner_id = $2::uuid`,
      [existing, ownerId],
    );
    if (result.rows[0]) return result.rows[0];
  }
  return createCaseEntity(ownerId, title, threadId);
}
