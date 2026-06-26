"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { ATLAS_SHOWCASE_SCENES, J1T1_QUERY } from "@/lib/atlas/entry-queries";
import { markPendingBootstrap, writeAtlasSessionQuery } from "@/lib/atlas/session";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";

export function AtlasShowcasePage() {
  const router = useRouter();
  const [active, setActive] = useState(0);
  const scene = ATLAS_SHOWCASE_SCENES[active];

  return (
    <div
      className="min-h-screen px-6 py-10"
      style={{ background: T.page, fontFamily: atlasFont.sans }}
    >
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-4">
          <div>
            <p
              className="mb-1 uppercase tracking-[0.12em]"
              style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}
            >
              Atlas showcase
            </p>
            <h1 className="text-2xl font-semibold" style={{ color: T.ink }}>
              Live surface morph demo
            </h1>
          </div>
          <Link
            href="/atlas"
            className="text-xs underline"
            style={{ fontFamily: atlasFont.mono, color: T.corpus }}
          >
            ← Entry
          </Link>
        </div>

        <div
          className="mb-6 rounded-lg border p-6"
          style={{ background: T.canvas, borderColor: T.rule }}
        >
          <div className="mb-2 flex items-center gap-2">
            <span
              className="rounded px-2 py-0.5 text-[10px] uppercase"
              style={{ background: T.corpusWash, color: T.corpus, fontFamily: atlasFont.mono }}
            >
              {scene.mode}
            </span>
            <span style={{ fontFamily: atlasFont.mono, fontSize: 10, color: T.inkFaint }}>
              {scene.hint}
            </span>
          </div>
          <p className="mb-4 text-lg" style={{ color: T.ink }}>
            “{scene.query}”
          </p>
          <button
            type="button"
            onClick={() => {
              writeAtlasSessionQuery(scene.query);
              markPendingBootstrap(scene.query);
              router.push(`/atlas?q=${encodeURIComponent(scene.query)}`);
            }}
            className="rounded-full px-5 py-2 text-sm font-medium text-white"
            style={{ background: T.corpus }}
          >
            Run live →
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {ATLAS_SHOWCASE_SCENES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActive(i)}
              className="rounded-full border px-3 py-1.5 text-xs"
              style={{
                borderColor: i === active ? T.corpus : T.rule,
                background: i === active ? T.corpusWash : "white",
                color: T.ink,
                fontFamily: atlasFont.mono,
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div
          className="mt-10 rounded-lg border p-4 text-sm"
          style={{ borderColor: T.rule, background: "#FBFAF7", color: "#46423C" }}
        >
          <p className="mb-2 font-medium" style={{ color: T.ink }}>
            In chat, try:
          </p>
          <ul className="mb-3 list-disc space-y-1 pl-5 text-xs" style={{ color: T.inkSoft }}>
            <li>
              <strong>Show me what you can do</strong> — menu with rail · aviation · flex chips
            </li>
            <li>
              <strong>demo rail</strong> / <strong>demo aviation</strong> / <strong>demo flex</strong>
            </li>
            <li>
              <strong>next</strong> — advance a running 4-turn journey
            </li>
          </ul>
          <p className="mb-2 font-medium" style={{ color: T.ink }}>
            Default orient canvas:
          </p>
          <code
            className="block rounded px-3 py-2 text-xs"
            style={{ background: "#F0EDE7", fontFamily: atlasFont.mono }}
          >
            {J1T1_QUERY}
          </code>
          <p className="mt-2 text-xs" style={{ color: T.inkFaint }}>
            Or open{" "}
            <Link href={`/atlas?q=${encodeURIComponent(J1T1_QUERY)}`} className="underline">
              /atlas?q=…
            </Link>{" "}
            — server bootstraps the J1T1 live spec from corpus when no client query is set.
          </p>
        </div>
      </div>
    </div>
  );
}
