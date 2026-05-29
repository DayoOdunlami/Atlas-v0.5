/**
 * Edge classifier — TypeScript port of agents/base.py:is_conversational().
 *
 * Runs client-side before any message hits the Python agent.
 * Conversational queries get an instant reply; domain queries go through
 * the full pipeline. Keep this in sync with agents/base.py DOMAIN_KW.
 */

import type { AgentId } from "@/lib/atlas5/types";

// ---------------------------------------------------------------------------
// Domain keyword set — mirrors agents/base.py DOMAIN_KW exactly
// ---------------------------------------------------------------------------

const DOMAIN_KW: string[] = [
  // CPC / programme terms
  "cpc", "catapult", "connected places",
  // Business case / investment
  "case", "brief", "invest", "appraisal", "bcr", "npv", "stpr", "green book",
  "five case", "sobc", "obc", "fbc",
  // Evidence / corpus
  "evidence", "corpus", "project", "citation", "finding",
  // Funding / procurement
  "fund", "grant", "innovate", "ukri", "horizon", "tender", "procurement",
  // Transport / infrastructure
  "transport", "freight", "rail", "road", "active travel", "travel", "corridor",
  "infrastr", "highway", "network", "maas", "mobility",
  // Technology domains
  "ev", "electric vehicle", "autonomous", "cav", "connected", "digital",
  "data", "sensor", "smart", "carbon", "climate", "adaptation", "resilience",
  "hive", "hyve",
  // Strategy / analysis
  "strategy", "strategic", "economic", "commercial", "financial",
  "management", "analogue", "transfer", "sector", "gap", "risk",
];

const GREETING_WORDS = new Set([
  "hello", "hi", "hey", "howdy", "greetings", "hiya", "yo",
]);

const THANKS_WORDS = new Set([
  "thanks", "thank", "cheers", "ta", "thx", "ty",
]);

const META_PHRASES: string[] = [
  "who are you", "what are you", "what can you do", "what do you do",
  "help", "help me", "whats your name", "what's your name",
  "tell me about yourself", "how do you work", "how does this work",
  "what is this", "what is atlas",
  "why are you not", "why aren't you", "why wont you", "why won't you",
  "i dont understand", "i don't understand", "i don't get it", "i dont get it",
  "not responding", "not answering", "not working",
  "what are you doing", "what is happening", "whats happening",
  "are you broken", "are you working",
];

// ---------------------------------------------------------------------------
// isConversational — mirrors agents/base.py:is_conversational()
// ---------------------------------------------------------------------------

export function isConversational(text: string): boolean {
  if (!text || !text.trim()) return true;
  const ql = text.toLowerCase().trim();

  // Rule 1 — any domain keyword → always run the pipeline
  if (DOMAIN_KW.some((kw) => ql.includes(kw))) return false;

  const words = ql.split(/\s+/).filter(Boolean);
  const n = words.length;
  const first = (words[0] ?? "").replace(/[,.!?]/g, "");

  const isGreeting = n === 0 || (n <= 6 && GREETING_WORDS.has(first));
  const isThanks   = n <= 5 && THANKS_WORDS.has(first);
  const isMeta     = META_PHRASES.some((phrase) => ql.includes(phrase));
  const isTrivial  = n <= 3;

  return isGreeting || isThanks || isMeta || isTrivial;
}

// ---------------------------------------------------------------------------
// getInstantReply — per-agent personalised reply for conversational queries
// ---------------------------------------------------------------------------

const AGENT_DESCRIPTIONS: Record<AgentId, string> = {
  ATLAS:    "CPC's Green Book investment strategist — ask me to build a Five Case Model brief.",
  JARVIS:   "CPC's corpus explorer — ask me what the evidence base knows.",
  CICERONE: "CPC's cross-sector transfer analyst — ask me to score transferability.",
  HYVE:     "CPC's climate adaptation specialist — ask me about HIVE case studies.",
};

const AGENT_EMOJIS: Record<AgentId, string> = {
  ATLAS: "👋", JARVIS: "🔍", CICERONE: "🧭", HYVE: "🌿",
};

export function getInstantReply(text: string, agentId: AgentId): string {
  const ql = text.toLowerCase().trim();
  const words = ql.split(/\s+/).filter(Boolean);
  const first = (words[0] ?? "").replace(/[,.!?]/g, "");
  const emoji = AGENT_EMOJIS[agentId] ?? "👋";
  const desc  = AGENT_DESCRIPTIONS[agentId] ?? AGENT_DESCRIPTIONS.ATLAS;

  // ── Greeting ──────────────────────────────────────────────────────────────
  if (words.length === 0 || (words.length <= 6 && GREETING_WORDS.has(first))) {
    return `${emoji} Hi! I'm **${agentId}** — ${desc}`;
  }

  // ── Thanks ────────────────────────────────────────────────────────────────
  if (words.length <= 5 && THANKS_WORDS.has(first)) {
    return "You're welcome! Fire away with a domain question whenever you're ready. 🙂";
  }

  // ── "How do you work / how does this work" ────────────────────────────────
  if (ql.includes("how do you work") || ql.includes("how does this work") || ql.includes("how does it work")) {
    return `I run a multi-step reasoning pipeline: query classification → corpus search → citation verification → structured output. Ask me a domain question to see it in action.`;
  }

  // ── "Who / what are you" or name queries ──────────────────────────────────
  if (ql.includes("who are you") || ql.includes("what are you") || ql.includes("your name") || ql.includes("what's your name") || ql.includes("whats your name")) {
    return `I'm **${agentId}** — ${desc}`;
  }

  // ── "What can you do / help" ──────────────────────────────────────────────
  if (ql.includes("what can you do") || ql.includes("what do you do") || ql.includes("help me") || ql === "help") {
    return `${emoji} **${agentId}** can: search the CPC corpus, build Five Case Model briefs with Green Book NPV, verify every citation against the live Supabase corpus, and score cross-sector transferability. Just ask a domain question.`;
  }

  // ── Repetition / "why same" frustration ───────────────────────────────────
  if (
    ql.includes("repeat") || ql.includes("same") || ql.includes("again") ||
    ql.includes("why keep") || ql.includes("stop saying")
  ) {
    return `Short conversational messages (greetings, thanks, vague phrases) are answered instantly on the client — no Python call. That's why the reply looks the same. Ask me a substantive question (EV charging, freight corridors, investment case…) and you'll get a full reasoned response with live corpus citations.`;
  }

  // ── "Not working / broken / not responding" ───────────────────────────────
  if (ql.includes("not working") || ql.includes("broken") || ql.includes("not respond") || ql.includes("not answer")) {
    return `I'm running fine — short or vague messages get instant local replies to save latency. Try asking a domain question (e.g. *"What is the strategic case for autonomous freight corridors?"*) and you'll see the full reasoning pipeline fire.`;
  }

  // ── "What is this / what is atlas" ───────────────────────────────────────
  if (ql.includes("what is this") || ql.includes("what is atlas") || ql.includes("tell me about yourself")) {
    return `**Atlas 5** is CPC's multi-agent strategic intelligence platform. I'm **${agentId}** — ${desc}`;
  }

  // ── Noise / trivial (≤ 3 words, no domain keyword) ───────────────────────
  return `Ask me a substantive question — about transport strategy, investment cases, EV, freight, active travel, climate adaptation — and I'll run the full pipeline with verified corpus citations.`;
}
