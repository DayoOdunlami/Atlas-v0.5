"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { CorpusFieldCanvas } from "@/components/atlas/entry/corpus-field-canvas";
import { entryFranklin, entryNewsreader } from "@/components/atlas/entry/entry-fonts";
import { SoWhatRail } from "@/components/atlas/shell/so-what-rail";
import { startNewAtlasV5Thread } from "@/components/copilotkit-provider";
import {
  ENTRY_PLACEHOLDERS,
  ENTRY_SO_WHAT,
  ENTRY_STARTERS,
} from "@/lib/atlas/entry-screen-copy";
import { atlasFont } from "@/lib/atlas/tokens";

const COMPOSE_MS = 1200;

export function AtlasEntryScreen() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [primerOpen, setPrimerOpen] = useState(true);
  const [highlight, setHighlight] = useState<string | null>(null);
  const [phIdx, setPhIdx] = useState(0);
  const navigateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = query.trim().length > 0 || submitted;
  const askPlaceholder = ENTRY_PLACEHOLDERS[phIdx % ENTRY_PLACEHOLDERS.length];

  useEffect(() => {
    const id = setInterval(() => setPhIdx((i) => i + 1), 2900);
    return () => clearInterval(id);
  }, []);

  const go = useCallback(
    (text: string) => {
      const q = text.trim();
      if (!q) return;
      setQuery(q);
      setSubmitted(true);
      startNewAtlasV5Thread();
      if (navigateTimer.current) clearTimeout(navigateTimer.current);
      navigateTimer.current = setTimeout(() => {
        router.push(`/atlas/session?q=${encodeURIComponent(q)}`);
      }, COMPOSE_MS);
    },
    [router],
  );

  useEffect(
    () => () => {
      if (navigateTimer.current) clearTimeout(navigateTimer.current);
    },
    [],
  );

  const handleAsk = useCallback(
    async (message: string) => {
      go(message);
      return "Composing your canvas from live corpus…";
    },
    [go],
  );

  return (
    <div
      className={`${entryNewsreader.variable} ${entryFranklin.variable} flex min-h-screen flex-col`}
      style={{ background: "#e7e5df", fontFamily: "var(--font-entry-sans), sans-serif" }}
    >
      <div className="flex min-h-0 flex-1 items-stretch overflow-hidden">
        {/* Canvas at rest — visual starting point from HTML prototype */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto p-6 lg:p-10">
          <div
            className="mx-auto flex w-full max-w-[1200px] flex-1 flex-col overflow-hidden rounded-sm bg-[#FBFAF7] shadow-lg"
            style={{
              minHeight: 520,
              boxShadow: "0 1px 3px rgba(0,0,0,.08), 0 16px 50px rgba(0,0,0,.07)",
            }}
          >
            {/* topbar */}
            <div
              className="flex h-[54px] shrink-0 items-center gap-4 border-b px-6"
              style={{ borderColor: "#E7E3DC" }}
            >
              <div className="text-[15px] font-semibold text-[#211E1A]">Atlas</div>
              <div className="h-[18px] w-px bg-[#E7E3DC]" />
              <div
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
              <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1" style={{ background: "#F0EDE7" }}>
                <div className="atlas-pulse-dot h-[7px] w-[7px] rounded-full bg-[#8FA98C]" />
                <span style={{ fontFamily: atlasFont.mono, fontSize: 11, fontWeight: 600, color: "#56524C" }}>
                  READY
                </span>
              </div>
            </div>

            {primerOpen ? (
              <div
                className="flex shrink-0 flex-wrap items-center gap-3 border-b px-6 py-2 text-[11px] text-[#46423C]"
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

            <div className="relative min-h-[420px] flex-1 overflow-hidden">
              <CorpusFieldCanvas active={active} highlight={highlight} />
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(90deg,#FBFAF7 0%,#FBFAF7 28%,rgba(251,250,247,0.75) 45%,rgba(251,250,247,0) 72%)",
                }}
              />

              <div className="relative z-[3] flex h-full flex-col justify-center px-8 py-10 lg:px-14">
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
                      Atlas · ready
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
                      Use the <strong>ask bar on the right</strong> to type your question — or pick a
                      starter below. The field lights up as you type.
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
                      composing the canvas
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
                  </div>
                )}
              </div>
            </div>
          </div>
        </main>

        {/* Always-visible ask / chat rail — primary way to submit a question */}
        <SoWhatRail
          soWhat={ENTRY_SO_WHAT}
          onFollowUp={handleAsk}
          inputPlaceholder={askPlaceholder}
          onDraftChange={(text) => {
            setQuery(text);
            setSubmitted(false);
          }}
        />
      </div>
    </div>
  );
}
