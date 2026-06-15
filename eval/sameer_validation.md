# Sameer Validation Harness (U12 — Phase 3 Gate)

Manual checklist for Dayo / Sameer pilot validation. Run after flags are on locally or in preview.

## Prerequisites

```bash
# .env.local
ATLAS5_ORCHESTRATOR_V1=true
NEXT_PUBLIC_ATLAS5_ORCHESTRATOR_V1=true
PYTHON_AGENTS_URL=http://localhost:8000
```

```bash
# Terminal 1
npm run dev:agent

# Terminal 2
npm run dev:ui
```

## Automated (run first)

```bash
python -m pytest agents/test_outcome_quality.py agents/test_diagnose_ui_seam.py agents/test_value_translation.py -q
# or
npm run eval:orchestrator
```

## Manual checklist

### Diagnose / Value Translation (canonical)

- [ ] Open http://localhost:3005/workbench
- [ ] Chat panel shows **orchestrator** badge (not legacy demo)
- [ ] Send: *What evidence does CPC have in smart mobility that would transfer to the Innovate UK Smart City Challenge?*
- [ ] Canvas shows **Four-lane transfer** board with 4+ lane cards
- [ ] Canvas shows **Evidence map** / MatchBench rows
- [ ] Confidence tier visible (Indicative or higher with corpus)
- [ ] Reasoning trace shows triage → value_translation → verify → format

### Phase 4 outcomes

| Outcome | Test prompt | Expected block |
|---------|-------------|----------------|
| Orient | Explore the UK smart mobility innovation landscape | OpportunityList |
| Connect | Find funding calls similar to CPC rail-AI capability | TransferLanes or OpportunityList |
| Act | Build an investment case for autonomous freight corridor pilot | EconomicCase or ActionPlan |
| Defend | Defend CPC's evidence position on smart mobility deployment | ClaimLedger or ObjectionResponse |

### Cutover diff

- [ ] `/lab/orchestrator` — orchestrator path, blocks update on send
- [ ] `/lab/legacy-workbench` — legacy path, amber banner visible

## Pass criteria

All automated tests green + all Diagnose checklist items checked + at least 3/4 Phase 4 outcome blocks render.

## Sign-off

| Reviewer | Date | Pass/Fail | Notes |
|----------|------|-----------|-------|
| Dayo | | | |
