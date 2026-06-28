import "server-only";

import { randomUUID } from "crypto";

import { getAtlasPgPool } from "@/lib/atlas/pg-pool";
import type {
  CaseClaim,
  CaseClaimKind,
  CaseClaimReviewStatus,
  CaseFileSnapshot,
} from "@/lib/atlas/case-file-types";
import { CASE_CLAIM_KINDS } from "@/lib/atlas/case-file-types";
import { getThreadCaseEntityId } from "@/lib/atlas/case-entity-store";

const ENTITY_TYPE_SESSION = "user_situation";
const ENTITY_TYPE_CASE = "case_entity";
const SOURCE_DECLARED = "declared";

function normalizeKind(raw: string | null | undefined): CaseClaimKind {
  const key = (raw ?? "fact").trim().toLowerCase();
  if (CASE_CLAIM_KINDS.includes(key as CaseClaimKind)) return key as CaseClaimKind;
  return "fact";
}

function normalizeReview(raw: string | null | undefined): CaseClaimReviewStatus {
  const key = (raw ?? "pending").trim().toLowerCase();
  if (key === "confirmed" || key === "rejected") return key;
  return "pending";
}

function confidenceForKind(kind: CaseClaimKind): string {
  return kind === "hypothesis" ? "ai_inferred" : "self_reported";
}

function rowToClaim(row: {
  id: string;
  claim_text: string;
  claim_subtype: string | null;
  review_status: string | null;
  confidence_tier: string | null;
}): CaseClaim {
  return {
    id: row.id,
    text: row.claim_text,
    kind: normalizeKind(row.claim_subtype),
    review_status: normalizeReview(row.review_status),
    confidence_tier: row.confidence_tier ?? undefined,
    source: "declared",
  };
}

async function loadClaimsForEntity(
  entityType: string,
  entityId: string,
): Promise<CaseClaim[]> {
  const pool = getAtlasPgPool();
  const result = await pool.query<{
    id: string;
    claim_text: string;
    claim_subtype: string | null;
    review_status: string | null;
    confidence_tier: string | null;
  }>(
    `SELECT id, claim_text, claim_subtype, review_status, confidence_tier
     FROM atlas.claims
     WHERE entity_type = $1 AND entity_id = $2 AND source = $3
     ORDER BY created_at ASC
     LIMIT 20`,
    [entityType, entityId, SOURCE_DECLARED],
  );
  return result.rows.map(rowToClaim);
}

async function saveClaimsForEntity(
  entityType: string,
  entityId: string,
  claims: CaseClaim[],
): Promise<void> {
  const pool = getAtlasPgPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `DELETE FROM atlas.claims
       WHERE entity_type = $1 AND entity_id = $2 AND source = $3`,
      [entityType, entityId, SOURCE_DECLARED],
    );
    for (const claim of claims.slice(0, 12)) {
      const id = claim.id || randomUUID();
      await client.query(
        `INSERT INTO atlas.claims (
           id, claim_text, claim_subtype, claim_role, confidence_tier,
           confidence_reason, entity_type, entity_id, source, source_label,
           review_status, corpus_tag
         ) VALUES (
           $1::uuid, $2, $3, 'asserts', $4,
           $5, $6, $7, $8, 'user_situation',
           $9, 'atlas_v5_session'
         )`,
        [
          id,
          claim.text.slice(0, 2000),
          claim.kind,
          confidenceForKind(claim.kind),
          `declared:${claim.kind}`,
          entityType,
          entityId,
          SOURCE_DECLARED,
          claim.review_status,
        ],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export function caseFilePersistEnabled(): boolean {
  const flag = process.env.ATLAS_V5_CASEFILE_PERSIST?.trim().toLowerCase();
  return flag === "1" || flag === "true" || flag === "yes";
}

export async function loadCaseFileForThread(
  threadId: string,
): Promise<CaseFileSnapshot> {
  const caseEntityId = await getThreadCaseEntityId(threadId);
  const claims = caseEntityId
    ? await loadClaimsForEntity(ENTITY_TYPE_CASE, caseEntityId)
    : await loadClaimsForEntity(ENTITY_TYPE_SESSION, threadId);

  return {
    thread_id: threadId,
    case_entity_id: caseEntityId,
    claims,
    persist_enabled: caseFilePersistEnabled(),
  };
}

export async function patchCaseFileForThread(
  threadId: string,
  claims: CaseClaim[],
): Promise<CaseFileSnapshot> {
  const caseEntityId = await getThreadCaseEntityId(threadId);
  const entityType = caseEntityId ? ENTITY_TYPE_CASE : ENTITY_TYPE_SESSION;
  const entityId = caseEntityId ?? threadId;
  await saveClaimsForEntity(entityType, entityId, claims);
  return loadCaseFileForThread(threadId);
}

export async function copySessionClaimsToEntity(
  threadId: string,
  entityId: string,
): Promise<number> {
  const sessionClaims = await loadClaimsForEntity(ENTITY_TYPE_SESSION, threadId);
  if (!sessionClaims.length) return 0;
  await saveClaimsForEntity(ENTITY_TYPE_CASE, entityId, sessionClaims);
  return sessionClaims.length;
}
