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

  if (words.length === 0 || (words.length <= 6 && GREETING_WORDS.has(first))) {
    return `${emoji} Hi! I'm **${agentId}** — ${desc}`;
  }
  if (words.length <= 5 && THANKS_WORDS.has(first)) {
    return "You're welcome! Ask me anything. 🙂";
  }
  // meta / off-topic
  return `I'm **${agentId}** — ${desc} Ask me a substantive question and I'll return a full response with verified corpus citations.`;
}
