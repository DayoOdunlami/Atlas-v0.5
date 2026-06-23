# GATE 0a — J1T1 corpus stress-test (passed)

**Date:** 2026-06-17  
**Query filter:** `atlas.projects` where `'rail' = ANY(cpc_modes)` AND `'decarbonisation' = ANY(cpc_themes)`

---

## Results

| # | Question | Result |
|---|----------|--------|
| 1 | Do `corpus_citations[].id` resolve? | **Pass** — 55 projects, 55 distinct UUID `id` column; sample `bb918318…` → "25kV Battery Train Charging Station Demonstration", Innovate UK, £739,879 |
| 2 | Does £8.17m match `SUM(funding_amount)`? | **Pass** — exact `8,172,702.05` over 37 funded rows; 18 null |
| 3 | Web ~£11.7bn stays candidate / `toScale:false`? | **Pass by absence** — no corpus row grounds national programme; schema treatment correct |
| 4 | Journey field missing? | **One** — `blindspot.structure` added in v0.2.1 |

---

## Structural null finding (earned schema field)

| Funder | Projects | Null funding rows | Recorded £ |
|--------|----------|-------------------|------------|
| EPSRC | 15 | 15 (all) | £0 recorded |
| Innovate UK | 36 | 1 | ~£7.9m of floor |

**Implication:** £8.17m is essentially complete Innovate UK innovation spend in this slice, plus an unpriced research-council tier — not random missingness.

Encoded as:

```ts
blindspot.structure: {
  pattern: string;      // shape of the gap
  implication: string;  // what it means for the verdict
}
```

---

## Golden fixture

`fixtures/j1t1-rail-decarb.golden.json` — validated aggregates; replace citation `id` with full live UUID from query when binding GATE 0b smoke page.

**Note:** Golden uses `bb918318-0000-4000-8000-000000000001` as stress-test prefix placeholder until mouth bootstrap queries replace with full resolved UUID.

---

## GATE 0a status: **CLOSED**

- Repo alignment ✓  
- AnswerSpec v0.2.1 ✓  
- Streaming envelope ✓  
- Corpus stress-test ✓  
- Brain execution contract ✓  

**Next:** GATE 0b — trust primitives smoke page against golden fixture.
