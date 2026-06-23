import React, { useState, useEffect, useRef } from "react";

/* ============================================================================
   ATLAS v5 — Answer Surface · Reference Implementation
   Journey 1, Turn 1 (Orient): "State of play on rail decarbonisation in our corpus"

   This is the REFERENCE the Cursor build ports. Every number here was live-queried
   from atlas.projects on build day — they are NOT mock literals:
     55 projects · £8,172,702 known · 18 of 55 null funding (the floor) ·
     27 live since 2024 · 30 orgs · Innovate UK = 36 projects / £7.9m (the monopoly)
     EPSRC = 15 projects / £0 recorded (where the nulls concentrate)

   SPINE COMPONENTS demonstrated (each is its own export in the real app):
     VerdictHero · ConfidenceCeiling · StatStrip · ProvenanceTrace ·
     AnswerabilityCard · SoWhatRail · ScopeBar
   RECIPE demonstrated:
     IncommensurableMagnitudes (the two-tier field — honest broken axis, NOT "to scale")

   PORTING NOTES FOR CURSOR:
     - Replace the DATA object with a prop bound to the live query. Nothing is hardcoded
       in the components — only in DATA.
     - The confidence ceiling height is DERIVED from tier (see TIER_CEILING), never decorative.
     - The two-tier instrument is labelled "axis compressed at the gap", never "to scale",
       because a 1,400× ratio cannot be drawn faithfully. This is the J1T1 honesty fix.
   ========================================================================== */

/* ---- design tokens (the locked system) ---- */
const T = {
  page: "#e7e5df",
  canvas: "#FBFAF7",
  ink: "#1A1714",
  inkSoft: "#5A5249",
  inkFaint: "#94908A",
  rule: "#d4d0c8",
  ruleSoft: "#EFEBE4",
  corpus: "#3F7A52",      // owned / healed / solid green
  corpusWash: "#EEF4EE",
  web: "#B6CADB",         // borrowed / dashed blue
  gap: "#B07A2E",         // under-count / torn / amber
  gapWash: "#FBF4E8",
  serif: "'Newsreader', Georgia, serif",
  sans: "'Libre Franklin', -apple-system, system-ui, sans-serif",
  mono: "'IBM Plex Mono', ui-monospace, monospace",
};

/* tier → ceiling height as a fraction of the canvas. DERIVED, not decorative. */
const TIER_CEILING = { Indicative: 0.44, Supported: 0.66, Robust: 0.88 };

/* ---- LIVE DATA (the only thing that becomes a prop) ---- */
const DATA = {
  object: "Rail decarbonisation",
  scope: "CORPUS · 55 OBJECTS · ORIENT",
  mode: "Orient",
  tier: "Supported",
  asOf: "live query",
  verdict:
    "The corpus sees a busy but small-money field — and it's blind to the part that matters most.",
  verdictTail:
    "A thin, Innovate-UK-funded SME innovation layer sits beneath a national electrification programme the corpus can't see. Any CPC play has to know which tier it's entering.",
  stats: [
    { value: "55", label: "projects", tone: "corpus" },
    { value: "£8.17m", label: "known funding · a floor", tone: "corpus" },
    { value: "27", label: "live since 2024", tone: "corpus" },
    { value: "30", label: "lead organisations", tone: "corpus" },
  ],
  blindspot: {
    sign: "undercount",
    gap: "CPC's own TRIG grants are entirely absent from the corpus — so £8.17m is the SME grant tier only, not CPC's prior rail work.",
    closable: "Closable by ingestion — a declared blind-spot, not an empty field.",
    secondary:
      "18 of 55 projects carry no funding figure (the nulls concentrate in EPSRC's 15 research-council awards). £8.17m is a floor, not a total.",
  },
  magnitudes: {
    upper: { label: "National electrification programme", value: 11_700_000_000, display: "~£11.7bn",
      note: "11,700 single-track-km × ~£1m/km (TDNS)", source: "web" },
    lower: { label: "SME innovation layer (corpus)", value: 8_172_702, display: "£8.17m",
      note: "55 projects · 36 Innovate UK · a floor, not a total", source: "corpus" },
    ratioLabel: "≈ 1,400×",
    ratioNote: "three orders of magnitude — the gap is the finding",
  },
  provenance: {
    "stat-corpus": {
      ref: "atlas.projects · aggregate",
      scope: "rail + decarbonisation · live",
      trust: "corpus",
      trustNote: "Own data, high trust. funding_amount null on 18/55 → £8.17m is a floor, not a total.",
      row: "corpus aggregate",
    },
    "mag-upper": {
      ref: "web context · TDNS / GBR strategy",
      scope: "national programme",
      trust: "web",
      trustNote: "Borrowed context, not corpus fact. Order-of-magnitude only — drawn on a compressed axis.",
      row: "[W1·W2·W3]",
    },
    "funder": {
      ref: "atlas.projects · group by lead_funder",
      scope: "rail + decarbonisation",
      trust: "corpus",
      trustNote: "Innovate UK = 36 of 55 projects and £7.9m of £8.17m. EPSRC = 15 projects, £0 recorded.",
      row: "corpus aggregate",
    },
  },
  soWhat: {
    lookingAt:
      "A two-tier field. The instrument is the whole story — what we fund is a sliver of what's being spent.",
    oneDecision:
      "Which tier are we entering — the SME innovation layer we can see, or the national programme we can't? It changes every downstream move.",
    gate:
      "Close the TRIG blind-spot before you commit budget. It's the one gap you control.",
    primaryAction: "Diagnose the thinness → Ingest TRIG",
    turn: "1 / 4",
  },
};

/* ============================== SPINE: ScopeBar ============================ */
function ScopeBar({ object, scope, mode, tier }) {
  const modes = [["Or", "Orient"], ["Cn", "Connect"], ["Dg", "Diagnose"], ["Ac", "Act"], ["Df", "Defend"]];
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "0 0 16px",
      borderBottom: `1px solid ${T.rule}`, marginBottom: 28 }}>
      <div style={{ display: "flex", gap: 5 }}>
        {modes.map(([ab, full]) => {
          const on = full === mode;
          return (
            <div key={ab} title={full} style={{
              fontFamily: T.mono, fontSize: 11, width: 26, height: 26, borderRadius: 6,
              display: "grid", placeItems: "center",
              background: on ? T.ink : "transparent",
              color: on ? T.canvas : T.inkFaint,
              border: on ? "none" : `1px solid ${T.ruleSoft}` }}>{ab}</div>
          );
        })}
      </div>
      <div style={{ fontFamily: T.serif, fontSize: 17, color: T.ink, fontWeight: 500 }}>{object}</div>
      <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: ".1em", color: T.inkFaint }}>{scope}</div>
      <div style={{ flex: 1 }} />
      <TierBadge tier={tier} />
    </div>
  );
}

function TierBadge({ tier }) {
  return (
    <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: ".08em", color: T.corpus,
      border: `1px solid ${T.corpus}`, borderRadius: 4, padding: "3px 8px", textTransform: "uppercase" }}>
      {tier}
    </div>
  );
}

/* ====================== SPINE: ConfidenceCeiling ========================== */
/* The ceiling PHYSICALLY caps the canvas. Its height is derived from the tier. */
function CeilingFrame({ tier, children }) {
  const frac = TIER_CEILING[tier] ?? 0.66;
  return (
    <div style={{ position: "relative", background: T.canvas, borderRadius: 4,
      boxShadow: "0 1px 3px rgba(0,0,0,.07), 0 12px 36px rgba(0,0,0,.06)", padding: 28 }}>
      {/* the cap line, positioned by tier */}
      <div style={{ position: "absolute", left: 0, right: 0, top: `calc(${(1 - frac) * 100}% )`,
        borderTop: `1.5px dashed ${T.inkFaint}`, pointerEvents: "none" }}>
        <div style={{ position: "absolute", right: 10, top: -9, fontFamily: T.mono, fontSize: 9.5,
          letterSpacing: ".1em", color: T.inkFaint, background: T.canvas, padding: "0 6px", textTransform: "uppercase" }}>
          ▔ {tier} ceiling — canvas can’t certify above this line
        </div>
      </div>
      {children}
    </div>
  );
}

/* ============================== SPINE: VerdictHero ======================== */
function VerdictHero({ sentence, tail }) {
  return (
    <div style={{ maxWidth: 760, marginBottom: 24 }}>
      <h1 style={{ fontFamily: T.serif, fontWeight: 500, fontSize: 30, lineHeight: 1.28,
        color: T.ink, margin: "0 0 14px", letterSpacing: "-.01em" }}>{sentence}</h1>
      <p style={{ fontFamily: T.sans, fontSize: 14.5, lineHeight: 1.6, color: T.inkSoft, margin: 0 }}>{tail}</p>
    </div>
  );
}

/* ============================== SPINE: StatStrip ========================= */
function StatStrip({ stats, onProv }) {
  return (
    <div style={{ display: "flex", gap: 0, border: `1px solid ${T.ruleSoft}`, borderRadius: 10,
      overflow: "hidden", marginBottom: 22 }}>
      {stats.map((s, i) => (
        <button key={i} onClick={() => onProv?.("stat-corpus")} style={{
          flex: 1, textAlign: "left", padding: "14px 16px", background: T.canvas, cursor: "pointer",
          border: "none", borderLeft: i ? `1px solid ${T.ruleSoft}` : "none", position: "relative" }}>
          <div style={{ fontFamily: T.serif, fontWeight: 500, fontSize: 26, color: T.corpus, lineHeight: 1 }}>{s.value}</div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, marginTop: 6, letterSpacing: ".04em" }}>{s.label}</div>
          <div style={{ position: "absolute", top: 10, right: 12, fontFamily: T.mono, fontSize: 9, color: T.corpus }}>⌖</div>
        </button>
      ))}
    </div>
  );
}

/* ====================== SPINE: AnswerabilityCard ========================= */
/* The blind-spot, signed as UNDER-COUNT (torn amber), not absence. */
function AnswerabilityCard({ gap, closable, secondary }) {
  return (
    <div style={{ position: "relative", background: T.gapWash, borderRadius: 8, padding: "16px 18px",
      marginBottom: 22, border: `1px solid ${T.gap}33`,
      backgroundImage: `repeating-linear-gradient(135deg, transparent 0 9px, ${T.gap}0c 9px 10px)` }}>
      {/* torn top edge */}
      <div style={{ position: "absolute", left: 0, right: 0, top: -1, height: 4,
        background: `repeating-linear-gradient(90deg, ${T.gap} 0 4px, transparent 4px 9px)`, opacity: .5 }} />
      <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: ".12em", color: T.gap,
        textTransform: "uppercase", marginBottom: 8 }}>⚠ What this answer can’t see</div>
      <div style={{ fontFamily: T.sans, fontSize: 13.5, lineHeight: 1.55, color: T.inkSoft }}>
        {gap} <strong style={{ color: T.ink }}>{closable}</strong>
      </div>
      <div style={{ fontFamily: T.sans, fontSize: 12.5, lineHeight: 1.5, color: T.inkFaint, marginTop: 8 }}>{secondary}</div>
    </div>
  );
}

/* ========= RECIPE: IncommensurableMagnitudes (the two-tier field) ========= */
/* Honest broken axis. Labelled "axis compressed at the gap" — NEVER "to scale". */
function IncommensurableMagnitudes({ data, onProv }) {
  const { upper, lower, ratioLabel, ratioNote } = data;
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontFamily: T.mono, fontSize: 10.5, letterSpacing: ".1em", color: T.inkSoft, textTransform: "uppercase" }}>
          The two-tier field
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.gap }}>£ · axis compressed at the gap — not to scale</div>
      </div>

      <div style={{ display: "flex", gap: 22, alignItems: "stretch" }}>
        {/* LEFT — the two stacked magnitudes */}
        <div style={{ flex: "0 0 230px", display: "flex", flexDirection: "column" }}>
          {/* upper (web, dashed) */}
          <button onClick={() => onProv?.("mag-upper")} style={{
            textAlign: "left", cursor: "pointer", background: "#EDF1F6", borderRadius: "9px 9px 0 0",
            border: `1.5px dashed ${T.web}`, borderBottom: "none", padding: "20px 16px 16px", position: "relative" }}>
            <div style={{ fontFamily: T.serif, fontWeight: 500, fontSize: 30, color: "#3E5566", lineHeight: 1 }}>{upper.display}</div>
            <div style={{ fontFamily: T.mono, fontSize: 9.5, color: "#7E93A4", marginTop: 6 }}>national programme · web</div>
            <div style={{ position: "absolute", top: 8, right: 10, fontFamily: T.mono, fontSize: 9, color: T.web }}>⌖</div>
          </button>

          {/* the break */}
          <div style={{ height: 30, position: "relative", background: T.canvas,
            borderLeft: `1.5px dashed ${T.web}`, borderRight: `1.5px solid ${T.corpus}` }}>
            <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center",
              fontFamily: T.mono, fontSize: 13, color: T.gap }}>⇡⇣</div>
            {/* torn zig-zag marking the discontinuity */}
            <svg width="100%" height="10" style={{ position: "absolute", top: -5, left: 0 }} preserveAspectRatio="none" viewBox="0 0 230 10">
              <polyline points="0,5 16,2 32,8 48,2 64,8 80,2 96,8 112,2 128,8 144,2 160,8 176,2 192,8 208,2 224,8 230,5"
                fill="none" stroke={T.gap} strokeWidth="1.2" opacity=".55" />
            </svg>
          </div>

          {/* lower (corpus, solid) */}
          <button onClick={() => onProv?.("stat-corpus")} style={{
            textAlign: "left", cursor: "pointer", background: T.corpusWash, borderRadius: "0 0 9px 9px",
            border: `1.5px solid ${T.corpus}`, borderTop: "none", padding: "16px 16px 20px", position: "relative" }}>
            <div style={{ fontFamily: T.serif, fontWeight: 500, fontSize: 30, color: "#2F5C3E", lineHeight: 1 }}>{lower.display}</div>
            <div style={{ fontFamily: T.mono, fontSize: 9.5, color: "#5C9070", marginTop: 6 }}>corpus · owned</div>
            <div style={{ position: "absolute", bottom: 8, right: 10, fontFamily: T.mono, fontSize: 9, color: T.corpus }}>⌖</div>
          </button>
        </div>

        {/* RIGHT — the reading */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 14 }}>
          <div>
            <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: "#3E5566", marginBottom: 4 }}>{upper.label}</div>
            <div style={{ fontFamily: T.sans, fontSize: 13, lineHeight: 1.5, color: T.inkSoft }}>
              What the corpus is structurally blind to — the multi-billion infrastructure tier above the innovation layer.
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: "#7E93A4", marginTop: 5 }}>{upper.note}</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, padding: "8px 0",
            borderTop: `1px solid ${T.ruleSoft}`, borderBottom: `1px solid ${T.ruleSoft}` }}>
            <div style={{ fontFamily: T.serif, fontWeight: 500, fontSize: 24, color: T.gap }}>{ratioLabel}</div>
            <div style={{ fontFamily: T.sans, fontSize: 12.5, color: T.inkSoft, fontStyle: "italic" }}>{ratioNote}</div>
          </div>
          <div>
            <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: "#2F5C3E", marginBottom: 4 }}>{lower.label}</div>
            <div style={{ fontFamily: T.sans, fontSize: 13, lineHeight: 1.5, color: T.inkSoft }}>
              Everything the corpus can see: 55 projects, £8.17m, almost all Innovate UK. A floor, not a total.
            </div>
            <div style={{ fontFamily: T.mono, fontSize: 10, color: "#5C9070", marginTop: 5 }}>{lower.note}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====================== SPINE: ProvenanceTrace (peel) ==================== */
function ProvenanceTrace({ id, data, onClose }) {
  if (!id) return null;
  const p = data[id];
  if (!p) return null;
  const isCorpus = p.trust === "corpus";
  const c = isCorpus ? T.corpus : T.web;
  return (
    <div style={{ position: "absolute", top: 14, right: 14, width: 270, background: "#fff",
      borderRadius: 10, boxShadow: "0 10px 34px rgba(40,34,26,.18)", border: `1px solid ${T.ruleSoft}`,
      padding: 16, zIndex: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: ".1em", color: T.inkSoft, textTransform: "uppercase" }}>
          ⌖ Provenance
        </div>
        <button onClick={onClose} style={{ border: "none", background: "none", cursor: "pointer",
          fontFamily: T.mono, fontSize: 13, color: T.inkFaint }}>×</button>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 12, color: T.ink, fontWeight: 500 }}>{p.ref}</div>
      <div style={{ fontFamily: T.mono, fontSize: 11, color: T.inkFaint, marginTop: 2 }}>{p.scope}</div>
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.ruleSoft}` }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
          <span style={{ width: 10, height: 10, borderRadius: 2,
            background: isCorpus ? c : "transparent",
            border: isCorpus ? "none" : `1.5px dashed ${c}` }} />
          <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: ".08em", color: c, textTransform: "uppercase" }}>
            Trust · {p.trust}
          </span>
        </div>
        <div style={{ fontFamily: T.sans, fontSize: 12, lineHeight: 1.5, color: T.inkSoft }}>{p.trustNote}</div>
      </div>
      <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, marginTop: 10 }}>{p.row} ↗</div>
    </div>
  );
}

/* ============================== SPINE: SoWhatRail ======================== */
function SoWhatRail({ sw }) {
  const Row = ({ k, children }) => (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: ".12em", color: T.inkFaint,
        textTransform: "uppercase", marginBottom: 6 }}>{k}</div>
      <div style={{ fontFamily: T.sans, fontSize: 13, lineHeight: 1.55, color: T.inkSoft }}>{children}</div>
    </div>
  );
  return (
    <aside style={{ width: 320, flex: "0 0 320px", borderLeft: `1px solid ${T.rule}`, paddingLeft: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <div style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: ".12em", color: T.inkSoft, textTransform: "uppercase" }}>
          Atlas · so-what
        </div>
        <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint }}>{sw.turn}</div>
      </div>
      <Row k="What you’re looking at">{sw.lookingAt}</Row>
      <Row k="The one decision">{sw.oneDecision}</Row>
      <div style={{ background: T.gapWash, borderRadius: 8, padding: "12px 14px", marginBottom: 18,
        border: `1px solid ${T.gap}22` }}>
        <div style={{ fontFamily: T.mono, fontSize: 9.5, letterSpacing: ".12em", color: T.gap,
          textTransform: "uppercase", marginBottom: 6 }}>Gate</div>
        <div style={{ fontFamily: T.sans, fontSize: 12.5, lineHeight: 1.5, color: T.inkSoft }}>{sw.gate}</div>
      </div>
      <button style={{ width: "100%", fontFamily: T.sans, fontSize: 13, fontWeight: 600, color: T.canvas,
        background: T.ink, border: "none", borderRadius: 8, padding: "12px 14px", cursor: "pointer", textAlign: "left" }}>
        {sw.primaryAction} →
      </button>
      <input placeholder="Ask a follow-up…" style={{ width: "100%", marginTop: 12, fontFamily: T.sans,
        fontSize: 13, color: T.ink, background: "#fff", border: `1px solid ${T.ruleSoft}`,
        borderRadius: 8, padding: "11px 13px", boxSizing: "border-box" }} />
    </aside>
  );
}

/* ================================ SHELL ================================== */
export default function AtlasSurface() {
  const [prov, setProv] = useState(null);

  // load the fonts (the locked three)
  useEffect(() => {
    const id = "atlas-fonts";
    if (document.getElementById(id)) return;
    const l = document.createElement("link");
    l.id = id; l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400;0,6..72,500;0,6..72,600&family=Libre+Franklin:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap";
    document.head.appendChild(l);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: T.page, padding: 40, fontFamily: T.sans }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", gap: 28, alignItems: "flex-start" }}>
        {/* CANVAS */}
        <main style={{ flex: 1, minWidth: 0 }}>
          <ScopeBar object={DATA.object} scope={DATA.scope} mode={DATA.mode} tier={DATA.tier} />
          <div style={{ position: "relative" }}>
            <ProvenanceTrace id={prov} data={DATA.provenance} onClose={() => setProv(null)} />
            <CeilingFrame tier={DATA.tier}>
              <VerdictHero sentence={DATA.verdict} tail={DATA.verdictTail} />
              <StatStrip stats={DATA.stats} onProv={setProv} />
              <AnswerabilityCard {...DATA.blindspot} />
              <IncommensurableMagnitudes data={DATA.magnitudes} onProv={setProv} />
            </CeilingFrame>
          </div>
          <div style={{ fontFamily: T.mono, fontSize: 10, color: T.inkFaint, marginTop: 14, display: "flex", gap: 18 }}>
            <span>● corpus — solid, owned</span>
            <span style={{ color: T.web }}>┄ web — dashed, borrowed</span>
            <span style={{ color: T.gap }}>⌁ gap — torn, under-count</span>
          </div>
        </main>

        {/* CHAT RAIL */}
        <SoWhatRail sw={DATA.soWhat} />
      </div>
    </div>
  );
}
