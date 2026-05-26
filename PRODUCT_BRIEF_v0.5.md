# Atlas v0.5 — Product Brief for Wireframe & Concept Design
> Prepared for colleague handoff and AI-assisted concept generation  
> Version: 0.5 | Date: May 2026 | Status: Alpha / Working Prototype

---

## What Is Atlas?

**Atlas is a multi-agent strategic intelligence workbench for Connected Places Catapult (CPC).**

CPC strategists deal with a hard problem: they need to evaluate innovation opportunities, assess investment cases, and write evidence-backed briefs — but the evidence lives in hundreds of project records, policy documents, funding calls, and research papers spread across disconnected systems.

Atlas turns that corpus into a live, queryable intelligence layer. A strategist asks a question in plain language and gets back:
- A **structured Five Case brief** (Green Book methodology — the UK government standard for investment cases)
- **Real citations** from CPC's own project portfolio and knowledge base
- A **confidence tier** (Speculative → Indicative → Supported → Robust) telling them how well the evidence actually backs the recommendation
- Optionally: charts, gap analysis, scenario stress-tests, transferability scores

**The killer workflow:**  
Open opportunity → match to CPC capabilities → assess the evidence → identify gaps → recommend → generate brief → share

---

## The Tech Stack (for context)

| Layer | What it is |
|-------|------------|
| Frontend | Next.js 15 + React 19, Tailwind CSS |
| Agent runtime | LangGraph (Python), 4 specialist agents |
| Chat bridge | CopilotKit + AG-UI — agents update live UI state |
| LLM | Anthropic Claude Sonnet (only) |
| Database | Supabase (pgvector) — CPC corpus, projects, knowledge chunks |
| Charts | ECharts, Recharts, Vega-Lite — all three live |
| Canvas | tldraw (wired, not yet surfaced in UI) |
| Auth | better-auth (sign-in / sign-up working) |
| Deployment | Vercel (frontend) + Railway (Python agents) |

---

## What Is Built and Working Right Now

### ✅ The Core Intelligence Pipeline
The full chain from chat → agent → structured output → UI update is live:

1. User types a question in the chat panel
2. CopilotKit routes it to the LangGraph Python agent (`my_agent`)
3. The agent searches the Supabase corpus (pgvector semantic search across 3 tables)
4. Agent calls state-update tools that push structured data into the React shell
5. The artifact panel re-renders with the structured output
6. The chat narrates what was found

This is the core value loop — **it works end to end.**

### ✅ Corpus Search (live against real CPC data)
- `search_corpus_projects` — CPC-funded/R&D projects (atlas.projects)
- `search_corpus_evidence` — policy/strategy/report knowledge (atlas.knowledge_chunks)
- `search_corpus_live_calls` — live funding opportunities (atlas.live_calls)
- `search_hive_evidence` — HIVE case studies, climate adaptation articles
- `get_corpus_stats` — real row counts from live DB
- All results include similarity scores and confidence tier guidance

### ✅ Five Case Model Brief (Green Book)
When asked to assess an opportunity, the agent builds a structured brief with five sections:
- **Strategic Case** — policy alignment, strategic rationale
- **Economic Case** — value for money, NPV at 3.5% HMT STPR, optimism bias
- **Commercial Case** — market opportunity, funding landscape
- **Financial Case** — funding sources, amounts, comparable projects
- **Management Case** — delivery, governance, risk

Each section is grounded in real corpus citations. Every ID verified against the DB before display.

### ✅ Confidence Tier System (anti-hallucination guardrail)
- **Speculative** — no corpus evidence or weak single match
- **Indicative** — some evidence, thin or single-source
- **Supported** — 3+ records from 2+ source types
- **Robust** — 5+ records across 3+ source types, high similarity
- The system caps the agent's claimed tier at what the evidence actually supports

### ✅ Citation Verification
Every corpus citation the agent claims is verified against the live Supabase database before it appears in the UI. Fabricated UUIDs are silently dropped. This is a core integrity feature.

### ✅ Artifact Pane (4 Recipe Types)
The right-hand panel renders structured output in four layouts:

| Recipe | What it renders |
|--------|----------------|
| `brief_five_case` | Full Five Case Model brief with expandable sections + citations |
| `evidence_panel` | Citation grid — title, org, similarity score, source type |
| `stats_dashboard` | KPI tiles + embedded charts + NPV surface |
| `scenario_stress_test` | Hypothesis / Supporting / Challenging / Assumptions / Verdict |

### ✅ Decision Spine
A persistent right-rail component showing:
- The key decision being assessed
- Current recommendation
- Confidence tier badge (colour-coded)
- Key assumption
- Next action

Updated live by the agent as the conversation progresses.

### ✅ Trust Rail (4-Lane Evidence Display)
Visual display of evidence quality across four lanes:
- 🟢 Internal CPC — own projects and portfolio
- 🔵 Official Policy — GOV.UK, Green Book, DLUHC, DfT
- 🟡 External Web — Exa search, third-party evidence
- 🔴 Evidence Gaps — what's missing, by gap type

### ✅ Pinned Metrics / KPI Tiles
Agent can push live metrics tiles to the top of the dashboard:
- Total corpus projects, knowledge chunks, live calls
- NPV estimates
- Transferability scores
- Evidence coverage percentages

### ✅ Chart Rendering (3 Engines)
- Bar, line, area, scatter, pie, radial bar, network graph
- ECharts (interactive), Recharts (React-native), Vega-Lite (declarative)
- Charts can be attached to artifacts (travel with the brief) or added to workspace independently

### ✅ Scenario / Stress-Test Mode
Agent can produce structured scenario analysis:
- "What would need to be true for X?" 
- "Stress test this assumption"
- Returns Hypothesis, Supporting Evidence, Challenging Evidence, Key Assumptions (HELD/FRAGILE/UNVERIFIED), Verdict

### ✅ Passport System (Opportunity Matching)
- Upload an opportunity document (PDF, DOCX, text)
- System extracts structured claims (tech readiness, CPC alignment, funding ask, etc.)
- Matches against CPC capability corpus using pgvector
- Returns ranked capability matches with confidence scores and evidence gaps
- Passport list page, passport detail view, claim-level evidence display

### ✅ Visualisation Lab (`/lab`)
- Interactive chart bake-off page — ECharts vs Recharts vs Vega
- Network graph with force-directed layout (for corpus relationship mapping)
- Chart type vocabulary explorer
- Framework comparison for specific chart types

### ✅ Auth System
- Sign-in / sign-up pages (better-auth)
- Session management
- Auth-gated API routes in production

### ✅ Skills (Methodology Injected at Runtime)
Three markdown skill files injected into agent context before every run:
- `green-book.md` — UK HM Treasury Green Book methodology
- `evidence-triage.md` — how to assess and weight evidence quality
- `analogue-method.md` — cross-sector transfer, CICERONE methodology

### ✅ Surface State / Mode Switching
Agent can switch the UI between three surface modes:
- **Chat** — conversational interface
- **Artifact** — structured brief/evidence panel front-and-centre
- **Canvas** — tldraw whiteboard (plumbed, not yet exposed)

---

## What Is Ported / Built But Not Yet Fully Wired

### ⚠️ Multi-Agent Routing (ATLAS / JARVIS / CICERONE / HYVE)
The four specialist agents are built in Python (`/agents/atlas/`, `/agents/jarvis/`, `/agents/cicerone/`, `/agents/hyve/`) but the spike currently runs as a single combined `my_agent`. The agent-switcher UI component exists. Needs routing wired in the frontend.

| Agent | Speciality | Output |
|-------|-----------|--------|
| **ATLAS** | Green Book investment case | Five Case Model, NPV, confidence tier |
| **JARVIS** | Corpus explorer | Evidence citations, similarity ranking |
| **CICERONE** | Cross-sector transfer | Transferability score 0-100, analogues, gap map |
| **HYVE** | Climate/HIVE intelligence | Transport mode evidence, climate adaptation |

### ⚠️ Canvas Mode (tldraw)
- tldraw is installed and the `canvas-pane.tsx` component exists
- `atlas.canvas_scenes` Supabase table exists (migration ready)
- Canvas API route exists (`/api/atlas5/canvas`)
- Not yet surfaced in the main shell — no button to open it

### ⚠️ Brief Persistence
- `atlas.briefs` table exists in Supabase
- No `POST /api/atlas5/brief` save route yet
- No save button in the ArtifactPane
- Briefs are ephemeral (lost on refresh)

### ⚠️ Lens Selector (5 Lenses)
UI component `lens-selector.tsx` exists. Not yet wired to change agent search behaviour.
- CPC — own portfolio focus
- Atlas — full innovation corpus
- Ecosystem — partnerships
- Funder — investment landscape
- Mode — transport mode-specific (rail, road, active travel)

### ⚠️ Context Assembler (full wiring)
`context-assembler.ts` built — assembles session history, prior citations, active skills into a context packet. Not yet fully wired to per-request injection.

### ⚠️ NPV Calculator UI
The agent can calculate NPV at 3.5% STPR. The `stats_dashboard` recipe shows it. No dedicated UI surface yet (input fields for cost/benefit/time horizon, what-if sliders).

### ⚠️ CPC Capability Assessment Recipes
Four CPC-specific recipe renderers are built but not exposed:
- `cpc-capability-assessment.tsx`
- `cpc-evidence-gaps.tsx`
- `cpc-market-alignment.tsx`
- `cpc-portfolio-comparison.tsx`

### ⚠️ Exa Web Search + GovUK MCP
`external_search.py` exists in agents. Exa API key is present. GovUK MCP tools available. Not yet integrated into agent tool calls.

### ⚠️ Graphiti Knowledge Graph
FalkorDB + Graphiti MCP is configured (group_id: atlas5). Not yet called from agents. Could store session memory, cross-session context, relationship maps.

---

## Untouched Capabilities (Available, Unused)

| Capability | What it enables |
|-----------|----------------|
| **Graphiti knowledge graph** | Persistent cross-session memory; relationship mapping between entities, projects, organisations |
| **Exa web search** | Real-time market intelligence beyond the corpus; live competitor/policy scanning |
| **GovUK MCP** | Companies House, TfL, NHS, Parliament data — live government data enrichment |
| **tldraw canvas** | Whiteboard collaboration; agent-drawn diagrams; visual brief layouts |
| **Excalidraw MCP** | Agent-generated architecture/flow diagrams inside briefs |
| **OSM / geo tools** | Location-based analysis; catchment areas; infrastructure mapping |
| **UK ONS datasets** | Live economic stats; labour market; regional productivity data |
| **Scenario modeler skill** | Monte Carlo stress-testing of financial assumptions |
| **Passport bulk upload** | Batch opportunity processing (CSV → structured passports) |
| **Brief export** | PDF/DOCX export of completed Five Case briefs |
| **Eval harness (Tier 1 + 2)** | 102 automated tests for agent output quality; golden dataset comparison |
| **Weekly data scraping** | Scheduled ingestion of new CPC projects, HIVE articles, live calls |
| **CopilotKit interrupts** | Human-in-the-loop checkpoints mid-agent-run (e.g., "confirm before searching external web") |
| **JARVIS evidence triage** | Deep corpus dive mode — evidence quality scoring, contradiction detection |
| **CICERONE transferability** | Score an insight's transferability across sectors; sector analogue identification |
| **HYVE climate mode** | Climate adaptation evidence; transport resilience; green infrastructure |

---

## The Three Most Compelling UI Concepts

---

### Concept 1: The Intelligence Brief Builder
*"From question to investment case in one session"*

**The premise:** The primary deliverable is a Green Book-compliant investment brief. The UI makes brief-building feel fast, rigorous, and credible — not like talking to a chatbot.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  [ATLAS] [JARVIS] [CICERONE] [HYVE]   [CPC▾] lens      │  ← Agent + lens rail
├──────────────┬──────────────────────────────────────────┤
│              │  FIVE CASE BRIEF                         │
│  CHAT        │  ┌─────────┬─────────┬─────────┐        │
│              │  │Strategic│Economic │Commercial│        │
│  [History]   │  │ ██████  │ ████    │ ████    │        │  ← Brief sections with
│              │  └─────────┴─────────┴─────────┘        │    fill-state indicator
│  [Ask        │  Financial ──────────────────────        │
│   Atlas...]  │  Management ─────────────────────        │
│              │                                          │
│              │  ┌──────────────────────────────┐        │
│              │  │ EVIDENCE  ●●●○  Supported    │        │  ← Citation rail
│              │  │ 12 records · 3 source types  │        │
│              │  └──────────────────────────────┘        │
│              │                                          │
│              │  [DECISION SPINE]                        │
│              │  Recommend: Proceed to full appraisal    │  ← Persistent spine
│              │  Confidence: Supported ████░             │
│              │  Key gap: External market sizing         │
│              │  Next: Commission demand study           │
└──────────────┴──────────────────────────────────────────┘
```

**Why it's compelling:**
- Immediately legible to CPC strategists — they recognise the Green Book structure
- Progress indicators on each case section show completeness
- The evidence rail and confidence tier are always visible — the "why should I trust this" question is answered on screen, not buried
- Decision spine gives a one-line status at all times — senior stakeholders can glance and orient
- Save brief → export to PDF/DOCX from the toolbar

**Primary outcome it delivers:** A completed, evidence-backed investment brief that can go to a CPC investment panel or funding body.

---

### Concept 2: The Evidence Explorer
*"Show me what CPC knows, then help me think"*

**The premise:** The corpus IS the product. Show the knowledge graph first. Chat is how you drill in. The brief is a by-product of exploration.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  ATLAS v0.5                    [Search corpus...    🔍]  │
├──────────────────────────┬──────────────────────────────┤
│                          │                              │
│   CORPUS MAP             │   EVIDENCE PANEL             │
│                          │                              │
│   ● EV Charging (47)     │   ┌──────────────────────┐  │
│   ● Active Travel (31)   │   │ "EV Infrastructure   │  │
│   ● Smart Mobility (22)  │   │  in Suburban Areas"  │  │
│   ● Climate Adapt (18)   │   │  Score: 0.89 ●●●●    │  │
│   ● Data & Digital (29)  │   │  CPC 2024 · Supported│  │
│                          │   └──────────────────────┘  │
│   [+ 14 themes]          │   [+ 11 more records]        │
│                          │                              │
│   Recent:                │   TRUST RAIL                 │
│   > HS2 Connectivity     │   ■ Internal   ████████░     │
│   > Freight Decarbonise  │   ■ Policy     █████░░░░     │
│   > MaaS Scotland        │   □ External   ░░░░░░░░░     │
│                          │   ✗ Gaps       ████░░░░░     │
├──────────────────────────┴──────────────────────────────┤
│  JARVIS ▸ Tell me about EV charging evidence in...      │
└─────────────────────────────────────────────────────────┘
```

**Why it's compelling:**
- Demonstrates the corpus richness immediately — CPC sees their own knowledge made useful
- Theme clustering shows strategic coverage at a glance
- Trust Rail is the hero — it answers "what do we actually know vs what are we guessing?"
- Low-floor: you can browse without knowing what to ask
- The best demo for commercialisation conversations — "here's what your corpus contains"

**Primary outcome it delivers:** Rapid orientation in a new domain; gap identification before committing to an opportunity.

---

### Concept 3: The Opportunity Passport
*"An opportunity lands on your desk — what does Atlas make of it?"*

**The premise:** The entry point is an incoming opportunity or brief. Upload it. Atlas reads it, extracts claims, matches to CPC capabilities, and produces a structured assessment. No blank-page anxiety.

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│  OPPORTUNITY ASSESSMENT                [+ New]  [Browse] │
├────────────────────┬────────────────────────────────────┤
│                    │                                     │
│  PASSPORT          │  CAPABILITY MATCH                   │
│  ──────────        │                                     │
│  📄 Drop file or   │  ┌─────────────────────────────┐   │
│     paste text     │  │ MaaS Integration            │   │
│                    │  │ Match: 94% · TRL 6           │   │
│  EXTRACTED CLAIMS  │  │ ●●●● Robust evidence         │   │
│  ──────────────    │  │ ▸ 8 CPC projects align       │   │
│  ✓ Funding ask:    │  └─────────────────────────────┘   │
│    £2.4M           │                                     │
│  ✓ Tech: MaaS      │  ┌─────────────────────────────┐   │
│    platform        │  │ Data Platform Services      │   │
│  ✓ Geography:      │  │ Match: 78% · TRL 4           │   │
│    North West      │  │ ●●●○ Supported evidence      │   │
│  ⚠ Timeline:       │  └─────────────────────────────┘   │
│    unverified      │                                     │
│                    │  EVIDENCE GAPS                      │
│  CONFIDENCE:       │  ✗ External market sizing           │
│  Indicative ●●○○   │  ✗ Regulatory approval path        │
│                    │  ~ Competitor landscape (partial)   │
│  [Generate Brief]  │                                     │
└────────────────────┴────────────────────────────────────┘
```

**Why it's compelling:**
- Mirrors how CPC actually works — opportunities arrive, they need rapid triage
- Extracting claims from uploaded documents is a wow moment in a demo
- Evidence gaps are actionable — "here's exactly what we'd need to commission"
- "Generate Brief" button completes the loop to Concept 1
- The passport list becomes a deal pipeline / opportunity register

**Primary outcome it delivers:** Rapid go/no-go assessment with an evidence-backed recommendation and a clear list of what needs to be answered before committing.

---

## Recommended Layout System Principles

Drawing from what already exists and what the brief engine needs:

### 1. Three-Zone Shell (not two-panel)
```
[Left rail 280px]  [Center 1fr]  [Right panel 380px]
 Nav + history      Active work   Artifact / spine
```
The center zone switches between: chat thread | brief document | evidence grid | canvas

### 2. Agent + Lens as Navigation, Not Settings
The agent selector (ATLAS / JARVIS / CICERONE / HYVE) and lens (CPC / Ecosystem / Funder / Mode) should sit in the top nav, always visible — they define **what Atlas is doing**, not how the app is configured. When you switch from JARVIS to ATLAS the center zone transforms.

### 3. Confidence Tier as a Visual Language
Use consistent colour coding everywhere:
- 🔴 Speculative — orange/amber
- 🟡 Indicative — yellow
- 🟢 Supported — green
- 💎 Robust — blue/indigo

This language should appear on brief sections, citation cards, match scores — everywhere confidence is expressed.

### 4. Evidence Density Spectrum
Not every interaction needs a full Five Case brief. The UI should handle a spectrum:
```
Quick answer  →  Evidence panel  →  Scenario test  →  Full brief
(chat reply)     (citation grid)    (stress test)     (Five Case)
```
The artifact pane already supports this via the 4 recipe types. The layout should make this spectrum navigable.

### 5. Progressive Disclosure for Briefs
Brief sections should start collapsed (showing just a status indicator and confidence tier) and expand on click. This prevents cognitive overload and lets senior users scan before diving in.

---

## Prose vs Component Balance Recommendation

Current state: heavy on prose (chat narration), light on structured components.
Target state: components lead, prose narrates.

```
Current:   ████████████░░░░  (80% prose / 20% components)
Target:    ████████████████  (40% prose / 60% components)
```

**What this means in practice:**
- The brief artifact should always be visible in the right panel — not just text in the chat
- Citation cards should be inline visual chips, not bullet-point text
- Confidence tier should be a badge, not a word in a sentence
- Evidence gaps should be a structured list with status icons, not a paragraph
- The chat narrates **what the components already show** — "Here's the strategic case. The evidence is strong on policy alignment but I've flagged a gap in market sizing — see the evidence panel."

---

## What Delivers the Ultimate Outcomes

| Outcome | Primary Feature | Supporting Features |
|---------|----------------|---------------------|
| **Win a funding bid** | ATLAS Five Case brief with verified evidence | JARVIS evidence panel, NPV calculator, confidence tier |
| **Rapid opportunity triage** | Passport matching + evidence gap map | Decision spine, trust rail, CICERONE score |
| **Prove CPC's unique value** | Evidence Explorer showing corpus richness | Theme clustering, source diversity, trust rail |
| **Identify white space** | CICERONE cross-sector transfer | Graphiti relationship map, evidence gap classification |
| **Climate resilience case** | HYVE HIVE evidence + transport mode mapping | Scenario stress-test, GOV.UK policy grounding |
| **Internal capability audit** | CPC portfolio comparison recipe | CPC lens, capability assessment, project clustering |
| **Inform a strategy day** | Canvas mode + agent-drawn diagrams | Scenario modeler, network graph, slide export |
| **Commercialisation evidence** | Full platform demo — live corpus, live agent | All of the above |

---

## Questions for the Wireframe Brief

Designers should resolve:

1. **What is the primary view on first load?** Options: blank chat, corpus dashboard, recent briefs, opportunity inbox
2. **Where does the artifact live relative to chat?** Overlapping panel, side-by-side, tabs, or full-screen toggle?
3. **How does the agent switcher feel?** Tabs at top, sidebar items, a mode dial, or contextual (it switches automatically based on question type)?
4. **Is the lens a user choice or automatic?** CPC staff always on CPC lens; external users need to choose
5. **How does a brief get shared/exported?** Direct link, PDF, PowerPoint deck?
6. **Mobile posture** — is this a desktop-only tool or does it need a mobile reading mode?

---

## Handoff Checklist for Designers

- [ ] Review Concept 1, 2, 3 above — pick one primary direction or propose a hybrid
- [ ] Propose 2–5 layout concepts (low-fidelity wireframes)
- [ ] Show how chat and artifacts co-exist in each concept
- [ ] Include the confidence tier visual language in at least one concept
- [ ] Include one concept that demonstrates the corpus richness (the "wow" moment)
- [ ] Indicate component density vs prose in each layout (rough ratio)
- [ ] Consider: how does a senior stakeholder know at a glance that this is evidence-backed, not hallucinated?

---

*Atlas v0.5 — Connected Places Catapult Strategic Intelligence Platform*  
*Repo: DayoOdunlami/Atlas-v0.5 | Frontend: Vercel | Agents: Railway | DB: Supabase afysgjiczzptubonbuxs*
