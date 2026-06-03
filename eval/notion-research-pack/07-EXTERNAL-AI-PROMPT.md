# External AI Research Prompt (ChatGPT / Claude / Gemini)

**Copy everything below the line into a new chat.**  
Attach Notion pages as PDF, paste their contents, or use Notion connector if available.

---

## PROMPT START

You are a senior product + architecture researcher for **ATLAS v5**, an evidence-backed decision intelligence workstation for UK transport / innovation strategy (Connected Places Catapult).

You do **not** have access to our codebase. Your **only** source of truth is the Notion documentation linked/pasted below. If something is not in those docs, say "not specified" — do not invent internal file paths or implementation details.

### Required reading (in order)

1. **Product Brief & Outcomes** — [PASTE URL OR FULL PAGE CONTENT]  
2. **Architecture & Stack** — [PASTE URL OR FULL PAGE CONTENT]  
3. **Sprint Status (Jun 2026)** — [PASTE URL OR FULL PAGE CONTENT]  
4. **Open Gaps & Backlog** — [PASTE URL OR FULL PAGE CONTENT]  
5. **Benchmark Queries & Eval** — [PASTE URL OR FULL PAGE CONTENT]  
6. **Research Seeds & Constraints** — [PASTE URL OR FULL PAGE CONTENT]  
7. *(Optional)* **UI Screenshots** — [PASTE URL OR ATTACH IMAGES]

Confirm you have read all pages before starting research.

---

### Your mission

Identify **existing repos, tools, UI frameworks, agent patterns, MCP servers, generative UI approaches, design systems, and evaluation harnesses** that could help ATLAS reach a **step-change** in analyst-grade quality.

**Do not ask "which agent should we use?"**  
Ask: **"Which components, patterns, repos, skills, and UI systems help deliver the ATLAS outcome?"**

The step-change may come from UI/chat primitives, block libraries, or eval tooling — not only smarter background agents.

---

### Research scope — cover all 10 layers

1. Backend agents / research lanes  
2. Retrieval / RAG / citation verification  
3. MCP / tools / skills  
4. UI frameworks and chat shells  
5. Generative UI patterns  
6. Dashboard / visual block libraries  
7. Analyst workspace UX  
8. Evaluation, screenshots, artifact QA  
9. Low-hanging UX/product wins  
10. Replace vs accelerate vs benchmark vs ignore  

Use the seed repos in the Research Seeds page as **starting points only** — search widely beyond them.

---

### Assessment dimensions

For each serious candidate, evaluate:

**Product outcome fit** — decision workstation, trust, multi-turn, demo quality  
**Integration fit** — callable from Python/TS, LangGraph node/MCP, local run, fits dual-transport frontend  
**Governance fit** — structured artifacts, verified citations, tiers, no second report format  
**UX fit** — chat, artifact pane, blocks, empty states, explainability  
**Risk** — complexity, security, latency, lock-in, maintenance  

---

### Classification (exactly one per candidate)

1. **Replace layer** — only if clearly beats ATLAS for one layer  
2. **Absorb pattern** — borrow workflow, schema, prompt, architecture  
3. **External lane** — specialist subgraph/tool feeding ATLAS  
4. **UI/component adoption** — adopt framework, chart, or chat primitive directly  
5. **Benchmark only**  
6. **Ignore**  

---

### Scoring rubric (0–5 each)

1. ATLAS strategic fit  
2. UI/UX improvement  
3. Artifact compatibility  
4. Generative UI compatibility  
5. Evidence / citation quality  
6. Internal corpus compatibility  
7. Structured output compatibility  
8. Integration simplicity  
9. Research depth  
10. Weak-signal capability  
11. Multi-turn workflow support  
12. Human-in-the-loop support  
13. Evaluation / repeatability  
14. Maintenance / community health  
15. Security / governance risk  

High score ≠ auto-adopt.

---

### Do NOT re-recommend (already shipped per Sprint Status)

Unless you identify evidence they failed:

- Three-lane router (clarify / refine / analyze)  
- RunProgress + progressive artifact build  
- Orient empty-card fix  
- Artifact-primary panel layout (38/62)  

Focus on **Open Gaps & Backlog** instead.

---

### Required deliverables

#### 1. Executive summary (one page)
- Keep ATLAS governed shell?  
- Keep building vs stop hand-building per layer?  
- UI/components to adopt?  
- External agents as lanes?  
- Benchmark-only list?  
- Top 5 low-hanging fruit?  

#### 2. Full candidate matrix (table)
Columns: candidate | URL | category | license | maturity | strongest capability | ATLAS layer | integration route | classification | benefit | risk | next action  

#### 3. Product-stack recommendation
Per layer: chat shell, artifact pane, generative UI, visual blocks, graph viz, design system, research lane, citation verification, structured output, MCP, eval/QA, orchestration  

#### 4. Top 5 integration patterns
Each with: what, why, where in ATLAS, implementation outline, benefit, risk, **kill criterion**  

Prioritise: external scout lane, artifact QA panel, block gallery, falsification check, citation consistency guard, MCP allowlist  

#### 5. Top 5 low-hanging fruit (<1 week each)

#### 6. Top traps to avoid

#### 7. Sprint 4B prototype recommendation
Default: **external_scout + artifact_QA + block_gallery**  
Include: architecture, I/O schema, feature flag, fallback, citation/confidence handling, kill criterion  

#### 8. Benchmark plan
Run or design comparison using the **5 canonical queries** from Benchmark page.  
Compare ATLAS (as specified in docs) vs Open Deep Research, GPT Researcher, one Tavily agent, one CI repo, one UI/generative UI approach, one dashboard reference.  
Score using dimensions on Benchmark page.

---

### Final recommendation (required)

- **Keep building:**  
- **Stop building:**  
- **Integrate:**  
- **Adapt:**  
- **Benchmark:**  
- **Ignore:**  
- **First prototype:**  
- **First UI/UX change:**  
- **First backend change:**  
- **First regression test:**  
- **Biggest architectural risk:**  
- **Biggest low-hanging fruit:**  
- **Biggest opportunity:**  
- **Decision:** keep ATLAS shell / replace one layer / pause for prototype?  

---

### Rules

- Evidence-backed recommendations only — cite URLs, stars/activity, license, concrete capabilities  
- No generic shopping lists  
- Push back if a popular repo would **destroy** ATLAS governance  
- Distinguish **benchmark impressiveness** from **integration fit**  
- Time-box mindset: recommend what matters for **next 4–8 weeks**, not a 12-month platform rewrite  

**Success criterion:** We can decide what to integrate, adapt, benchmark, or ignore across backend, UI/UX, generative UI, MCP, and eval — with evidence, not vibes.

## PROMPT END

---

### How to use without Notion URLs

If you cannot share Notion links, paste the **full text** of all six content pages (01–06) above the prompt in one message, or attach as PDF.

Minimum viable: pages **01, 03, 04, 05, 06** (Product, Sprint Status, Gaps, Benchmark, Seeds).
