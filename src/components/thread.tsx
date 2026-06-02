import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/attachment";
import { MarkdownText } from "@/components/markdown-text";
import { useArtifactStore } from "@/lib/atlas5/artifact-store";
import {
  Reasoning,
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "@/components/reasoning";
import {
  ToolGroupContent,
  ToolGroupRoot,
  ToolGroupTrigger,
} from "@/components/tool-group";
import { ToolFallback } from "@/components/tool-fallback";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AuiIf,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  AudioLines,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  Globe,
  Leaf,
  MapPin,
  Mic,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  RefreshCwIcon,
  Search,
  SlidersHorizontal,
  SquareIcon,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState, type FC } from "react";

/** Detects raw JSON agent state dumps that should not render in the chat thread. */
function isAgentJsonDump(text: string): boolean {
  const t = text.trim();
  const inner = t.startsWith("```")
    ? t.replace(/^```(?:json|python)?\s*/i, "").replace(/\s*```\s*$/, "").trim()
    : t;
  if ((!inner.startsWith("{") && !inner.startsWith("[")) || inner.length < 150) return false;
  const AGENT_FIELDS = [
    '"sections"', '"corpus_citations"', '"decision_spine"', '"confidence_tier"',
    '"artifact_block"', '"reasoning_trace"', '"tool_calls"', '"capability_scores"',
    '"recipe"', '"projects"', '"hive_citations"', '"five_case_model"',
  ];
  return AGENT_FIELDS.some((f) => inner.includes(f));
}

export const Thread: FC = () => {
  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root bg-background @container flex h-full flex-col"
      style={{
        ["--thread-max-width" as string]: "44rem",
        ["--composer-radius" as string]: "24px",
        ["--composer-padding" as string]: "10px",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth"
      >
        <div className="mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4">
          <AuiIf condition={(s) => s.thread.isEmpty}>
            <ThreadWelcome />
          </AuiIf>

          <div
            data-slot="aui_message-group"
            className="mb-10 flex flex-col gap-y-8 empty:hidden"
          >
            <ThreadPrimitive.Messages>
              {() => <ThreadMessage />}
            </ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter className="aui-thread-viewport-footer bg-background sticky bottom-0 mt-auto flex flex-col gap-4 overflow-visible rounded-t-(--composer-radius) pb-4 md:pb-6">
            <ThreadScrollToBottom />
            <ThinkingIndicator />
            <Composer />
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

// ---------------------------------------------------------------------------
// ThinkingIndicator — live agent reasoning trail above the composer.
//
// Shows:
//   • Immediately when isRunning fires (ArtifactRunBridge sets startRun)
//   • Each reasoning_trace step as it arrives (completed = faded, active = pulsing)
//   • Falls back to a plain "thinking…" line with bouncing dots before first step
//
// Mirrors CopilotKit Panel D's chain-of-thought but for the LangGraph/assistant-ui
// stack, reading from the shared ArtifactStore instead of useCoAgentStateRender.
// ---------------------------------------------------------------------------

const ThinkingIndicator: FC = () => {
  const isRunning = useAuiState(
    (s) => (s.thread as unknown as { isRunning?: boolean }).isRunning ?? false,
  );
  const { isLoading, reasoningTrace } = useArtifactStore();
  const active = isRunning || isLoading;

  if (!active) return null;

  // Show last 4 steps: earlier ones faded + struck through, current one pulsing
  const steps = reasoningTrace.slice(-4);

  return (
    <div className="px-1 pb-2 space-y-1" aria-live="polite" aria-label="Agent thinking">
      {steps.length > 0 ? (
        steps.map((step, i) => {
          const isActive = i === steps.length - 1;
          return (
            <div key={i} className="flex items-start gap-2">
              <span
                className={[
                  "mt-[5px] size-1.5 rounded-full shrink-0 transition-colors",
                  isActive
                    ? "bg-indigo-400 animate-pulse"
                    : "bg-emerald-400",
                ].join(" ")}
              />
              <p
                className={[
                  "text-[11px] leading-snug transition-opacity",
                  isActive
                    ? "text-foreground opacity-100"
                    : "text-muted-foreground opacity-40 line-through",
                ].join(" ")}
              >
                {step.thought}
                {!isActive && step.evidence_count != null && (
                  <span className="ml-1 not-italic opacity-70">({step.evidence_count})</span>
                )}
              </p>
            </div>
          );
        })
      ) : (
        /* Pre-trace fallback: bouncing dots */
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="block size-1.5 rounded-full bg-indigo-400 animate-bounce"
                style={{ animationDelay: `${i * 150}ms` }}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">Connecting to agent…</p>
        </div>
      )}
    </div>
  );
};

const ThreadMessage: FC = () => {
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);

  if (isEditing) return <EditComposer />;
  if (role === "user") return <UserMessage />;
  return <AssistantMessage />;
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <div className="aui-thread-welcome-root my-auto flex grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-4">
          <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-semibold duration-200">
            Where should we begin?
          </h1>
          <p className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-muted-foreground text-xl delay-75 duration-200">
            Ask a strategic question or pick a starting point below.
          </p>
        </div>
      </div>
      <ThreadSuggestions />
    </div>
  );
};

const ThreadSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions grid w-full gap-2 pb-4 @md:grid-cols-2">
      <ThreadPrimitive.Suggestions>
        {() => <ThreadSuggestionItem />}
      </ThreadPrimitive.Suggestions>
    </div>
  );
};

const ThreadSuggestionItem: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200 nth-[n+3]:hidden @md:nth-[n+3]:block">
      <SuggestionPrimitive.Trigger send asChild>
        <Button
          variant="ghost"
          className="aui-thread-welcome-suggestion bg-background hover:bg-muted h-auto w-full flex-wrap items-start justify-start gap-1 rounded-3xl border px-4 py-3 text-start text-sm transition-colors @md:flex-col"
        >
          <SuggestionPrimitive.Title className="aui-thread-welcome-suggestion-text-1 font-medium" />
          <SuggestionPrimitive.Description className="aui-thread-welcome-suggestion-text-2 text-muted-foreground empty:hidden" />
        </Button>
      </SuggestionPrimitive.Trigger>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Atlas agent / lens selector
// ---------------------------------------------------------------------------

type AgentId = "ATLAS" | "JARVIS" | "CICERONE" | "HYVE";
type LensId = "CPC" | "Ecosystem" | "Funder" | "Mode";

const AGENTS: Array<{ id: AgentId; label: string; Icon: typeof MapPin; color: string }> = [
  { id: "ATLAS",    label: "ATLAS",    Icon: MapPin,   color: "text-indigo-600" },
  { id: "JARVIS",   label: "JARVIS",   Icon: Search,   color: "text-violet-600" },
  { id: "CICERONE", label: "CICERONE", Icon: Globe,    color: "text-amber-600"  },
  { id: "HYVE",     label: "HYVE",     Icon: Leaf,     color: "text-emerald-600"},
];

const LENSES: LensId[] = ["CPC", "Ecosystem", "Funder", "Mode"];

const AtlasAgentMenu: FC<{
  agent: AgentId;
  lens: LensId;
  onAgent: (a: AgentId) => void;
  onLens: (l: LensId) => void;
}> = ({ agent, lens, onAgent, onLens }) => {
  const current = AGENTS.find((a) => a.id === agent)!;
  const Icon = current.Icon;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(
        "flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition-colors hover:bg-muted",
        current.color,
      )}>
        <Icon className="size-3.5 shrink-0" />
        <span className="hidden sm:inline">{agent}</span>
        <ChevronDownIcon className="size-3 opacity-50" />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start" className="w-52 bg-background shadow-lg border">
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">Agent</DropdownMenuLabel>
        {AGENTS.map(({ id, label, Icon: AgentIcon, color }) => (
          <DropdownMenuItem
            key={id}
            onClick={() => onAgent(id)}
            className={cn("gap-2 text-sm", agent === id && "bg-muted")}
          >
            <AgentIcon className={cn("size-3.5 shrink-0", color)} />
            {label}
            {agent === id && <CheckIcon className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-[11px] uppercase tracking-wide text-muted-foreground">Lens</DropdownMenuLabel>
        {LENSES.map((l) => (
          <DropdownMenuItem
            key={l}
            onClick={() => onLens(l)}
            className={cn("gap-2 text-sm", lens === l && "bg-muted")}
          >
            <Zap className="size-3.5 shrink-0 text-muted-foreground" />
            {l}
            {lens === l && <CheckIcon className="ml-auto size-3.5" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

// ---------------------------------------------------------------------------
// Composer — ChatGPT pill style
// ---------------------------------------------------------------------------

const Composer: FC = () => {
  const [agent, setAgent] = useState<AgentId>("ATLAS");
  const [lens, setLens] = useState<LensId>("CPC");

  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
      <ComposerPrimitive.AttachmentDropzone asChild>
        <div
          data-slot="aui_composer-shell"
          className="bg-background data-[dragging=true]:border-ring data-[dragging=true]:bg-accent/50 flex w-full flex-col rounded-[28px] border border-border px-2 py-2 shadow-sm transition-colors focus-within:border-ring/60 data-[dragging=true]:border-dashed"
        >
          <AuiIf condition={(s) => s.composer.attachments.length > 0}>
            <div className="flex flex-row flex-wrap gap-2 px-1 pt-1 pb-2">
              <ComposerAttachments />
            </div>
          </AuiIf>

          <ComposerPrimitive.Input
            placeholder="Ask a question…"
            className="aui-composer-input placeholder:text-muted-foreground/70 min-h-9 max-h-32 w-full resize-none bg-transparent px-3 pt-1 text-sm outline-none"
            rows={1}
            autoFocus
            aria-label="Message input"
          />

          <div className="flex items-center justify-between gap-2 px-1 pt-1">
            {/* Left: attachment + agent/lens */}
            <div className="flex items-center gap-0.5">
              <ComposerPrimitive.AddAttachment asChild>
                <button
                  type="button"
                  className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="Add attachment"
                >
                  <PlusIcon className="size-4" />
                </button>
              </ComposerPrimitive.AddAttachment>

              <AtlasAgentMenu
                agent={agent}
                lens={lens}
                onAgent={setAgent}
                onLens={setLens}
              />
            </div>

            {/* Right: mic / send / stop */}
            <div className="flex items-center gap-1">
              {/* Stop while running */}
              <AuiIf condition={(s) => s.thread.isRunning}>
                <ComposerPrimitive.Cancel asChild>
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-full bg-foreground text-background"
                    aria-label="Stop generating"
                  >
                    <SquareIcon className="size-2.5 fill-current" />
                  </button>
                </ComposerPrimitive.Cancel>
              </AuiIf>

              {/* Dictating — show stop-dictation pulse */}
              <AuiIf condition={(s) => !s.thread.isRunning && s.composer.dictation != null}>
                <ComposerPrimitive.StopDictation asChild>
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-full bg-indigo-600 text-white"
                    aria-label="Stop dictation"
                  >
                    <span className="size-2.5 animate-pulse rounded-sm bg-current" />
                  </button>
                </ComposerPrimitive.StopDictation>
              </AuiIf>

              {/* Idle + has text → Send */}
              <AuiIf condition={(s) => !s.thread.isRunning && s.composer.dictation == null && !s.composer.isEmpty}>
                <ComposerPrimitive.Send asChild>
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-full bg-foreground text-background transition-opacity disabled:opacity-30"
                    aria-label="Send message"
                  >
                    <ArrowUpIcon className="size-4" />
                  </button>
                </ComposerPrimitive.Send>
              </AuiIf>

              {/* Idle + empty → mic + realtime */}
              <AuiIf condition={(s) => !s.thread.isRunning && s.composer.dictation == null && s.composer.isEmpty}>
                <ComposerPrimitive.Dictate asChild>
                  <button
                    type="button"
                    className="flex size-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label="Dictate"
                  >
                    <Mic className="size-4" />
                  </button>
                </ComposerPrimitive.Dictate>
                {/* Realtime / LiveKit placeholder */}
                <button
                  type="button"
                  aria-label="Voice mode (coming soon)"
                  className="flex size-9 items-center justify-center rounded-full bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
                >
                  <AudioLines className="size-4" />
                </button>
              </AuiIf>
            </div>
          </div>
        </div>
      </ComposerPrimitive.AttachmentDropzone>
    </ComposerPrimitive.Root>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root border-destructive bg-destructive/10 text-destructive dark:bg-destructive/5 mt-2 rounded-md border p-3 text-sm dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantMessage: FC = () => {
  // reserves space for action bar and compensates with `-mb` for consistent msg spacing
  // keeps hovered action bar from shifting layout (autohide doesn't support absolute positioning well)
  // for pt-[n] use -mb-[n + 6] & min-h-[n + 6] to preserve compensation
  const ACTION_BAR_PT = "pt-1.5";
  const ACTION_BAR_HEIGHT = `-mb-7.5 min-h-7.5 ${ACTION_BAR_PT}`;

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="fade-in slide-in-from-bottom-1 animate-in relative duration-150"
    >
      <div
        data-slot="aui_assistant-message-content"
        // [contain-intrinsic-size:auto_24px] fixes issue #4104, don't change without checking for regressions
        className="text-foreground px-2 leading-relaxed wrap-break-word [contain-intrinsic-size:auto_24px] [content-visibility:auto]"
      >
        <MessagePrimitive.GroupedParts
          groupBy={groupPartByType({
            reasoning: ["group-chainOfThought", "group-reasoning"],
            "tool-call": ["group-chainOfThought", "group-tool"],
            "standalone-tool-call": [],
          })}
        >
          {({ part, children }) => {
            switch (part.type) {
              case "group-chainOfThought":
                return <div data-slot="aui_chain-of-thought">{children}</div>;
              case "group-reasoning": {
                const running = part.status.type === "running";
                return (
                  <ReasoningRoot defaultOpen={running}>
                    <ReasoningTrigger active={running} />
                    <ReasoningContent aria-busy={running}>
                      <ReasoningText>{children}</ReasoningText>
                    </ReasoningContent>
                  </ReasoningRoot>
                );
              }
              case "group-tool":
                return (
                  <ToolGroupRoot>
                    <ToolGroupTrigger
                      count={part.indices.length}
                      active={part.status.type === "running"}
                    />
                    <ToolGroupContent>{children}</ToolGroupContent>
                  </ToolGroupRoot>
                );
              case "text": {
                // Suppress raw JSON agent dumps — structured output is in the right panel.
                const rawText = (part as unknown as { text?: string }).text ?? "";
                if (isAgentJsonDump(rawText)) {
                  return (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground rounded-md border bg-muted/30 px-3 py-1.5 my-1">
                      <span className="size-2 rounded-full bg-emerald-400 shrink-0" />
                      Structured output captured — see right panel
                    </div>
                  );
                }
                return <MarkdownText />;
              }
              case "reasoning":
                return <Reasoning {...part} />;
              case "tool-call":
                return part.toolUI ?? <ToolFallback {...part} />;
              case "indicator":
                return (
                  <span
                    data-slot="aui_assistant-message-indicator"
                    className="animate-pulse font-sans"
                    aria-label="Assistant is working"
                  >
                    {"●"}
                  </span>
                );
              default:
                return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className={cn("ms-2 flex items-center", ACTION_BAR_HEIGHT)}
      >
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root text-muted-foreground col-start-3 row-start-2 -ms-1 flex gap-1"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <AuiIf condition={(s) => s.message.isCopied}>
            <CheckIcon />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <CopyIcon />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
      <ActionBarMorePrimitive.Root>
        <ActionBarMorePrimitive.Trigger asChild>
          <TooltipIconButton
            tooltip="More"
            className="data-[state=open]:bg-accent"
          >
            <MoreHorizontalIcon />
          </TooltipIconButton>
        </ActionBarMorePrimitive.Trigger>
        <ActionBarMorePrimitive.Content
          side="bottom"
          align="start"
          className="aui-action-bar-more-content bg-popover text-popover-foreground z-50 min-w-32 overflow-hidden rounded-md border p-1 shadow-md"
        >
          <ActionBarPrimitive.ExportMarkdown asChild>
            <ActionBarMorePrimitive.Item className="aui-action-bar-more-item hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none select-none">
              <DownloadIcon className="size-4" />
              Export as Markdown
            </ActionBarMorePrimitive.Item>
          </ActionBarPrimitive.ExportMarkdown>
        </ActionBarMorePrimitive.Content>
      </ActionBarMorePrimitive.Root>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      className="fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_60px] [content-visibility:auto] [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <UserMessageAttachments />

      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content peer bg-muted text-foreground rounded-2xl px-4 py-2.5 wrap-break-word empty:hidden">
          <MessagePrimitive.Parts />
        </div>
        <div className="aui-user-action-bar-wrapper absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker
        data-slot="aui_user-branch-picker"
        className="col-span-full col-start-1 row-start-3 -me-1 justify-end"
      />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_edit-composer-wrapper"
      className="flex flex-col px-2"
    >
      <ComposerPrimitive.Root className="aui-edit-composer-root bg-muted ms-auto flex w-full max-w-[85%] flex-col rounded-2xl">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent p-4 text-sm outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm">Update</Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root text-muted-foreground -ms-2 me-2 inline-flex items-center text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
