/**
 * Shared display types for the Lab chat panels.
 * Panels receive DisplayMessage[] rather than raw CopilotKit message objects
 * so each renderer stays decoupled from the CopilotKit internals.
 */

export interface TraceToolCall {
  tool: string;
  result_count?: number;
  checked?: number;
  passed?: number;
  removed?: number;
  model?: string;
  prompt?: string;
  status?: "ok" | "error" | "skipped";
  error?: string;
}

export interface ToolCallDisplay {
  id: string;
  /** Human-readable label (for node steps) or raw function name (for actions) */
  name: string;
  /** JSON args string for action calls; empty string for node steps */
  args: string;
  /** "node" = LangGraph graph node; "action" = CopilotKit frontend action */
  kind: "node" | "action";
  /** Reasoning trace entry from AgentStateMessage.state for this node step */
  trace?: {
    thought?: string;
    tool_calls?: TraceToolCall[];
    status?: "ok" | "error";
  };
}

export interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Populated for assistant messages that triggered tool calls */
  toolCalls?: ToolCallDisplay[];
}
