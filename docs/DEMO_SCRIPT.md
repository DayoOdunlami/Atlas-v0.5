# Atlas v5 — 5-minute demo recording script

**Prerequisites:** `npm run dev` (UI :3005 + agents :8000), env vars green (`npm run demo:check`).

Optional preview flag: `ATLAS_V5_DEMO_STRICT=1` (prefers recipes when data gates pass; does not disable free compose).

---

## 1. Entry (30s)

1. Open `/atlas`
2. Confirm entry headline: **What do you want to understand?**
3. Canvas context panel visible on the right

## 2. Golden question #1 — rail orient (90s)

1. Type: **State of play on rail decarbonisation**
2. Press Enter — URL should gain `?thread=…`
3. Wait for canvas spine: stat strip → verdict hero → blindspot
4. Chat rail shows one-line **verdict lead** above assistant reply
5. Click a corpus stat — provenance peel opens; if corpus proof panel shows, confirm real project title

## 3. Follow-up turn (60s)

1. Ask: **What about TRIG grants?**
2. Canvas updates; thread title appears in sidebar (pin sidebar if needed)
3. No duplicate user bubbles from bootstrap

## 4. Thread switch (45s)

1. Click **New session** (or start second question from entry in new tab)
2. Switch between threads in sidebar — URL `?thread=` must stay stable
3. History intact when returning to first thread

## 5. Meta defend — CPC scope (90s)

1. New session; ask:
   > Justify your existence. Should CPC be putting money into developing you? What makes you different?
2. Confirm canvas is **defend/SWOT-style**, not default rail IncommensurableMagnitudes chart spam

## 6. Case file (45s)

1. Open case file panel in session workspace
2. Paste SME blurb → extract claims (or confirm existing claim row)
3. Optional: **SWOT for CPC** follow-up merges claims into canvas

---

## Success checklist

- [ ] No white screen / "Application error"
- [ ] No console ReferenceErrors
- [ ] MOT green: `npm run eval:mot`
- [ ] Golden chains G1–G4 pass brain trajectories

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Chat stuck on "thinking" | Check `PYTHON_AGENTS_URL` and `:8000/health` |
| Threads not saving | `POSTGRES_URL` + `npm run db:migrate:atlas` |
| Playwright fails | `npm run prepare:playwright` |
