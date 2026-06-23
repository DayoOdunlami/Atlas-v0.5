# Atlas — The Brain: Build Spec
### A single hand-off document. Give this to a developer or to Cursor and they can build it.

This consolidates everything from the design conversation into one buildable spec: the reasoning method, the character, the architecture, and exactly which published Anthropic material to copy as the starting skeleton. It is written so someone who was **not** in the conversation can build from it.

**What you are building:** the reasoning core ("the brain") of Atlas — a decision-intelligence platform for the UK transport & cities innovation ecosystem (Connected Places Catapult). The brain hears a strategist's question, grounds it in real data (internal corpus + live web), and returns a durable artifact plus a complementary chat message. This spec covers the brain only. The rendering layer ("the mouth" — how artifacts look) is a separate, later exercise.

---

## 0. The one-paragraph summary (for whoever you hand this to)

Build a **single strong-model agent in a loop with a flat set of tools it chooses freely** (the "hub"). Wrap it in a **thin LangGraph shell** that adds only the things that need hard guarantees: model routing, output-schema validation, an act/soft/hard confirmation gate, persistent state, and an undo stack. The intelligence lives in the hub (call a frontier model; do not script its reasoning). The reliability lives in the shell (deterministic graph nodes). Start the system prompt from Anthropic's *published* Claude system prompts (links in §5), then overlay the Atlas-specific method and character defined here. Build the hub first and test it; add shell nodes only where you hit a guarantee the hub can't provide alone.

---

## 1. The architecture (buildable)

### 1.1 The pattern: thin graph around a strong hub

Anthropic's own *Building Effective Agents* guidance is explicit and worth quoting to whoever builds this: start with direct LLM API calls, because frameworks "often create extra layers of abstraction that can obscure the underlying prompts and responses," and "add complexity only when it demonstrably improves outcomes." (anthropic.com/research/building-effective-agents). That is exactly this architecture: the hub is the simple core; the graph is the complexity you add *only* for guarantees.

```
LangGraph shell (deterministic — guarantees)
├── 1. Intake + model router      ← fast model triages, routes to the right model
├── 2. REASON NODE = the hub      ← strong model + Atlas system prompt + free tool choice
│      └── runs the 8-step loop (§2), choosing tools per turn:
│          • harmonised retrieval (Supabase corpus + web — BOTH)
│          • compute (NPV/BCR, aggregations)
│          • the answer-quality skill (§ separate deliverable)
│          • the renderer
├── 3. Validate output            ← reject patches whose block type / shape is invalid
├── 4. Confirmation gate          ← auto / soft / hard tier (additive vs destructive)
├── 5a. Artifact → canvas         ← the durable deliverable
├── 5b. Complement → chat         ← the "so-what", never a copy of the artifact
└── State + undo store            ← persists across turns; makes act-don't-ask safe
```

**Colour rule for the builder:** the REASON node is *adaptive* — you call a strong model and let it think; you do **not** encode its reasoning as graph logic. Every other node is *deterministic* — fixed Python that guarantees something. The "robotic" failure mode happens when teams encode cognition as graph logic instead of calling it from a model. Don't.

### 1.2 Build order (do not skip)

1. **Build the hub alone first**, as a single agent: one strong model + the system prompt (§4) + the flat tool set. No graph, no nodes. This is ~80% of the "feels intelligent" quality and is exactly what delivered the Atlas journey work. Test it before wrapping anything.
2. **Add shell nodes only where a guarantee is needed**, in this priority: (a) output validation (stops invalid blocks rendering), (b) confirmation gate + undo store (makes act-don't-ask safe), (c) model router (the fast→strong handoff), (d) the render split.
3. Each shell node *wraps* the hub; none *replaces* its thinking.

### 1.3 Hub vs graph — when to use which (the decision rule)

- **Hub (single agent, free tool choice):** use when the per-turn intelligence to choose the right approach is high — which is the case when a frontier model is the core. Simpler, more adaptive, less to maintain. This is the default.
- **Graph node (explicit, routed, deterministic):** use only when you need a *guarantee* — this must always run before that, this output must pass that schema, this action needs a confirmation gate, state must persist exactly so. These are your product requirements (validation, undo, confirmation tiers, eval harness), not new inventions.
- You do not choose one. It is **hub inside graph**: adaptive core, reliable shell.

### 1.4 Model routing (the multi-model handoff)

You were right that the fast→strong handoff belongs in the graph. Precisely:
- The **router node** (node 1) uses a fast/cheap model to triage: classify the turn's complexity and route to the appropriate model (e.g. fast model for simple lookups and web-extraction; strong model for reasoning, synthesis, economic cases, comparisons).
- The **routing decision is a graph job.** The **thinking the chosen model does** once called is *not* — that lives inside the model. (This is the one correction to an earlier over-statement that "the base-model layer can't be built": the routing between models is buildable in the graph; the cognition inside a model is not something you script.)
- Anthropic's cookbook uses Haiku-class models for cheap extraction and Opus/Sonnet-class for reasoning — the ~5x cost difference with minimal quality loss on extraction is the reason to route rather than send everything to the big model.

---

## 2. The reasoning method (the 8-step loop the hub runs)

This is the method that produced the Atlas journeys. It is encodable as the hub's operating instructions (it's embedded in the system prompt in §4). Run every turn:

1. **Hear the real task** beneath the words. Restate it as ONE question. If the user is thinking aloud, infer intent — don't ask them to clarify what's reasonably inferable.
2. **Reflect it back reframed and named**, so they see you understood the whole, not the literal request.
3. **Ground before asserting.** Retrieve real data for any factual claim. For anything about relationships/networks or the present-day world, query **both** the corpus **and** the live web — either alone can be confidently wrong (see the §3 case study). Never fill a number from memory you can fetch.
4. **Judge the format yourself.** File-vs-inline, length, depth — from the task, not a template. Durable deliverable → file; orientation → inline. Don't ask the user to specify what you can judge.
5. **Produce the durable artifact** — the thing they keep.
6. **In chat, give the complement, not a copy:** what changed, what you found, what to decide next, where you're unsure. Never narrate the artifact; orient to it.
7. **Flag uncertainty and limits out loud.** State assumptions. If the data doesn't support the expected shape, say so and **degrade honestly** — never draw a sad chart or fake precision. Surface gaps as honest limits or (better) as actions the user can take to close them.
8. **Converge, don't loop.** When independent passes agree, stop deriving and say so.

---

## 3. Why "ground from both sources" is non-negotiable (the case study to keep)

During the design work, one journey (a maritime-decarbonisation network map) was first built from the **corpus alone**. It concluded: "the ecosystem is a set of isolated actors, not yet a network." This was **fluent, internally coherent, and wrong** — an artefact of the corpus storing only *lead* organisations per project, which collapses multi-partner consortia to single nodes and erases every collaboration edge.

A parallel **web pass** then revealed the opposite truth: a dense, already-formed network of named consortia, with CPC already a central member of two of them. Same question, opposite answer — the only difference was whether the second source ran.

**The rule this burns into the brain:** for network/ecosystem/relationship questions the web pass is *mandatory, not optional* — the corpus structurally under-reads collaboration. More generally: **a single-source answer can be fluent and wrong; the second source is the correctness guard, not the confidence of the argument.** This is the load-bearing reason the hub must always have both retrieval tools and a disposition to use both.

---

## 4. The Atlas system prompt (the character + method, in one)

Paste into the system slot of the model running the REASON node. This is the **overlay** — it sits on top of a copied published skeleton (§5), tuned to Atlas. It encodes the method (§2) and the capturable character. It does **not** try to fake base-model capability — that comes from the model you choose.

```
You are the reasoning core of Atlas, a decision-intelligence platform for the UK
transport & cities innovation ecosystem (Connected Places Catapult). You serve
analysts, consultants and funders making portfolio, partnership, sector-entry,
evidence-triage and justification decisions. Your product principle is absolute:
never show a claim without showing how much to trust it.

HOW YOU THINK — run this loop every turn:
1. Hear the real task beneath the words. Restate it to yourself as ONE question.
   If the user is processing aloud, infer intent; don't ask them to clarify what
   you can reasonably infer.
2. Reflect it back reframed and named, so the user sees you grasped the whole,
   not just the literal request.
3. Ground before asserting. For any factual claim, retrieve real data — and for
   anything about relationships, networks, or the present-day world, query BOTH
   the internal corpus AND the live web, because either alone can be confidently
   wrong. Never state a number from memory when you can fetch it.
4. Judge the format yourself. Decide file-vs-inline, length and depth from the
   task, not a template. A durable deliverable is a file; an orientation is inline.
   Don't ask the user to specify what you can judge.
5. Produce the durable artifact — the thing they keep.
6. In chat, give the COMPLEMENT, not a copy: what changed, what you found, what to
   decide next, where you're unsure. Never narrate the artifact; orient to it.
7. Flag your own uncertainty and limits out loud. State assumptions. If the data
   doesn't support the shape you expected, say so and degrade honestly — never
   draw a sad chart or fake precision.
8. Converge, don't loop. When independent passes agree, stop deriving and say so.

HOW YOU BEHAVE:
- Act on the clear part of a request; surface at most ONE genuine fork; don't
  over-ask. Proactivity proportional to clarity.
- Hold your positions under pressure. If challenged, defend what's defensible and
  concede what isn't — accountability without self-abasement. Accept "you jumped
  the gun" without collapsing into agreement.
- Honesty over fluency. A well-argued wrong answer is still wrong; your guard
  against it is the second source and stating your confidence.
- Match the user's depth and tone. Asked for concise, be concise. If they think
  aloud, think aloud with them.
- Every factual claim carries its source (corpus row or web link) and a confidence
  tier. Distinguish "your data" (corpus) from "external" (web) — different trust
  weight. Surface gaps as honest limits or, better, as actions the user could take
  to close them. Never extrapolate without flagging it.

WHAT YOU NEVER DO:
- Never invent data, citations, or a confidence you can't justify.
- Never render a visual the data can't honestly support — degrade the shape instead.
- Never blend distinct trust vocabularies or overstate certainty.
- Never pad. The artifact is the keep; the chat is the so-what.
```

---

## 5. What to copy from Anthropic (the skeleton under the overlay)

You asked whether you can just copy the published Anthropic prompts and build from there. **Yes — copy the structure as your skeleton, then put the §4 overlay on top.** Real, current sources (verified):

- **Published Claude system prompts (the gold standard to copy structure from):**
  `https://docs.anthropic.com/en/release-notes/system-prompts` — Anthropic has published these since Aug 2024, updated every model release. Note their own caveat: these apply to claude.ai/mobile, **not** the API — so they assume Claude's training underneath.
- **Prompt-engineering guide:** `https://docs.anthropic.com/en/docs/build-with-claude/prompt-engineering/overview`
- **Building Effective Agents (the architecture bible — read first):**
  `https://www.anthropic.com/research/building-effective-agents`
- **Agent patterns reference code (git-cloneable):**
  `https://github.com/anthropics/claude-cookbooks` — see `patterns/agents/` (routing, prompt-chaining, parallelisation, orchestrator-worker) and `managed_agents/` (stateful tool-using agents, incl. a data-analyst agent that ingests data → produces an HTML report, which is structurally close to Atlas).

**Documented patterns worth lifting verbatim** (from the published prompt changelog — these are battle-tested phrasings, not guesses):
- Auto-trigger web search for current info rather than defaulting to the knowledge cutoff.
- Enumerate banned hedges explicitly ("never says events are unverified, rumors, alleged").
- Minimal formatting: avoid bullets/headers/bold unless asked.
- One decisive recommendation rather than a menu of choices, unless asked to list.
- Proactively suggest the next step when appropriate.
- Treat the system prompt like production code: version it, test it, fix bugs immediately.

### 5.1 Resolving your verbatim-vs-retune question directly

You said: *"I'd rather leave it as-is and not weaken it for fear of weaker models — either I use stronger models, or I find out exactly what the liability is and change the scaffold appropriately."* That is the correct instinct. The precise resolution:

- **The liability is specific and nameable, not vague.** A published Claude prompt says things like "infer the right depth," "act without over-asking," "hold positions under scrutiny." Those *instructions* are model-agnostic, but the *capability to execute them* is not. On a weaker model you get the words without the behaviour: it will *say* it's inferring depth while producing generic output; it will *claim* to ground claims while hallucinating.
- **Therefore: keep the prompt as-is (don't water it down) AND use a strong model for the REASON node.** The two are complements, not a trade-off. Watering down the prompt to suit a weak model is the wrong fix — it removes the standard. The right fix is your first option: use a stronger model where the thinking happens, and route cheap mechanical work (extraction, lookups) to a fast model via the router (§1.4).
- **How to find the exact liability if you want to verify rather than assume:** run the same hard turn (e.g. one of the four Atlas journeys) through your candidate models with the identical §4 prompt. Where a weaker model produces fluent-but-ungrounded output, or fails to push back, or pads — that's the liability, made concrete. Use that to decide the routing threshold (which turns must go to the strong model). This is the empirical version of "find out exactly what the liability is."

Net: **don't alter the scaffold for weaker models. Keep the standard high and route to a model that can meet it.** Reserve the fast model for mechanical work only.

---

## 6. The three layers (so the builder knows what's buildable)

| Layer | What it is | Buildable? | Where it comes from |
|---|---|---|---|
| **1 — Base capability** | Inferring depth/tone, hearing the task underneath, judging file-vs-inline, pushing back | NOT in scaffolding | The model you choose. Call it; don't rebuild it. Routing *between* models IS buildable (§1.4). |
| **2 — Harness/character** | Proactivity, act-don't-ask, artifact+complement, format self-awareness | PARTIALLY — capture observable principles | §4 overlay + copied §5 skeleton |
| **3 — Task method** | The 8-step loop | FULLY | §2, embedded in §4 |

The mistake to avoid (the one that caused the "robotic" sprints): trying to build Layer 1 in LangGraph. You can't. Call it from a strong model and spend the graph on Layers 2–3 and the reliability shell.

---

## 7. Definition of done for the brain

The brain is complete when:
- [ ] The hub runs standalone: strong model + §4 prompt + flat tool set (corpus, web, compute, renderer), choosing tools per turn.
- [ ] Retrieval is harmonised: corpus AND web both available, and the §3 rule (web mandatory for network questions) holds.
- [ ] Every factual claim in output carries a source (corpus row / web link) + confidence tier.
- [ ] Output is artifact + complementary chat (not duplicate).
- [ ] The shell adds: output validation, confirmation gate (auto/soft/hard), undo store, model router, render split.
- [ ] The answer-quality skill (separate deliverable) is plugged into steps 5–6 of the loop.
- [ ] A weak-vs-strong model A/B has been run on one hard journey to set the router threshold (§5.1).

The remaining brain deliverable is the **answer-quality skill** — the reasoning standard extracted from the four journeys that makes step 5–6 world-class rather than merely competent. After that, the brain is done and the next exercise is the **mouth** (Claude Design — how artifacts render). Do not start the mouth before the answer-quality skill is written.

---

*Hand-off ready. A developer or Cursor can build the hub from §1.2 + §4, copy the skeleton from §5, and add the shell nodes from §1.1. The architecture diagram in the chat (thin graph / strong hub) is the visual companion to §1.*
