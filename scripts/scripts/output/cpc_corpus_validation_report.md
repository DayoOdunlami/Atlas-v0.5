# CPC Corpus Validation Report

Generated: 2026-05-22T14:57:56.517Z

**Overall: ✅ PASS**

## Section Summary

- ✅ **files**: pass
- ✅ **schema**: pass
- ✅ **counts**: pass
- ✅ **governance**: pass
- ✅ **queries**: pass
- – **api**: skip
- ✅ **idempotency**: pass

## Detail

### files

- ✅ data/projects_master_v0_4_targeted_enriched.csv — 392 rows
- ✅ projects_master_v0_4_targeted_enriched.csv columns — All 15 required columns present
- ✅ data/impact_claim_candidates_v0.csv — 32 rows
- ✅ impact_claim_candidates_v0.csv columns — All 10 required columns present
- ✅ data/evaluation_method_claims_v0.csv — 12 rows
- ✅ evaluation_method_claims_v0.csv columns — All 7 required columns present
- ✅ data/claim_candidates_v0_7_validated_pmo_subset.csv — 5 rows
- ✅ claim_candidates_v0_7_validated_pmo_subset.csv columns — All 12 required columns present
- ✅ data/claim_evidence_links_v0_7_validated_pmo_subset.csv — 5 rows
- ✅ claim_evidence_links_v0_7_validated_pmo_subset.csv columns — All 8 required columns present

### schema

- ✅ atlas.evidence_containers — Table exists
- ✅ atlas.claims — Table exists
- ✅ atlas.profile_claims — Table exists
- ✅ atlas.claim_evidence_links — Table exists
- ✅ atlas.evidence_containers columns — All required columns present
- ✅ atlas.claims columns — All required columns present
- ✅ atlas.profile_claims columns — All required columns present
- ✅ atlas.claim_evidence_links columns — All required columns present

### counts

- ✅ CPC Capability Profile — 1 (expected 1)
- ✅ Project containers — 392 (expected 392)
- ✅ Total claims — 48 (expected 48)
- ✅ Impact claims — 31 (expected 31)
- ✅ Eval method claims — 12 (expected 12)
- ✅ PMO validated claims — 5 (expected 5)
- ✅ Evidence links — 48 (expected >= 48)
- ✅ Projects with parent_profile_id — All 392 linked
- ✅ No container→container profile_claims — Clean

### governance

- ✅ No Level 3 claims — 0 Level 3 claims
- ✅ verified_internal not promoted — No improper promotions
- ✅ No claims from project metadata — None
- ✅ No rejected PMO fragments — None
- ✅ All claims pending review — All pending

### queries

- ✅ Business unit breakdown — 5 distinct units
- ✅ Top funders — 10 returned
- ✅ Claims by confidence — 1 tiers
- ✅ Claims by level — 2 levels
- ✅ Claims by subtype — 9 subtypes
- ✅ Evidence links with excerpt — 48
- ✅ DfT projects — 58
- ✅ Network Rail projects — 32
- ✅ PMO claims linked to project containers — 5 PMO claims with project links
- ✅ Claims linked to Capability Profile — 48 claims linked

### api

- – health endpoint — --skip-api flag set

### idempotency

- ✅ evidence_containers unique by external_id — Index found
- ✅ profile_claims unique(container_id, claim_id) — Unique constraint found
- ✅ No duplicate claims by external_claim_id — None
- ✅ No duplicate project containers by external_id — None

## Next Recommended Fixes

No failures — ingestion is complete.
