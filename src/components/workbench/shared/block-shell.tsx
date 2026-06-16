import { cn } from "@/lib/utils";

/**
 * BlockShell — the chrome around every workbench block.
 *
 * Density rationale (post-density-pass):
 *   - Headline:  text-sm (14px) semibold so it reads as a card title, not a label.
 *   - Padding:   px-4 py-3 header, p-4 body — matches Linear/Notion card spacing.
 *   - Border:    bg-card so blocks lift off the muted canvas.
 */
export function BlockShell({
  headline,
  caption,
  children,
  className,
}: {
  headline?: string;
  caption?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card overflow-hidden", className)}>
      {(headline || caption) && (
        <div className="px-4 py-3 border-b border-border bg-muted/30 space-y-1">
          {headline && (
            <p className="text-sm font-semibold text-foreground leading-snug tracking-tight">
              {headline}
            </p>
          )}
          {caption && (
            <p className="text-xs text-muted-foreground leading-snug">{caption}</p>
          )}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
