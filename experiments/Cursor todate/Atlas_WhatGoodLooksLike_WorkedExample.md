# Atlas — "What Good Looks Like" worked example
### One real question, answered at world-class quality, then reverse-engineered into a component/skill blueprint

This document does the exercise the controlled blocks can't do for themselves: it answers a real Atlas question **with no component constraint** — pure prose and structure, the way Claude or ChatGPT would — and *then* asks what components, visuals and skills that answer implies. The answer is the spec. We build down to components from it, not up from blocks to answers.

**Question (decide-mode, spanning explore→diagnose→decide):**
*"Should CPC invest in building maritime decarbonisation capability, or is the gap too thin to justify it?"*

All figures are live from Supabase (`afysgjiczzptubonbuxs`), pulled 18 Jun 2026.

---

# PART 1 — The world-class answer (markdown, zero component constraint)

> **Verdict: Enter — but bridge-led and staged, not a native build.** Maritime decarbonisation is the corpus's clearest white-space *with live momentum*, which is the rare combination that makes a thin field worth entering. The risk isn't that the space is empty; it's that you'd try to build native depth instead of borrowing it. Confidence: **Supported** (real data, but CPC's own pipeline is invisible — see the caveat).

**Why this is the white-space worth taking.** Maritime is the thinnest transport mode in the corpus — 54 projects against highways' 317 and data/digital's 448. Ordinarily "thin" means "avoid." Here it doesn't, because of what's *inside* the thinness: 38 of those 54 maritime projects (70%) are decarbonisation-themed, representing **£46.8m** of activity, and **25 are still live past 2024**. So this isn't a dead or pre-nascent field — it's a small, concentrated, *currently-funded* one. White-space with a pulse.

**What's actually in there.** The money is dominated by one large anchor — Belfast Harbour's *Return to Commercial Sailing* (£33.1m, Innovate UK, running to end-2026) — under which sits a coherent cluster of smaller port- and vessel-decarbonisation projects: HydroPort (Portland Port), Clean Tyne, Electric Thames, HIMET hydrogen-maritime, port-side supercapacitors. The pattern is unmistakable: **UK maritime decarbonisation is happening at ports, led by harbour authorities and combined authorities, funded almost entirely by Innovate UK.** That tells you where the door is.

**Why "native build" is the trap.** The instinct with a thin field is to fund depth into it. The data argues against that. Maritime's connective tissue to other modes is weak exactly where you'd want to borrow proof: maritime↔rail and maritime↔aviation bridges are near-zero. But maritime↔highways (40 bridges) and maritime↔digital (32) are real. So the transferable proof flows from ports-as-infrastructure (highways-like) and digital systems — *not* from the other transport modes. A native maritime R&D build would be slow and uncontested-for-a-reason; a bridge-led entry borrows the highways/digital decarbonisation proof that already exists and points it at ports.

**The honest caveat that caps confidence.** Every figure above is the *external* landscape. CPC's own maritime work — anything funded through TRIG, CPC's grants programme — is **not in the corpus**. So this answer can tell you the field is live and where the door is, but it cannot tell you what CPC has already done in it. That's why confidence is Supported, not Robust: the external case is evidenced, the internal position is a blind spot. **Close that blind spot before committing budget** — it's the one thing that could change the verdict.

**The move, concretely.** Enter via a single anchor: partner with a harbour or combined authority on a port-decarbonisation project (the HydroPort / Clean Tyne pattern), borrowing highways-electrification and digital-systems proof rather than building maritime science from scratch. Prove one project. Then decide on depth. Don't commit to native capability on the strength of a white-space alone — commit to *one bridge-led anchor* and let it earn the next decision.

**If you do one thing first:** ingest TRIG so the internal pipeline is visible. Everything else here is solid; that's the only load-bearing unknown.

---

# PART 2 — Reverse-engineering: what made this answer good

Before deciding components, name *why* this reads better than a stack of blocks. These are the transferable qualities — they become the skill.

1. **The verdict is a real sentence, not a label.** "Enter — but bridge-led and staged" carries the *nuance* in the headline. A `RecommendationConfidence` block showing "Explore · Supported · 70%" would lose the entire "bridge-led not native" insight — which is the actual answer. **Lesson: the hero must hold a full-sentence verdict, not a one-word tag.**

2. **It leads with the counter-intuitive move and defends it.** "Thin usually means avoid; here it doesn't, because—." World-class analysis surfaces the thing that makes the reader go "wait, really?" and immediately resolves it. **Lesson: structure is inverted-pyramid but the first line is the *surprising* claim, not the bland one.**

3. **Numbers are always in service of a sentence.** £46.8m, 38 of 54, 25 live — none appears as a bare stat; each is the evidence for a claim ("white-space with a pulse"). **Lesson: data-ink rule — a number only earns its place attached to the inference it supports.**

4. **The caveat is load-bearing, not boilerplate.** The TRIG blind-spot isn't a disclaimer at the bottom; it's *why the confidence is capped* and *the recommended first action*. **Lesson: epistemic limits are content, placed where they bite — not a footer.**

5. **It ends with one action, not a menu.** "Ingest TRIG first." Not five next-steps. **Lesson: converge to a single highest-leverage move.**

---

# PART 3 — NOW apply the component vocabulary: what helps, what hurts

Only here — *after* the good answer exists — do we ask what the block/visual library would add. The discipline: a component earns its place only if it makes the answer **faster to grasp** than the prose. If it just relocates prose into a box, it's flattening, not helping.

| Answer element | Best treatment | Component? | Reasoning |
|---|---|---|---|
| **Verdict sentence + confidence** | Hero block, full-sentence verdict, confidence as supporting badge | ✅ `RecommendationConfidence` — **but variant'd to hold a sentence, not a tag** | The shape is right; the current block's one-word verdict is the wrong shape. This is "right component, wrong shape" — a variant, not a new block. |
| **"70% / £46.8m / 25 live" white-space stat** | Three big numbers, glanceable, with one-line captions | ⚠️ **New: `StatTriplet` / KPI strip** — you don't have this | This is the CATEGORICAL/at-a-glance gap. Prose buries the punch; three large numbers land it instantly. **Genuine component gap.** |
| **The £-ranked project list (Belfast, HydroPort…)** | Ranked rows, fundable, sortable | ✅ `OpportunityList` | Textbook OpportunityList — the block you haven't finished building. |
| **"Where proof flows: highways/digital yes, rail/aviation no"** | The bridge sub-graph for maritime | ✅ `NetworkMap` (maritime ego-network) | A 4-node adjacency picture beats the sentence — *if* it's small and labelled. Dominant visual here would over-claim; keep it subtle. |
| **The TRIG caveat / confidence cap** | Inline, attached to the verdict | ✅ `EvidenceStateSummary` confidence-cap variant — **but kept inline, not as a separate panel** | If you put this in its own block at the bottom, you destroy quality lesson #4. The component must render *near the hero*, not as a footer. **Right component, wrong default placement.** |
| **"The move, concretely" + "do one thing first"** | Ordered, single-highlight | ✅ `ActionPlan` — but collapsed to **one primary action**, rest secondary | ActionPlan's risk is becoming a 5-item checklist that dilutes lesson #5. Variant: one hero action + collapsed rest. |
| **The narrative connective tissue** (why thin≠avoid, why native is a trap) | **Prose. Do not componentise.** | ❌ GenUI / streamed markdown | This is the reasoning that makes the answer *good*, and it has no fixed shape. Forcing it into cards flattens it. **This is the GenUI half of the hybrid — the argument stays prose.** |

---

# PART 4 — The blueprint this produces (for the Cursor decision)

Reading Part 3 down the "Component?" column gives you the exact build/skill decisions, sorted into your four buckets:

**New component needed (real gaps):**
- `StatTriplet` / KPI strip — the at-a-glance number row. Recurs across every Orient/Diagnose answer; you have no block for it. *(Build.)*
- `OpportunityList` — already specced, still unbuilt. *(Build — top priority, confirmed a third time.)*

**Right component, wrong shape (variant, not new block):**
- `RecommendationConfidence` → must hold a **full-sentence verdict**, not a one-word tag. *(Variant.)*
- `ActionPlan` → **one-primary-action** collapsed variant. *(Variant.)*
- `EvidenceStateSummary` → confidence-cap must render **inline near the hero**, not as a footer panel. *(Placement fix, not new code.)*

**Skills/reasoning gap (not a component problem at all):**
- The qualities in Part 2 — verdict-as-sentence, lead-with-the-surprise, numbers-serve-claims, caveat-is-load-bearing, converge-to-one-action — are a **rendering/reasoning skill**, not a block. No component produces these; the *agent* must. This is the biggest finding: **your "ok, not great" outputs are mostly a skill gap, not a component gap.** The blocks were never going to fix answer quality — the answer quality is upstream of the blocks, in how the agent reasons and writes before anything gets rendered.

**Use GenUI, not a component:**
- The connective narrative (the "why" between the data points). Streamed markdown, no fixed shape. This is the long-tail half of the hybrid.

---

## The one-line conclusion

Your instinct was right: **define the good answer first, let components follow.** Doing it once, on one real question, shows the punchline — most of what makes Claude/ChatGPT answers feel better than Atlas is **not** missing components. It's a missing *answer-construction skill* that the component-first build never had a place to put. Build the two real gaps (StatTriplet, OpportunityList), variant three blocks, keep the narrative as GenUI — but above all, **write the answer-quality skill in Part 2 and make the agent follow it before it renders anything.** That's the lever.
