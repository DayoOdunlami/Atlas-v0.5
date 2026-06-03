# Sprint 4B MVP — Demo Script (15 min)

**Primary path:** `/` (assistant-ui + LangGraph)  
**Lab path:** `/lab/copilotkit` (CopilotKit + AG-UI)

## Setup

```bash
pnpm run dev
# If thread list empty / stream fails, also run LangGraph CLI on :2024
python -m langgraph_cli dev
```

Optional weak-signal scout:

```bash
# .env.local
ATLAS_EXTERNAL_SCOUT_V1=true
TAVILY_API_KEY=...
```

---

## Flow (3 queries + 2 follow-ups)

### 1. Orient — UK CAT (~5 min)

**Query:** *Explore the innovation landscape for connected and autonomous transport in the UK.*

**Show:**
- RunProgress steps (search → build → complete)
- Headline appears before run finishes
- Orient collapsed sections (Landscape Overview, Key Players, CPC Position)
- Confidence tier + citation guard badge if tier capped

**Pass if:** headline + insight_card + tier visible; no Supported with 0–2 citations

---

### 2. Clarify follow-up (~2 min)

**Query:** *What is NPV?*

**Pass if:** long chat answer; artifact unchanged; no full pipeline rerun feel

---

### 3. Refine follow-up (~2 min)

**Query:** *Add key players to the landscape*

**Pass if:** artifact patches; short chat ack; Orient sections update

---

### 4. Weak signals (~4 min)

**Query:** *What are the strongest market signals in GPS-denied urban autonomy right now?*

**Show:**
- Speculative/Indicative tier if corpus thin
- “Evidence limited” banner on Orient
- External citations in trust rail (if scout enabled) — labelled separately

**Pass if:** honest tier; no fake Supported

---

### 5. Act — Five Case (~2 min, optional)

**Query:** *Build a Five Case investment brief for autonomous port inspection drones.*

**Pass if:** Five Case sections + NPV/radar blocks + tier

---

## Stakeholder talking points

1. **Not a PDF bot** — governed artifact waterfall, not markdown dump  
2. **Trust** — citation guard caps tier when evidence thin  
3. **Multi-turn** — clarify/refine without rerunning full analyze every message  
4. **Scout lane** — optional Tavily behind flag; never mixed with CPC corpus citations  

---

## Kill / pause criteria

- Supported tier with ≤2 corpus citations after guard → **block demo**, fix guard  
- `/` does not load assistant-ui shell → **block demo**  
- Weak-signal query shows confident headline + empty artifact with no explanation → **fix empty states**
