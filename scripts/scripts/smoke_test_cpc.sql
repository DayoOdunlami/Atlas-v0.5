-- CPC Capability Corpus v0.1 — Smoke Tests
-- Run: psql "$DATABASE_URL" -f scripts/smoke_test_cpc.sql
-- All queries are read-only. Run after ingest_cpc_corpus.py completes.

-- ── Test 1: Project count by business unit ────────────────────────────────
SELECT business_unit, COUNT(*)
FROM atlas.evidence_containers
WHERE corpus_tag = 'cpc_v0_1'
  AND container_type IN ('project_evidence_profile', 'project_evidence')
GROUP BY business_unit
ORDER BY COUNT(*) DESC;

-- Expected: ~Transport 189, Built Environment & Local Growth 138, SMCP 27, Data & Digital 24, not found/NULL 14

-- ── Test 2: DfT projects ────────────────────────────────────────────────
SELECT external_id, name, delivery_status, budget_gbp
FROM atlas.evidence_containers
WHERE corpus_tag = 'cpc_v0_1'
  AND customer_or_funder ILIKE '%department for transport%'
ORDER BY budget_gbp DESC NULLS LAST;

-- ── Test 3: Claims by confidence and level ──────────────────────────────
SELECT confidence_tier, claim_level, COUNT(*)
FROM atlas.claims
WHERE corpus_tag = 'cpc_v0_1'
GROUP BY confidence_tier, claim_level
ORDER BY confidence_tier, claim_level;

-- ── Test 4: Evidence links with excerpts (sample) ──────────────────────
SELECT c.claim_text, e.source_file, e.source_excerpt
FROM atlas.claims c
JOIN atlas.claim_evidence_links e ON e.claim_id = c.id
WHERE c.corpus_tag = 'cpc_v0_1'
LIMIT 20;

-- ── Test 5: Verify no Level 3 claims (expected: 0) ─────────────────────
SELECT COUNT(*) AS level_3_count
FROM atlas.claims
WHERE corpus_tag = 'cpc_v0_1'
  AND claim_level = 3;

-- ── Test 6: Verify all project containers have parent profile (expected: 392) ──
SELECT COUNT(*) AS containers_with_parent
FROM atlas.evidence_containers
WHERE corpus_tag = 'cpc_v0_1'
  AND container_type IN ('project_evidence_profile', 'project_evidence')
  AND parent_profile_id IS NOT NULL;

-- ── Test 7: PMO claims linked to project containers ─────────────────────
SELECT ec.external_id, ec.name, c.claim_text
FROM atlas.evidence_containers ec
JOIN atlas.profile_claims pc ON pc.container_id = ec.id
JOIN atlas.claims c ON c.id = pc.claim_id
WHERE ec.corpus_tag = 'cpc_v0_1'
  AND ec.container_type IN ('project_evidence_profile', 'project_evidence')
LIMIT 20;
