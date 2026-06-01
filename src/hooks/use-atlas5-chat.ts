"use client";

/**
 * useAtlas5Chat — D6 chat hook.
 *
 * Wraps useCopilotChat (CopilotKit) and exposes a surface-facing API:
 *   messages  — AI SDK v5–style UIMessage array (id, role, parts)
 *   sendMessage — accepts { role: 'user', parts: [{ type: 'text', text }] }
 *   status    — 'idle' | 'submitted' | 'streaming'
 *
 * Kept thin deliberately — presentation logic stays in ChatPane.
 */

import { useCopilotChat } from "@copilotkit/react-core";
import { TextMessage, MessageRole } from "@copilotkit/runtime-client-gql";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

// "submitted" included so chat-pane's `status === "submitted"` check compiles.
// CopilotKit doesn't distinguish submitted vs streaming — both map to "streaming".
export type ChatStatus = "idle" | "submitted" | "streaming";

export interface UIMessage {
  id: string;
  role: "user" | "assistant";
  parts: Array<{ type: "text"; text: string }>;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAtlas5Chat() {
  const { visibleMessages, appendMessage, isLoading } = useCopilotChat();

  const messages: UIMessage[] = visibleMessages.map((msg) => {
    // Use the isTextMessage() type guard to safely access content
    const content = msg.isTextMessage() ? msg.content : "";

    return {
      id: msg.id,
      role: msg.isTextMessage() && msg.role === MessageRole.User
        ? "user"
        : "assistant",
      parts: [{ type: "text" as const, text: content }],
    };
  });

  const sendMessage = (msg: {
    role: "user";
    parts: Array<{ type: "text"; text: string }>;
  }) => {
    const text = msg.parts.map((p) => p.text).join("");
    appendMessage(new TextMessage({ role: MessageRole.User, content: text }));
  };

  const status: ChatStatus = isLoading ? "streaming" : "idle";

  return { messages, sendMessage, status };
}
