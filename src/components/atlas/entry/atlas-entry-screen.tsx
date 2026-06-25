"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { CorpusFieldCanvas } from "@/components/atlas/entry/corpus-field-canvas";
import { entryFranklin, entryNewsreader } from "@/components/atlas/entry/entry-fonts";
import { ConnectionStatus } from "@/components/atlas/shell/connection-status";
import { SoWhatRail } from "@/components/atlas/shell/so-what-rail";
import {
  ENTRY_PLACEHOLDERS,
  ENTRY_SO_WHAT,
  ENTRY_STARTERS,
} from "@/lib/atlas/entry-screen-copy";
import { markPendingBootstrap, writeAtlasSessionQuery } from "@/lib/atlas/session";
import { atlasFont } from "@/lib/atlas/tokens";

type HealthPayload = {
  ok?: boolean;
  agents?: { ok?: boolean; url?: string };
  anthropic_configured?: boolean;
  error?: string;
};

function EntryHealthBanner({ health }: { health: HealthPayload | null }) {
  if (!health || health.ok) return null;
  const agentsDown = health.agents?.ok === false;
  return (
    <div
      className="shrink-0 border-b px-6 py-2 text-[12px]"
      style={{
        borderColor: "#E8D4C4",
        background: "#FDF6F0",
        color: "#7C4A2E",
      }}
    >
      {agentsDown ? (
        <>
          Agent service not reachable
          {health.agents?.url ? ` (${health.agents.url})` : ""}. Start with{" "}
          <code className="text-[11px]">npm run dev</code> or{" "}
          <code className="text-[11px]">npm run dev:agents</code> — then retry your question.
        </>
      ) : (
        <>Atlas health check failed{health.error ? `: ${health.error}` : ""}.</>
      )}
      {!health.anthropic_configured ? (
        <span className="ml-2 opacity-80">ANTHROPIC_API_KEY not set — replies may skeleton.</span>
      ) : null}
    </div>
  );
}

export function AtlasEntryScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [primerOpen, setPrimerOpen] = useState(true);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [phIdx, setPhIdx] = useState(0);
  const [health, setHealth] = useState<HealthPayload | null>(null);

  const active = query.trim().length > 0 || submitted;
  const askPlaceholder = ENTRY_PLACEHOLDERS[phIdx % ENTRY_PLACEHOLDERS.length];

  useEffect(() => {
    const id = setInterval(() => setPhIdx((i) => i + 1), 2900);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/atlas/health", { cache: "no-store" });
        if (!cancelled) setHealth((await res.json()) as HealthPayload);
      } catch {
        if (!cancelled) setHealth({ ok: false, agents: { ok: false } });
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const go = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q || navigating) return;
      setQuery(q);
      setSubmitted(true);
      setNavigating(true);
      writeAtlasSessionQuery(q);
      markPendingBootstrap(q);
      router.push(`/atlas/session?q=${encodeURIComponent(q)}`);
    },
    [navigating, router],
  );

  const handleAsk = useCallback(
    async (message: string) => {
      go(message);
      return "Opening session — Atlas will start thinking on the next screen…";
    },
    [go],
  );

  const entrySoWhat = submitted
    ? {
        ...ENTRY_SO_WHAT,
        lookingAt: `Starting session — “${query.slice(0, 72)}${query.length > 72 ? "…" : ""}”`,
        primaryAction: navigating ? "Opening session…" : "Compose",
      }
    : ENTRY_SO_WHAT;

  return (
    <div
      className={`${entryNewsreader.variable} ${entryFranklin.variable} flex min-h-screen flex-col`}
      style={{ background: "#e7e5df", fontFamily: "var(--font-entry-sans), sans-serif" }}
    >
      <EntryHealthBanner health={health} />
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:items-stretch">
        {/* Canvas at rest — visual starting point from HTML prototype */}
        <main className="order-2 flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-4 lg:order-1 lg:p-10">
          <div
            className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col overflow-hidden rounded-sm bg-[#FBFAF7] shadow-lg"
            style={{
              minHeight: 420,
              boxShadow: "0 1px 3px rgba(0,0,0,.08), 0 16px 50px rgba(0,0,0,.07)",
            }}
          >
            {/* topbar */}
            <div
              className="flex h-[54px] shrink-0 items-center gap-4 border-b px-4 lg:px-6"
              style={{ borderColor: "#E7E3DC" }}
            >
              <div className="text-[15px] font-semibold text-[#211E1A]">Atlas</div>
              <div className="hidden h-[18px] w-px bg-[#E7E3DC] sm:block" />
              <div
                className="hidden sm:block"
                style={{
                  fontFamily: atlasFont.mono,
                  fontSize: 10.5,
                  letterSpacing: "0.06em",
                  color: "#8C887F",
                }}
              >
                CORPUS + LIVE WEB · CANVAS AT REST
              </div>
              <div className="flex-1" />
              {!primerOpen ? (
                <button
                  type="button"
                  onClick={() => setPrimerOpen(true)}
                  className="cursor-pointer border-none bg-transparent"
                  style={{ fontFamily: atlasFont.mono, fontSize: 9.5, color: "#A39E96" }}
                >
                  ▦ materials
                </button>
              ) : null}
              <ConnectionStatus className="relative" />
            </div>

            {primerOpen ? (
              <div
                className="flex shrink-0 flex-wrap items-center gap-3 border-b px-4 py-2 text-[11px] text-[#46423C] lg:px-6"
                style={{ background: "#F8F6F1", borderColor: "#EAE5DC" }}
              >
                <span style={{ fontFamily: atlasFont.mono, fontSize: 9, letterSpacing: "0.12em", color: "#56524C" }}>
                  MATERIALS →
                </span>
                <span><strong className="text-[#2F5C3E]">solid green</strong> · owned</span>
                <span><strong className="text-[#3E6B8C]">dashed blue</strong> · borrowed</span>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={() => setPrimerOpen(false)}
                  className="cursor-pointer rounded border border-[#E0DBD1] bg-transparent px-2 py-0.5"
                  style={{ fontFamily: atlasFont.mono, fontSize: 10, color: "#94908A" }}
                >
                  got it ✕
                </button>
              </div>
            ) : null}

            <div className="relative min-h-[320px] flex-1 overflow-hidden lg:min-h-[420px]">
              <CorpusFieldCanvas active={active} highlight={highlight} />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg,#FBFAF7 0%,#FBFAF7 28%,rgba(251,250,247,0.75) 45%,rgba(251,250,247,0) 72%)",
                }}
              />

              <div className="relative z-[3] flex h-full flex-col justify-center px-6 py-8 lg:px-14 lg:py-10">
                {!submitted ? (
                  <div className="max-w-[560px]">
                    <p
                      style={{
                        fontFamily: atlasFont.mono,
                        fontSize: 10.5,
                        letterSpacing: "0.2em",
                        color: "#A39E96",
                        textTransform: "uppercase",
                        marginBottom: 16,
                      }}
                    >
                      Ask in the chat rail →
                    </p>
                    <h1
                      style={{
                        fontFamily: "var(--font-entry-serif), Georgia, serif",
                        fontWeight: 500,
                        fontSize: "clamp(2rem, 4vw, 3.25rem)",
                        lineHeight: 1.05,
                        letterSpacing: "-0.025em",
                        color: "#16130F",
                        margin: "0 0 28px",
                      }}
                    >
                      What do you want to{" "}
                      <span style={{ fontStyle: "italic" }}>understand</span>?
                    </h1>
                    <p className="mb-6 text-sm leading-relaxed text-[#56524C]">
                      Type in the <strong>ask bar</strong> (right on desktop, above on mobile) and press{" "}
                      <strong>Enter</strong> — you&apos;ll move to the session screen where Atlas thinks.
                      The status pill shows whether the agent service is connected.
                    </p>
                    <div>
                      <div
                        style={{
                          fontFamily: atlasFont.mono,
                          fontSize: 9,
                          letterSpacing: "0.14em",
                          color: "#C0BAB0",
                          textTransform: "uppercase",
                          marginBottom: 8,
                        }}
                      >
                        or start from the corpus
                      </div>
                      {ENTRY_STARTERS.map((s) => (
                        <button
                          key={s.query}
                          type="button"
                          className="atlas-starter flex w-full cursor-pointer items-center gap-3 border-t border-[#ECE7DE] bg-transparent py-2.5 text-left"
                          onClick={() => go(s.query)}
                          onMouseEnter={() => setHighlight(s.highlight)}
                          onMouseLeave={() => setHighlight(null)}
                        >
                          <span style={{ fontFamily: atlasFont.mono, fontSize: 11, color: "#8FA98C" }}>→</span>
                          <span className="text-sm text-[#46423C]">{s.query}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        className="mt-3 cursor-pointer border-none bg-transparent text-left text-sm underline"
                        style={{ color: "#3F7A52", fontFamily: atlasFont.mono, fontSize: 11 }}
                        onClick={() => router.push("/atlas/showcase")}
                      >
                        Open showcase picker →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[560px]">
                    <div
                      className="mb-4 flex items-center gap-2 uppercase"
                      style={{
                        fontFamily: atlasFont.mono,
                        fontSize: 10.5,
                        letterSpacing: "0.18em",
                        color: "#5C9070",
                      }}
                    >
                      <span className="atlas-pulse-dot-fast h-1.5 w-1.5 rounded-full bg-[#3F7A52]" />
                      opening session
                    </div>
                    <h2
                      style={{
                        fontFamily: "var(--font-entry-serif), Georgia, serif",
                        fontWeight: 500,
                        fontSize: 28,
                        fontStyle: "italic",
                        color: "#16130F",
                        margin: 0,
                      }}
                    >
                      “{query}”
                    </h2>
                    <p className="mt-4 text-sm text-[#56524C]">
                      Handing off to Atlas — watch for &ldquo;Atlas is thinking…&rdquo; in the chat rail.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Ask / chat rail — primary submit path; first on mobile */}
        <SoWhatRail
          soWhat={entrySoWhat}
          onFollowUp={handleAsk}
          chatPending={submitted}
          inputPlaceholder={submitted ? "Opening session…" : askPlaceholder}
          onDraftChange={(text) => {
            setQuery(text);
            if (submitted) return;
          }}
        />
      </div>
    </div>
  );
}
