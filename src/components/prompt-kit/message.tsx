"use client";

import * as React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// Message — matches prompt-kit Message / MessageContent / MessageActions API
// ---------------------------------------------------------------------------

interface MessageProps extends React.HTMLAttributes<HTMLDivElement> {
  from?: "user" | "assistant";
  children: React.ReactNode;
}

const Message = React.forwardRef<HTMLDivElement, MessageProps>(
  ({ className, from, children, ...props }, ref) => (
    <div
      ref={ref}
      data-from={from}
      className={cn("flex flex-col gap-1", className)}
      {...props}
    >
      {children}
    </div>
  ),
);
Message.displayName = "Message";

// ---------------------------------------------------------------------------
// MessageContent
// ---------------------------------------------------------------------------

interface MessageContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** When true renders children as markdown via react-markdown */
  markdown?: boolean;
}

const MessageContent = React.forwardRef<HTMLDivElement, MessageContentProps>(
  ({ className, markdown, children, ...props }, ref) => {
    if (markdown && typeof children === "string") {
      return (
        <div
          ref={ref}
          className={cn(
            "prose prose-sm max-w-none text-foreground",
            "[&>p]:mb-2 [&>p:last-child]:mb-0",
            "[&>ul]:mb-2 [&>ol]:mb-2",
            "[&>pre]:rounded [&>pre]:bg-muted [&>pre]:p-3 [&>pre]:overflow-x-auto",
            "[&>code]:rounded [&>code]:bg-muted [&>code]:px-1 [&>code]:py-0.5 [&>code]:text-xs",
            className,
          )}
          {...props}
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
        </div>
      );
    }

    return (
      <div
        ref={ref}
        className={cn("text-sm leading-relaxed", className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);
MessageContent.displayName = "MessageContent";

// ---------------------------------------------------------------------------
// MessageActions + MessageAction (tooltip wrapper)
// ---------------------------------------------------------------------------

interface MessageActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const MessageActions = React.forwardRef<HTMLDivElement, MessageActionsProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex items-center gap-0.5", className)}
      {...props}
    >
      {children}
    </div>
  ),
);
MessageActions.displayName = "MessageActions";

interface MessageActionProps {
  tooltip: string;
  delayDuration?: number;
  children: React.ReactNode;
}

function MessageAction({ tooltip, delayDuration = 300, children }: MessageActionProps) {
  return (
    <TooltipProvider delayDuration={delayDuration}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="bottom">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { Message, MessageContent, MessageActions, MessageAction };
