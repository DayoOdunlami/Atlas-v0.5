"use client";

/**
 * Sanitized text renderer for assistant messages.
 * Strips model_patch JSON and shows a build trace instead of raw patch payloads.
 */

import { MarkdownTextPrimitive } from "@assistant-ui/react-markdown";
import { useMessagePartText } from "@assistant-ui/react";
import ReactMarkdown from "react-markdown";
import {
  looksLikePatchPayload,
  stripPatchJsonFromChat,
} from "@/lib/workbench/patch-normalize";
import { useWorkbench } from "@/lib/workbench/workbench-context";
import { ChatArtifactBuildTrace } from "./chat-artifact-build-trace";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function WorkbenchMessageText(_props: any) {
  const part = useMessagePartText();
  const { reasoningSteps } = useWorkbench();
  const text = part.text ?? "";
  const isRunning = part.status?.type === "running";
  const isPatch = looksLikePatchPayload(text);
  const clean = stripPatchJsonFromChat(text);

  // Non-patch messages — default markdown renderer
  if (!isPatch) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return <MarkdownTextPrimitive as any />;
  }

  // Patch route: never show raw JSON
  if (isRunning || !clean) {
    return (
      <ChatArtifactBuildTrace
        steps={reasoningSteps}
        isRunning={isRunning}
        done={!isRunning}
      />
    );
  }

  return (
    <div className="space-y-2">
      <div className="prose prose-sm dark:prose-invert max-w-none text-xs leading-relaxed [&_p]:my-1">
        <ReactMarkdown>{clean}</ReactMarkdown>
      </div>
      {!isRunning && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Applied to artifact — use undo to revert
        </p>
      )}
    </div>
  );
}
