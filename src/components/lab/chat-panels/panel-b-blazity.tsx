"use client";

/**
 * Panel B — Blazity shadcn-chatbot-kit style renderer.
 * Maps CopilotKit messages to a bubble layout with sender avatars.
 * Does NOT use Blazity's own useChat hook — receives shared DisplayMessage props.
 */

import { useRef, useEffect } from "react";
import type { DisplayMessage } from "@/components/lab/types";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Markdown } from "@/components/chat/layout/markdown";
import { ChainOfThought } from "@/components/lab/chain-of-thought";

export interface PanelBProps {
  messages: DisplayMessage[];
  isLoading: boolean;
  compact?: boolean;
}

export function PanelBBlazity({ messages, isLoading, compact }: PanelBProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className={cn("flex flex-col gap-3 p-4 overflow-y-auto flex-1 min-h-0", compact && "p-2 gap-2")}>
      {!compact && (
        <div className="flex items-center gap-2 pb-2 border-b mb-1 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Blazity chatbot-kit
          </span>
        </div>
      )}

      {messages.length === 0 && !isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No messages yet.</p>
        </div>
      )}

      {messages.map((msg) => {
        const isUser = msg.role === "user";
        const nodeToolCalls = !isUser
          ? (msg.toolCalls ?? []).filter((tc) => tc.kind === "node")
          : [];
        const isStreaming = msg.id === "__streaming__";

        return (
          <div key={msg.id} className="flex flex-col gap-1">
            {/* Chain of thought — above bubble for assistant messages */}
            {!isUser && nodeToolCalls.length > 0 && (
              <ChainOfThought
                toolCalls={nodeToolCalls}
                compact={compact}
                defaultOpen={isStreaming}
              />
            )}

            {/* Bubble — hidden for streaming sentinel (no content yet) */}
            {!isStreaming && (
              <div
                className={cn("flex gap-2 items-end", isUser ? "flex-row-reverse" : "flex-row")}
              >
                <Avatar className={cn("shrink-0", compact ? "size-5" : "size-7")}>
                  <AvatarFallback
                    className={cn(
                      "text-[10px]",
                      isUser ? "bg-accent text-accent-foreground" : "bg-primary/10 text-primary"
                    )}
                  >
                    {isUser ? "U" : "A"}
                  </AvatarFallback>
                </Avatar>

                <div
                  className={cn(
                    "max-w-[78%] rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    isUser
                      ? "rounded-br-sm bg-accent/15 text-foreground"
                      : "rounded-bl-sm bg-muted text-foreground",
                    compact && "text-xs px-2 py-1.5"
                  )}
                >
                  {isUser ? (
                    <span className="whitespace-pre-wrap">{msg.content}</span>
                  ) : (
                    <Markdown content={msg.content} />
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {isLoading && (
        <div className="flex gap-2 items-end">
          <Avatar className={cn("shrink-0", compact ? "size-5" : "size-7")}>
            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">A</AvatarFallback>
          </Avatar>
          <div className={cn("rounded-2xl rounded-bl-sm px-3 py-2 bg-muted", compact && "px-2 py-1.5")}>
            <span className="inline-flex gap-1 items-center">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="size-1.5 rounded-full bg-muted-foreground/50 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          </div>
        </div>
      )}

      <div ref={endRef} />
    </div>
  );
}
