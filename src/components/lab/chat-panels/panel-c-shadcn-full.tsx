"use client";

/**
 * Panel C — shadcn/ui AI chatbot style renderer.
 * Model selector is display-only, showing "claude-sonnet-4-6".
 * Receives shared DisplayMessage props — no useChat hook.
 */

import { useRef, useEffect } from "react";
import type { DisplayMessage } from "@/components/lab/types";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/chat/layout/markdown";
import { Separator } from "@/components/ui/separator";
import { ChevronDown } from "lucide-react";

export interface PanelCProps {
  messages: DisplayMessage[];
  isLoading: boolean;
  compact?: boolean;
}

export function PanelCShadcn({ messages, isLoading, compact }: PanelCProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  return (
    <div className={cn("flex flex-col flex-1 min-h-0 overflow-hidden", compact && "text-xs")}>
      {/* Toolbar strip — model selector display only */}
      {!compact && (
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-background/95 shrink-0">
          <span className="text-xs text-muted-foreground">Model</span>
          <button
            disabled
            className="flex items-center gap-1 text-xs font-medium bg-muted px-2 py-0.5 rounded border cursor-default"
          >
            claude-sonnet-4-6
            <ChevronDown className="size-3 text-muted-foreground" />
          </button>
          <span className="ml-auto text-[10px] text-muted-foreground italic">display only</span>
        </div>
      )}

      <div className="flex-1 overflow-y-auto min-h-0">
        <div className={cn("flex flex-col py-4", compact ? "px-2 gap-2" : "px-4 gap-4")}>
          {messages.length === 0 && !isLoading && (
            <p className="text-sm text-muted-foreground text-center py-8">Start a conversation.</p>
          )}

          {messages.map((msg, idx) => {
            const isUser = msg.role === "user";
            const prevIsUser = idx > 0 && messages[idx - 1].role === "user";

            return (
              <div key={msg.id}>
                {idx > 0 && isUser !== prevIsUser && (
                  <Separator className="my-2 opacity-40" />
                )}

                {isUser ? (
                  <div className="flex justify-end">
                    <div
                      className={cn(
                        "max-w-[75%] rounded-xl bg-primary text-primary-foreground whitespace-pre-wrap leading-relaxed",
                        compact ? "text-xs px-2 py-1.5" : "text-sm px-4 py-2.5"
                      )}
                    >
                      {msg.content}
                    </div>
                  </div>
                ) : (
                  <div className={cn("flex flex-col gap-1", compact ? "text-xs" : "text-sm")}>
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                      Assistant
                    </span>
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <Markdown content={msg.content} />
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {isLoading && (
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Assistant
              </span>
              <div className="flex gap-1 items-center py-1">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-1.5 rounded-full bg-muted-foreground/40 animate-bounce"
                    style={{ animationDelay: `${i * 0.12}s` }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>
    </div>
  );
}
