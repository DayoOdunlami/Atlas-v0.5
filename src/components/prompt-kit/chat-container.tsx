"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// ChatContainer — scrollable conversation container
//
// Matches prompt-kit's ChatContainerRoot / ChatContainerContent API.
// ---------------------------------------------------------------------------

interface ChatContainerRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const ChatContainerRoot = React.forwardRef<HTMLDivElement, ChatContainerRootProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("relative flex flex-col h-full overflow-hidden", className)}
      {...props}
    >
      {children}
    </div>
  ),
);
ChatContainerRoot.displayName = "ChatContainerRoot";

interface ChatContainerContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const ChatContainerContent = React.forwardRef<HTMLDivElement, ChatContainerContentProps>(
  ({ className, children, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("flex-1 overflow-y-auto", className)}
      {...props}
    >
      {children}
    </div>
  ),
);
ChatContainerContent.displayName = "ChatContainerContent";

export { ChatContainerRoot, ChatContainerContent };
