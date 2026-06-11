"use client";

import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  blockType?: string;
  blockId?: string;
}

interface State {
  error: Error | null;
}

/**
 * Per-block error boundary. A malformed agent-generated block must NEVER take
 * down the whole canvas — degrade gracefully and let the user undo or pin.
 */
export class BlockErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // eslint-disable-next-line no-console
    console.warn(
      `[BlockErrorBoundary] Block ${this.props.blockType ?? "?"}/${this.props.blockId ?? "?"} failed:`,
      error.message,
    );
  }

  render() {
    if (this.state.error) {
      return (
        <div className="rounded-lg border border-amber-300/60 bg-amber-50/40 dark:bg-amber-950/20 dark:border-amber-800/50 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-amber-800 dark:text-amber-200">
              Couldn&apos;t render this {this.props.blockType ?? "block"}
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              The agent emitted a shape this block can&apos;t display. Press undo (Ctrl+Z)
              to remove it, or ask the agent to try a different format.
            </p>
            <p className="text-[10px] text-muted-foreground/70 mt-1 font-mono break-all">
              {this.state.error.message}
            </p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
