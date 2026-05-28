"use client";
import type { AssistantMessageProps } from "@copilotkit/react-ui";
import { Markdown } from "@/components/chat/layout/markdown";
import { Cursor } from "@/components/chat/layout/cursor";

/** Returns true when the message content is CopilotKit's raw agent-state dump.
 *  These appear as a JSON object containing known ATLAS/JARVIS state keys.
 *  We suppress them — the structured output lives in the artifact panel instead. */
function isRawStateMessage(content: string): boolean {
  const trimmed = content.trim();

  // Strip a ```json … ``` or ``` … ``` code fence (multiline-safe)
  let inner = trimmed;
  if (trimmed.startsWith("```")) {
    inner = trimmed
      .replace(/^```(?:json)?\s*/i, "")  // strip opening fence + optional lang tag
      .replace(/\s*```\s*$/, "")          // strip closing fence
      .trim();                             // ← critical: removes leading \n left by multiline blocks
  }

  // Must look like a JSON object at the top level
  if (!inner.startsWith("{")) return false;

  // Only suppress when recognisable ATLAS/JARVIS state keys are present.
  // Use a small set of keys that only appear in agent state, not in prose.
  return (
    inner.includes('"sections"') ||
    inner.includes('"corpus_citations"') ||
    inner.includes('"decision_spine"') ||
    inner.includes('"confidence_tier"') ||
    inner.includes('"artifact_block"') ||
    inner.includes('"five_case_model"') ||
    inner.includes('"evidence_gaps"')
  );
}

export function AssistantBubble({
  message,
  isGenerating,
  isLoading,
}: AssistantMessageProps) {
  const content = message?.content ?? "";

  if (!message) return null;

  // Suppress raw agent-state JSON that CopilotKit injects into the message list.
  // The structured output is rendered in the artifact panel; nothing useful to show here.
  if (isRawStateMessage(content)) return null;

  if (!content && !isLoading && !isGenerating && !message.generativeUI) {
    return null;
  }

  if (isLoading && !message.generativeUI) return <Cursor className="mt-3" />;

  // When generativeUI is registered, use it exclusively (handles useCoAgentStateRender).
  if (message.generativeUI) {
    const rendered = message.generativeUI();
    if (!rendered) return null;
    return <div className="py-2">{rendered}</div>;
  }

  return (
    <div className="py-2">
      <div className="text-foreground rounded-lg p-3">
        <Markdown content={content} />
      </div>
    </div>
  );
}
