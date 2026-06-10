"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// ---------------------------------------------------------------------------
// PromptInput — compound input component
//
// Matches prompt-kit's PromptInput API:
//   value, onValueChange, onSubmit, isLoading
// ---------------------------------------------------------------------------

interface PromptInputContextValue {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  isLoading: boolean;
  disabled: boolean;
}

const PromptInputContext = React.createContext<PromptInputContextValue>({
  value: "",
  onValueChange: () => {},
  onSubmit: () => {},
  isLoading: false,
  disabled: false,
});

function usePromptInput() {
  return React.useContext(PromptInputContext);
}

interface PromptInputProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSubmit"> {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: () => void;
  isLoading?: boolean;
  disabled?: boolean;
  children: React.ReactNode;
}

function PromptInput({
  value,
  onValueChange,
  onSubmit,
  isLoading = false,
  disabled = false,
  className,
  children,
  ...props
}: PromptInputProps) {
  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey && !isLoading && !disabled) {
        e.preventDefault();
        if (value.trim()) onSubmit();
      }
    },
    [onSubmit, isLoading, disabled, value],
  );

  return (
    <PromptInputContext.Provider
      value={{ value, onValueChange, onSubmit, isLoading, disabled }}
    >
      <div
        className={cn(
          "rounded-xl border border-input bg-background transition-colors",
          "focus-within:ring-1 focus-within:ring-ring",
          (disabled || isLoading) && "opacity-60",
          className,
        )}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </div>
    </PromptInputContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// PromptInputTextarea
// ---------------------------------------------------------------------------

interface PromptInputTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> {
  placeholder?: string;
}

const PromptInputTextarea = React.forwardRef<
  HTMLTextAreaElement,
  PromptInputTextareaProps
>(({ className, placeholder = "Ask anything…", ...props }, ref) => {
  const { value, onValueChange, isLoading, disabled } = usePromptInput();

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      onValueChange(e.target.value);
    },
    [onValueChange],
  );

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={handleChange}
      placeholder={placeholder}
      disabled={disabled || isLoading}
      rows={1}
      className={cn(
        "w-full resize-none bg-transparent px-3 pt-3 pb-1 text-sm",
        "placeholder:text-muted-foreground outline-none",
        "min-h-[40px] max-h-[120px] overflow-y-auto",
        "disabled:cursor-not-allowed",
        className,
      )}
      {...props}
    />
  );
});
PromptInputTextarea.displayName = "PromptInputTextarea";

// ---------------------------------------------------------------------------
// PromptInputActions — layout row for action buttons
// ---------------------------------------------------------------------------

interface PromptInputActionsProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function PromptInputActions({ className, children, ...props }: PromptInputActionsProps) {
  return (
    <div
      className={cn("flex items-center gap-1.5 px-2 pb-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PromptInputAction — tooltip wrapper for action buttons
// ---------------------------------------------------------------------------

interface PromptInputActionProps {
  tooltip: string;
  children: React.ReactNode;
}

function PromptInputAction({ tooltip, children }: PromptInputActionProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top">
          <p className="text-xs">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// PromptInputSubmit — pre-built submit button
// ---------------------------------------------------------------------------

interface PromptInputSubmitProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Explicit status mirror — 'streaming' disables the button */
  status?: "ready" | "submitted" | "streaming" | "error";
}

function PromptInputSubmit({ className, status, ...props }: PromptInputSubmitProps) {
  const { value, onSubmit, isLoading, disabled } = usePromptInput();
  const isDisabled =
    disabled || isLoading || status === "streaming" || !value.trim();

  return (
    <button
      type="button"
      onClick={onSubmit}
      disabled={isDisabled}
      className={cn(
        "flex items-center justify-center rounded-lg w-8 h-8",
        "bg-foreground text-background",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        "hover:bg-foreground/80 transition-colors",
        className,
      )}
      {...props}
    >
      {isLoading || status === "streaming" ? (
        <span className="w-3 h-3 rounded-sm bg-background" />
      ) : (
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M8 2L8 14M8 2L4 6M8 2L12 6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
    </button>
  );
}

export {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
  PromptInputSubmit,
  usePromptInput,
};
