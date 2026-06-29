"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";

import type { AnswerSpec } from "@/lib/atlas/contracts/answer-spec.schema";
import { AtlasChatMarkdown } from "@/components/atlas/shell/atlas-chat-markdown";
import { ShowcaseChips, type ShowcaseOption } from "@/components/atlas/shell/showcase-chips";
import { atlasFont, atlasTokens as T } from "@/lib/atlas/tokens";
import { cn } from "@/lib/utils";

type SoWhat = AnswerSpec["soWhat"];

export type ChatMessage = { role: "user" | "assistant"; content: string };

export function SoWhatRail({
  soWhat,
  initialQuery,
  onFollowUp,
  chatMessages: externalMessages,
  chatPending: externalPending,
  inputPlaceholder = "Ask a follow-up…",
  onDraftChange,
  showcaseOptions,
  onShowcaseSelect,
  progressLine,
  splitEmbedded = false,
  /** One-line verdict from AnswerSpec — prepended on substantive assistant turns. */
  verdictLead,
}: {
  soWhat: SoWhat;
  initialQuery?: string;
  onFollowUp?: (message: string) => Promise<string | void> | string | void;
  chatMessages?: ChatMessage[];
  chatPending?: boolean;
  inputPlaceholder?: string;
  onDraftChange?: (text: string) => void;
  showcaseOptions?: ShowcaseOption[];
  onShowcaseSelect?: (command: string) => void;
  /** Live CoT / graph stage line while canvas is building. */
  progressLine?: string | null;
  /** Fill parent when rendered inside SurfaceSplitPanels. */
  splitEmbedded?: boolean;
  verdictLead?: string | null;
}) {
  const [draft, setDraft] = useState("");
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>(() =>
    initialQuery ? [{ role: "user", content: initialQuery }] : [],
  );
  const [localPending, setLocalPending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const copilotMode = externalMessages !== undefined;
  const messages = copilotMode ? externalMessages : localMessages;
  const pending =
    externalPending !== undefined ? Boolean(externalPending) : localPending;

  const lastAssistantIdx = messages.reduce(
    (acc, m, i) => (m.role === "assistant" ? i : acc),
    -1,
  );
  const lead = verdictLead?.trim() || null;

  useEffect(() => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length, pending, messages[messages.length - 1]?.content]);

  const submit = useCallback(async () => {
    const text = draft.trim();
    if (!text || pending) return;
    setDraft("");
    if (!copilotMode) {
      setLocalMessages((m) => [...m, { role: "user", content: text }]);
    }
    setLocalPending(true);
    try {
      const reply = await onFollowUp?.(text);
      if (!copilotMode && reply) {
        setLocalMessages((m) => [...m, { role: "assistant", content: reply }]);
      }
    } finally {
      setLocalPending(false);
    }
  }, [copilotMode, draft, onFollowUp, pending]);

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const onFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void submit();
  };

  const handleShowcase = (command: string) => {
    if (onShowcaseSelect) {
      onShowcaseSelect(command);
      return;
    }
    void onFollowUp?.(command);
  };

  return (
    <aside
      data-testid="so-what-rail"
      className={cn(
        "flex flex-col self-stretch bg-white",
        splitEmbedded
          ? "h-full min-h-0 w-full"
          : "order-1 w-full shrink-0 border-b lg:order-2 lg:w-[396px] lg:flex-[0_0_396px] lg:border-b-0 lg:border-l",
      )}
      style={{ borderColor: "#E7E3DC", minHeight: 0 }}
    >
      <div
        className="flex shrink-0 items-center gap-2 border-b px-5"
        style={{ height: 54, borderColor: "#EFEBE4" }}
      >
        <span className="inline-block rounded-full" style={{ width: 7, height: 7, background: T.corpus }} />
        <span style={{ fontSize: 12.5, fontWeight: 600, color: T.ink }}>Atlas</span>
        <span style={{ fontFamily: atlasFont.mono, fontSize: 10, color: "#A39E96" }}>· chat</span>
        <div className="flex-1" />
        <span style={{ fontFamily: atlasFont.mono, fontSize: 9, color: T.inkFaint }}>{soWhat.turn}</span>
      </div>

      <div
        ref={scrollRef}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4"
      >
        <div
          className="shrink-0 rounded-lg border px-3 py-2.5"
          style={{ borderColor: "#EAE4D8", background: "#FBF9F4" }}
        >
          <div
            className="mb-1 uppercase"
            style={{ fontFamily: atlasFont.mono, fontSize: 9, letterSpacing: "0.1em", color: "#A39E96" }}
          >
            Canvas context
          </div>
          <p className="m-0 text-[12.5px] leading-snug" style={{ color: "#2E2A24" }}>
            {soWhat.lookingAt}
          </p>
        </div>

        {showcaseOptions?.length ? (
          <ShowcaseChips
            options={showcaseOptions}
            onSelect={handleShowcase}
            title="Showcase"
          />
        ) : null}

        <div className="mt-auto flex flex-col gap-3">
          {messages.map((msg, i) =>
            msg.role === "user" ? (
              <div
                key={`${msg.role}-${i}-${msg.content.slice(0, 24)}`}
                className="max-w-[262px] self-end rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed"
                style={{
                  background: "#F0EDE7",
                  borderRadius: "12px 12px 4px 12px",
                  color: "#46423C",
                }}
              >
                {msg.content}
              </div>
            ) : (
              <div
                key={`${msg.role}-${i}-${msg.content.slice(0, 24)}`}
                className="max-w-[316px] self-start text-[13px] leading-relaxed"
                style={{ color: "#46423C" }}
              >
                {lead && i === lastAssistantIdx ? (
                  <p
                    className="mb-2 rounded-md border px-2.5 py-2 text-[12.5px] font-medium leading-snug"
                    data-testid="rail-verdict-lead"
                    style={{
                      borderColor: "#D4E8DA",
                      background: "#F3FAF5",
                      color: "#1A1714",
                    }}
                  >
                    {lead}
                  </p>
                ) : null}
                <AtlasChatMarkdown content={msg.content} />
              </div>
            ),
          )}
          {pending ? (
            <div className="self-start space-y-1">
              <div className="text-[13px] italic" style={{ color: T.inkFaint }}>
                {copilotMode ? "Atlas is thinking…" : "Opening session…"}
              </div>
              {progressLine ? (
                <div
                  className="max-w-[316px] text-[12px] leading-snug"
                  style={{ color: T.inkSoft, fontFamily: atlasFont.sans }}
                >
                  {progressLine}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <form
        onSubmit={onFormSubmit}
        className="shrink-0 border-t px-4 py-3.5"
        style={{ borderColor: "#EFEBE4" }}
      >
        <div
          className="flex items-end gap-2 rounded-lg border px-3 py-2.5"
          style={{ borderColor: "#E0DCD3" }}
        >
          <textarea
            data-testid="atlas-follow-up-input"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              onDraftChange?.(e.target.value);
            }}
            onKeyDown={onKeyDown}
            placeholder={inputPlaceholder}
            aria-label="Ask a follow-up"
            rows={1}
            disabled={pending}
            className="min-h-[22px] flex-1 resize-none border-none bg-transparent outline-none"
            style={{
              fontFamily: atlasFont.sans,
              fontSize: 12.5,
              color: T.ink,
            }}
          />
          <button
            type="submit"
            disabled={pending || !draft.trim()}
            className="shrink-0 border-none bg-transparent p-0"
            style={{
              fontFamily: atlasFont.mono,
              fontSize: 10,
              color: draft.trim() ? T.corpus : "#C4BFB6",
              cursor: draft.trim() ? "pointer" : "default",
            }}
            aria-label="Send follow-up"
          >
            ⏎
          </button>
        </div>
      </form>
    </aside>
  );
}
