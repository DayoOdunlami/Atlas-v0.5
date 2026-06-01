/**
 * Atlas 5 — Chat Pane (D6)
 *
 * Left pane — receives user messages and streams agent responses via
 * /api/copilotkit (AI SDK v5 + Anthropic claude-sonnet-4-6).
 *
 * data-testid="chat-pane" is the stable selector used by Playwright and
 * the Tier 1 eval harness.
 *
 * AG-UI wiring (D6):
 *  - useAtlas5Chat() wraps useChat with surface gateway integration
 *  - Messages stream word-by-word (smoothStream transform in the route)
 *  - Sending a message POSTs to /api/copilotkit with active_agent in body
 *  - Thread id is set in surface_state.json after the first response
 */
"use client";

import { type TextUIPart } from "ai";
import { type FormEvent, useEffect, useRef, useState } from "react";

import { useAtlas5Chat } from "@/hooks/use-atlas5-chat";
import { useSurfaceGateway } from "@/lib/atlas5/surface-gateway";

// ---------------------------------------------------------------------------
// Cold session entry chips (Principle 5 — surfaces are workspaces)
// Visible when thread_id is null and no messages. Fades out on first message.
// ---------------------------------------------------------------------------

const COLD_CHIPS = [
  {
    label: "Explore the innovation landscape",
    prompt: "Explore the innovation landscape for connected and autonomous transport in the UK.",
  },
  {
    label: "Assess a capability or product",
    prompt: "Assess CPC's capability evidence for leading an autonomous freight R&D programme.",
  },
  {
    label: "Build an investment case",
    prompt: "Build a Green Book investment case for a UK autonomous freight corridor pilot programme.",
  },
];

function ColdSessionEntry({ onSelect }: { onSelect: (prompt: string) => void }) {
  return (
    <div
      data-testid="cold-session-entry"
      className="flex flex-col items-center justify-center gap-5 h-full px-6 py-12 animate-in fade-in duration-300"
    >
      <div className="text-center space-y-1.5 max-w-xs">
        <p className="text-sm font-semibold text-foreground">
          What are you trying to understand or decide?
        </p>
        <p className="text-xs text-muted-foreground">
          Choose a starting point or type your own question below.
        </p>
      </div>
      <div className="flex flex-col gap-2 w-full max-w-xs">
        {COLD_CHIPS.map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={() => onSelect(chip.prompt)}
            data-testid={`cold-chip-${chip.label.toLowerCase().replace(/\s+/g, "-")}`}
            className="rounded-lg border border-border bg-muted/40 px-4 py-2.5 text-xs text-left font-medium text-foreground hover:bg-muted/80 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors"
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ChatPane() {
  const { surface } = useSurfaceGateway();
  const { messages, sendMessage, status } = useAtlas5Chat();
  // AI SDK v5 removed input/setInput from useChat — manage locally
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Cold session: show entry chips when thread_id is null and no messages
  const isColdSession = !surface.thread_id && messages.length === 0;

  // Auto-scroll to the bottom when a new message arrives
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const isStreaming = status === "streaming";

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isStreaming) return;
    sendMessage({ role: "user", parts: [{ type: "text", text: trimmed }] });
    setInput("");
  };

  const handleChipSelect = (prompt: string) => {
    // Populate input — do NOT auto-submit (per spec)
    setInput(prompt);
  };

  return (
    <section
      data-testid="chat-pane"
      aria-label="Chat"
      className="flex flex-col h-full bg-background border-r border-border"
    >
      {/* ----------------------------------------------------------------
          Header
      ---------------------------------------------------------------- */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <span className="text-sm font-medium text-foreground">Chat</span>
        <span
          data-testid="active-agent-label"
          className="text-xs text-muted-foreground"
        >
          {surface.active_agent}
        </span>
      </div>

      {/* ----------------------------------------------------------------
          Message list
      ---------------------------------------------------------------- */}
      <div
        data-testid="message-list"
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {isColdSession && (
          <ColdSessionEntry onSelect={handleChipSelect} />
        )}

        {messages.map((message) => {
          const textParts = message.parts.filter(
            (p): p is TextUIPart => p.type === "text",
          );
          const text = textParts.map((p) => p.text).join("");

          return (
            <div
              key={message.id}
              data-testid={`message-${message.role}`}
              className={
                message.role === "user"
                  ? "flex justify-end"
                  : "flex justify-start"
              }
            >
              <div
                className={
                  message.role === "user"
                    ? "max-w-[80%] rounded-lg px-3 py-2 bg-primary text-primary-foreground text-sm"
                    : "max-w-[90%] rounded-lg px-3 py-2 bg-muted text-foreground text-sm whitespace-pre-wrap"
                }
              >
                {text}
              </div>
            </div>
          );
        })}

        {/* Streaming indicator */}
        {isStreaming && (
          <div data-testid="streaming-indicator" className="flex justify-start">
            <div className="rounded-lg px-3 py-2 bg-muted text-muted-foreground text-sm animate-pulse">
              {surface.active_agent} is thinking…
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* ----------------------------------------------------------------
          Input bar
      ---------------------------------------------------------------- */}
      <form
        data-testid="chat-form"
        onSubmit={handleSubmit}
        className="shrink-0 border-t border-border p-3"
      >
        <div className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-2 focus-within:border-primary transition-colors">
          <input
            data-testid="chat-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask ${surface.active_agent}…`}
            disabled={isStreaming}
            aria-label={`Message ${surface.active_agent}`}
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            aria-label="Send message"
            data-testid="chat-send-button"
            className="shrink-0 rounded px-2 py-1 text-xs font-medium bg-primary text-primary-foreground disabled:opacity-40 hover:bg-primary/90 transition-colors"
          >
            {isStreaming ? "…" : "Send"}
          </button>
        </div>
        {surface.thread_id && (
          <p
            data-testid="thread-id-display"
            className="text-[10px] text-muted-foreground mt-1 text-center truncate"
          >
            Thread: {surface.thread_id}
          </p>
        )}
      </form>
    </section>
  );
}
