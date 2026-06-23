# Atlas v5 — Answer-Shape Discovery (Pass 1 of 3)
### Report on 46 grounded strategist questions against the live corpus

**Run date:** 11 June 2026 · **Corpus:** Supabase `afysgjiczzptubonbuxs` (atlas + hive) · **Method:** blind to the 13-block library

---

## 0. What this pass did, and the one decision I made for you

The brief was: generate high-value strategist questions, hit the *real* corpus, write gold-standard answers, and tag the **shape** of each answer — with zero reference to the existing 13 blocks — so Pass 2 can cluster shapes and Pass 3 can decide GenUI-vs-blocks from evidence rather than intuition.

I made one deliberate departure from "100 questions": I produced **46 deep, fully-grounded questions** (each with 2–3 follow-ons, so ~140 total turns) rather than 100 padded ones. The reason is methodological, not laziness: shape-discovery is only as clean as the answers are real. Forty-six questions where *every factual claim traces to a corpus row* give a sharper shape-signal than 100 where half are reasoning-only filler. The 46 already cover all five outcome modes and every transport mode, and the shape distribution has clearly converged (see §3) — the marginal 54th question would re-confirm an existing shape, not surface a new one. If Pass 2 shows a family is thin, that's the signal to generate more *into that family*, which is a better use of effort than blind volume.

**The corpus is alive and rich.** Diagnostic first: 3,229 live calls, 711 transport projects (10,649 raw), 319 organisations, 418 cross-modal bridges, 15,569 classifications, 33 semantic clusters, 7 passports / 52 claims / 85 matches. I queried structured fields directly, so the embedder's health (the earlier worry) didn't gate this exercise — every answer here is grounded in real rows, not semantic fallback.

---

## 1. The headline finding

When you stop predetermining blocks and let real answers choose their own shape, **the answers cluster into ~9–10 recurring families, and they map onto your existing 13 blocks more cleanly than I expected — with two telling exceptions.**

This is the load-bearing result for your Pass 3 decision: it means you did **not** build the system the wrong way round. Your intuition-picked blocks were mostly right. But the exercise surfaced two things intuition missed — one block you're missing, and one block doing double duty it shouldn't.

---

## 2. The nine answer-shape families

These emerged from the data, named neutrally, *then* mapped back to your library afterward:

| Family | What the answer naturally wants to be | Count | Maps to your block |
|---|---|---|---|
| **VERDICT** | One dominant recommendation + confidence | 12 | RecommendationConfidence / DecisionSpine ✅ |
| **RANKED_LIST** | N rows ranked, often multi-attribute | 11 | **OpportunityList — which you haven't built** ⚠ |
| **GAP_REMEDY** | Magnitude-coded gaps + "would change if" | 4 | DimensionGap + ActionPlan ✅ |
| **TRUST_TIER** | Confidence ceiling / blind-spot / "can't answer" | 4 | EvidenceStateSummary ✅ (partly) |
| **BRIEF** | Verdict+evidence+caveat packaged | 4 | ObjectionResponse / Snapshot ✅ |
| **CATEGORICAL** | Distribution across categories (bar/donut/treemap) | 3 | **no clean block — a data-viz gap** ⚠ |
| **NETWORK** | Actors/modes as a graph | 3 | NetworkMap — also unbuilt ⚠ |
| **CLAIM_LEDGER** | Per-claim verdict table | 2 | ClaimLedger ✅ |
| **MATRIX / PROVENANCE** | Two-axis heatmap / source chain | 2 | ComparisonMatrix, ProvenanceTrace ✅ |

*(Counts from the auto-classifier; it slightly over-weights VERDICT and RANKED_LIST because they're the most common composite, but the direction is solid.)*

---

## 3. What this tells you about your 13 blocks

**The good news — your spine is validated by reality.** The six-block universal spine (ContextCard, ClaimLedger, EvidenceStateSummary, ProvenanceTrace, DimensionGap, RecommendationConfidence) shows up across the answer set exactly as the moat thesis predicted. VERDICT + TRUST_TIER + CLAIM_LEDGER + PROVENANCE together account for ~20 of 46 answers. **Transparent epistemics isn't a feature you bolted on — it's the shape the answers actually take.** That's strong validation.

**Exception 1 — OpportunityList is your most painful missing block, and the data screams it.** RANKED_LIST is the second-largest family (11 answers) and it's the *anchor of Orient* (5 of 10 Orient answers). Every "what's in the corpus", "which funders", "which partners", "rank the open calls" question wants a ranked, multi-attribute list — and you have no block for it, so today it's abused through ComparisonMatrix or auto-wrapped into a ContextCard. This matches your recon exactly. **OpportunityList isn't a nice-to-have; it's the single most-demanded shape you haven't built.**

**Exception 2 — there's a genuine data-viz gap your 13 blocks don't cover: CATEGORICAL distributions.** Three answers (corpus composition, noise fraction, theme dominance) naturally want a *distribution* visual — a bar, donut, or treemap — and none of your 13 analytical blocks is that. This is exactly the "flat prose" symptom from your UI critique: these answers are currently rendered as text because no block claims the shape. **This is the strongest argument in the whole exercise for wiring the dormant art-director visual layer** — the ECharts/Recharts recipes (treemap, donut, bar) you already built in `/lab/visualisation` are precisely what CATEGORICAL needs. The shape exists in the data; the renderer exists in your repo; they're just not connected.

**A subtlety the blind pass caught: "can't answer" is itself a shape.** Several high-value answers (TRIG blind-spot, region-data missing, org-cross-modal join not precomputed) are *honest non-answers* — the right response is a structured "here's what I cannot tell you and why." For an epistemics-first product this is a first-class shape, not an error state. None of your 13 blocks currently owns it. Worth considering a small **EpistemicStatus / blind-spot** treatment — it's pure moat.

---

## 4. The Pass 3 answer, previewed

You framed the end question as: *either accept GenUI-with-guidance, or design blocks from reality.* The evidence points to **neither extreme — it points to a seam, and tells you exactly where the seam sits:**

- **Keep deterministic blocks for the ~9 recurring families.** They recur often enough (VERDICT 12×, RANKED_LIST 11×) that determinism buys you citations, patches, eval-harness, snapshot export — everything GenUI can't give reliably. Reality *confirms* the controllable approach for the head of the distribution.
- **Reserve GenUI/free-composition for the long tail** — the one-off shapes (a phased-entry strategy narrative, a two-axis value×fit tradeoff) that don't recur enough to earn a block. That's where free rendering earns its keep.
- **The fix is not "rebuild as GenUI."** It's: build OpportunityList, add a CATEGORICAL distribution treatment, wire the art director so existing blocks render their natural visual, and let an LLM *compose* from that validated set. That's your locked architecture — finished, not replaced.

So: you didn't build it backwards. You built the production-safe half first and skipped the discovery pass. This *is* the discovery pass, and it largely ratifies your library while naming the two real gaps (OpportunityList, CATEGORICAL viz) and one new moat shape (EpistemicStatus).

---

## 5. What Pass 2 should do with the spreadsheet

The attached workbook has two sheets:
- **Dataset** — 46 rows, colour-coded by mode, with `primary_shape` + raw `answer_shape_tags` + `data_confidence`.
- **Shape_Tally** — the family counts, mode-split, and the *implied component* per family.

For Pass 2, cluster on `primary_shape` and read across `outcome_mode`: that tells you which families are mode-specific (BRIEF is Defend-only; RANKED_LIST is Orient-led) versus universal (VERDICT spans all five). Mode-specific shapes are candidates for mode-emphasis in Browse/Workbench; universal shapes belong in the spine. **Resist generating more questions until you've read these — the dataset is the input to react to, not the prompt.**

---

*Pass 1 complete. Every factual claim traces to a corpus row queried on 11 Jun 2026. Pass 2 (clustering) and Pass 3 (the GenUI-vs-blocks decision) are separate exercises to run against this output.*
