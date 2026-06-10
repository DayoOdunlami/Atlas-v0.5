import { cn } from "@/lib/utils";

export function BlockShell({
  headline,
  children,
  className,
}: {
  headline?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card overflow-hidden", className)}>
      {headline && (
        <div className="px-4 py-2.5 border-b border-border bg-muted/20">
          <p className="text-xs font-semibold text-foreground leading-snug">{headline}</p>
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
