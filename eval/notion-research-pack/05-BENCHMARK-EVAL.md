# ATLAS — Benchmark Queries & Eval Criteria

**Last updated:** 2026-06-03

---

## Five canonical benchmark queries

Use these for any ATLAS vs external tool comparison:

1. **Orient — UK CAT**  
   *Explore the innovation landscape for connected and autonomous transport in the UK.*

2. **Diagnose — port inspection**  
   *Can CPC credibly play in autonomous port inspection? What is missing?*

3. **Weak signals**  
   *What are the strongest market signals in GPS-denied urban autonomy right now?*

4. **Act — Five Case**  
   *Build a Five Case investment brief for autonomous port inspection drones.*

5. **Connect — funding**  
   *What funding routes exist for autonomous rail or transport AI testbeds in the UK?*

---

## Expected ATLAS behaviour (post–Sprint 4)

| Query | Expected recipe | Minimum contract |
|-------|-----------------|------------------|
| 1 | orient | headline + insight_card + sections + visual_blocks when ≥3 citations |
| 2 | diagnose | gap_rows or gap_matrix + verdict headline |
| 3 | orient/diagnose | honest Speculative if 0 corpus hits — no fake Supported |
| 4 | act | Five Case sections + confidence tier |
| 5 | connect | opportunity/funding framing + citations or gaps |

---

## Scoring dimensions (0–5 each)

**Evidence & trust**
- Source quality
- Citation verifiability (chunk/ID level)
- Honesty when evidence thin
- Confidence tier alignment
- Claim traceability

**Product fit**
- Structured artifact compatibility (can map to ATLAS JSON?)
- CPC / UK transport relevance
- Decision usefulness (actionable verdict?)
- Multi-turn support (clarify/refine without full rerun)

**UX**
- Visual / artifact readiness
- Empty-state quality
- Progress / explainability
- Demo / stakeholder quality

**Engineering**
- Latency
- Integration effort into LangGraph
- Governance preservation
- Maintenance / license risk

---

## Comparison candidates (minimum set)

**Backend / research**
- LangChain Open Deep Research
- GPT Researcher
- One Tavily-based agent (e.g. compete-scope, competiq)
- zircote/sigint (methodology — falsification, dimensions)

**RAG / verification**
- ReasonGraph, Citadel, paper-qa, or RAG-verification repo

**UI / UX**
- CopilotKit generative UI patterns (baseline — compare improve vs replace)
- assistant-ui (baseline — lab path)
- Vercel AI SDK generative UI
- OpenBB workspace UX (reference only)

**Design / viz**
- shadcn/ui + Tremor + React Flow (extend current stack?)

---

## Classification taxonomy

Use exactly one per candidate:

1. **Replace layer**
2. **Absorb pattern**
3. **External lane**
4. **UI/component adoption**
5. **Benchmark only**
6. **Ignore**

---

## Kill criteria (examples)

- External scout: disable if >30% unverified claims at Supported tier
- UI shell migration: kill if cannot support custom artifact pane + structured JSON
- GraphRAG: kill if integration >2 sprints without citation ID parity
- New chart library: kill if doesn't improve Orient/Diagnose empty states first

---

## Deliverable format for benchmark run

For each query × candidate, record:

- Headline (quote)
- Citation count + verifiability notes
- Structured vs prose-only
- Tier honesty
- Time to first useful output
- Screenshot description
- **Integrate / adapt / ignore** recommendation
