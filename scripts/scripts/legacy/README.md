# Legacy Ingest Scripts — Reference Only

These scripts are archived here post-engine switch (2026-05-08, B1 brief).

They were the original multi-step pipeline called by the daily workflow before
the Atlas Unified Ingest Engine (`scripts/atlas_ingest/`) was promoted to primary.

## Scripts

| File | Original purpose |
|------|-----------------|
| `ingest_live_calls.py` | Scraped IUK competitions → atlas.live_calls |
| `ingest_fts_tenders.py` | Scraped Find-a-Tender → atlas.live_calls |
| `ingest_ukri_competitions.py` | Scraped UKRI/Horizon competitions → atlas.live_calls |
| `embed_live_calls.py` | Embed atlas.live_calls rows (called 3× in old workflow) |
| `embed_fts_relevant_borderline.py` | Embed FTS relevant/borderline rows before classification |

## Status

**These scripts are reference-only.** The daily workflow now calls:
1. `python -m atlas_ingest --source all` (engine, from `scripts/` directory)
2. `python scripts/embed_knowledge_documents.py --since-last-run` (chunking)
3. `python scripts/trigger_matching.py` (passport matching)

## Rollback

If the engine needs to be rolled back in the first cycle after the switch,
restore these scripts from `scripts/legacy/` and revert `.github/workflows/ingest-live-calls.yml`
to its previous state.

## Deletion schedule

After 3 clean daily cron cycles under the new pipeline, these scripts can be
deleted in a separate small PR. Do not delete them before that.
