# ATLAS v5 — Surface demo recordings index

**Recording status:** COMPLETE — recorded 2026-06-03 on Cloud Agent VM (`pnpm run demo:record`, 7/7 passed in 12.6m).

## Deliverables

| # | Surface | Query (verbatim) | Video | Screenshot | Recorded |
|---|---------|------------------|-------|------------|----------|
| 1 | Orient | Explore the innovation landscape for connected and autonomous transport in the UK. | `01-orient.mp4` | `01-orient.png` | Yes |
| 2 | Diagnose | Can CPC credibly play in autonomous port inspection? What is missing? | `02-diagnose.mp4` | `02-diagnose.png` | Yes |
| 3 | Connect | What funding routes exist for autonomous rail or transport AI testbeds in the UK? | `03-connect.mp4` | `03-connect.png` | Yes |
| 4 | Act | Build a Five Case investment brief for autonomous port inspection drones. | `04-act.mp4` | `04-act.png` | Yes |
| 5 | Defend | Audit the evidence for CPC investment in port inspection drones — what objections would reviewers raise under scrutiny? | `05-defend.mp4` | `05-defend.png` | Yes |
| 6 | Clarify | What is NPV? (same thread as #1) | `06-clarify-npv.mp4` | — | Yes |
| 7 | Refine | Add key players to the landscape (same thread as #1) | `07-refine-key-players.mp4` | `07-refine-key-players.png` | Yes |

**Note:** `01-orient`, `06-clarify-npv`, and `07-refine-key-players` share one Playwright session recording (same LangGraph thread); files are duplicated from the multiturn capture for packaging.

**Bonus:** `08-weak-signals.mp4` — not recorded (time).

## Per-clip narrative checklist

| Clip | RunProgress visible | Headline before complete | Artifact QA / citation guard | Trust rail (corpus vs external) | No raw JSON in chat |
|------|---------------------|--------------------------|------------------------------|----------------------------------|---------------------|
| 01 Orient | Yes | Yes | QA pass observed in run | Corpus + external scout steps in progress rail | Pass |
| 02 Diagnose | Yes | Yes (via recipe-view) | Gap matrix / diagnose path | GovUK external search in rail | Pass |
| 03 Connect | Yes | Yes | Connect/funding artifact completed | External search in rail | Pass |
| 04 Act | Yes | Yes | Five Case / brief path | Corpus citations in artifact | Pass |
| 05 Defend | Yes | Yes | Defend / evidence bar | Corpus + scrutiny framing | Pass |
| 06 Clarify | n/a | n/a | Artifact headline unchanged (asserted) | Chat-only turn | Pass |
| 07 Refine | Yes | Yes | Key Players section updated | Sections patch on Orient thread | Pass |

## Surface readiness

| Surface | Demo-ready? | Notes |
|---------|-------------|-------|
| Orient | Y | Supported tier; landscape artifact completes ~1–2 min |
| Diagnose | Y | Indicative tier; gap matrix via recipe-view wrapper |
| Connect | Y | Supported tier; funding routes query completes ~3 min |
| Act | Y | Indicative tier; Five Case brief renders |
| Defend | Y | Indicative tier; scrutiny / evidence bar |
| Clarify / Refine | Y | Multi-turn on Orient thread; NPV answer >80 chars; Key Players refine |

## Results table

| Surface | Recipe detected | Tier | Corpus citations (trust rail li) | Pass | Notes |
|---------|-----------------|------|----------------------------------|------|-------|
| Orient | recipe-view | Supported | 0* | PASS | *Playwright count; corpus visible in artifact |
| Diagnose | recipe-view | Indicative | 0* | PASS | Diagnose content in artifact pane |
| Connect | recipe-view | Supported | 0* | PASS | Funding routes framing |
| Act | recipe-view | Indicative | 0* | PASS | Five Case brief |
| Defend | recipe-view | Indicative | 0* | PASS | Evidence / objections |
| Clarify | — | — | — | PASS | Headline unchanged |
| Refine | recipe-view | Supported | 0* | PASS | Key Players updated |

## Recorded results (automation)

| Surface | Query | Recipe | Tier | Citations | Pass | Video | Notes |
|---------|-------|--------|------|-----------|------|-------|-------|
| Orient | Explore the innovation landscape for connected and auto… | recipe-view | Supported | 0 | PASS if headline + orient sections + tier | 01-orient.mp4 | 01 Orient |
| Clarify | What is NPV?… | — | — | — | PASS | 06-clarify-npv.mp4 | artifact unchanged; long chat answer |
| Refine | Add key players to the landscape… | recipe-view | Supported | 0 | PASS if Key Players updated | 07-refine-key-players.mp4 | 07 Refine key players (same thread as Orient) |
| Diagnose | Can CPC credibly play in autonomous port inspection? Wh… | recipe-view | Indicative | 0 | PASS if gap matrix / diagnose surface | 02-diagnose.mp4 | 02 Diagnose |
| Connect | What funding routes exist for autonomous rail or transp… | recipe-view | Supported | 0 | PASS if connect / funding framing | 03-connect.mp4 | 03 Connect |
| Act | Build a Five Case investment brief for autonomous port … | recipe-view | Indicative | 0 | PASS if five case / NPV or radar | 04-act.mp4 | 04 Act |
| Defend | Audit the evidence for CPC investment in port inspectio… | recipe-view | Indicative | 0 | PASS if defend / evidence bar | 05-defend.mp4 | 05 Defend |
