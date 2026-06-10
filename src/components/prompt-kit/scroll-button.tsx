"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { ArrowDown } from "lucide-react";

// ---------------------------------------------------------------------------
// ScrollButton — matches prompt-kit ScrollButton API.
//
// Finds the nearest scrollable ancestor and scrolls it to the bottom.
// Visible only when the user has scrolled up (not at bottom).
// ---------------------------------------------------------------------------

interface ScrollButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Pixels from bottom threshold before showing the button. Default 80. */
  threshold?: number;
}

function ScrollButton({ className, threshold = 80, ...props }: ScrollButtonProps) {
  const ref = React.useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const btn = ref.current;
    if (!btn) return;

    // Walk up the DOM tree to find the nearest scrollable ancestor
    let el: HTMLElement | null = btn.parentElement;
    while (el && el !== document.documentElement) {
      const { overflow, overflowY } = window.getComputedStyle(el);
      if (/(auto|scroll)/.test(overflow + overflowY)) break;
      el = el.parentElement;
    }

    if (!el) return;
    const scrollable = el;

    const checkScroll = () => {
      const distFromBottom =
        scrollable.scrollHeight - scrollable.scrollTop - scrollable.clientHeight;
      setVisible(distFromBottom > threshold);
    };

    scrollable.addEventListener("scroll", checkScroll, { passive: true });
    checkScroll();

    return () => scrollable.removeEventListener("scroll", checkScroll);
  }, [threshold]);

  const handleClick = React.useCallback(() => {
    const btn = ref.current;
    if (!btn) return;
    let el: HTMLElement | null = btn.parentElement;
    while (el && el !== document.documentElement) {
      const { overflow, overflowY } = window.getComputedStyle(el);
      if (/(auto|scroll)/.test(overflow + overflowY)) break;
      el = el.parentElement;
    }
    el?.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, []);

  if (!visible) return null;

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      className={cn(
        "flex items-center justify-center rounded-full",
        "w-7 h-7 bg-background border border-border shadow-sm",
        "text-muted-foreground hover:text-foreground hover:border-foreground/40",
        "transition-all",
        className,
      )}
      aria-label="Scroll to bottom"
      {...props}
    >
      <ArrowDown className="w-3.5 h-3.5" />
    </button>
  );
}

export { ScrollButton };
