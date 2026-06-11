import type { ContextCardBlock as T } from "@/lib/workbench/atlas-render-model";
import { BlockShell } from "../shared/block-shell";
import ReactMarkdown from "react-markdown";
import { FileText } from "lucide-react";

interface Citation {
  id?: string;
  title?: string;
  organisation?: string;
  score?: number;
}

interface SingleSubjectContent {
  subject?: string;
  body?: string;
  text?: string;
  summary?: string;
  description?: string;
  citations?: Citation[];
}

interface PairedContent {
  source?: {
    title?: string;
    summary?: string;
  };
  target?: {
    title?: string;
    abstract?: string;
    summary?: string;
    funder?: string;
    status?: string;
    funding_amount?: number;
  };
}

function isPaired(content: unknown): content is PairedContent {
  if (!content || typeof content !== "object") return false;
  return "source" in content || "target" in content;
}

function extractBody(content: unknown): string {
  if (typeof content === "string") return content;
  if (!content || typeof content !== "object") return "";
  const c = content as SingleSubjectContent;
  return c.body ?? c.text ?? c.summary ?? c.description ?? "";
}

function extractSubject(content: unknown): string | undefined {
  if (!content || typeof content !== "object") return undefined;
  return (content as SingleSubjectContent).subject;
}

function extractCitations(content: unknown): Citation[] {
  if (!content || typeof content !== "object") return [];
  const c = content as SingleSubjectContent;
  return Array.isArray(c.citations) ? c.citations : [];
}

function CitationStrip({ citations }: { citations: Citation[] }) {
  if (citations.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 pt-2 mt-2 border-t border-border/60">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 self-center pr-1">
        Sources
      </span>
      {citations.slice(0, 8).map((c, i) => (
        <span
          key={c.id ?? i}
          title={c.title}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md border border-border bg-background hover:bg-muted/50 transition-colors max-w-[200px] truncate"
        >
          <FileText className="w-3 h-3 text-muted-foreground shrink-0" />
          <span className="truncate font-medium">{c.title ?? "Project"}</span>
          {typeof c.score === "number" && (
            <span className="text-muted-foreground tabular-nums shrink-0">
              {Math.round(c.score * 100)}%
            </span>
          )}
        </span>
      ))}
    </div>
  );
}

export function ContextCardBlock({ block }: { block: T }) {
  const content = block.content as unknown;

  // Paired card (passport + target) — the original schema
  if (isPaired(content)) {
    const { source, target } = content;
    return (
      <BlockShell headline={block.headline}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {source && (
            <div className="rounded-md border border-border bg-muted/10 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Source passport
              </p>
              {source.title && (
                <p className="text-sm font-medium leading-snug">{source.title}</p>
              )}
              {source.summary && (
                <p className="text-xs text-muted-foreground leading-relaxed">{source.summary}</p>
              )}
            </div>
          )}
          {target && (
            <div className="rounded-md border border-border bg-muted/10 p-3 space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Target project
              </p>
              {target.title && (
                <p className="text-sm font-medium leading-snug">{target.title}</p>
              )}
              {(target.abstract ?? target.summary) && (
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {target.abstract ?? target.summary}
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-1 text-xs text-muted-foreground">
                {target.funder && (
                  <span>
                    <span className="font-medium">Funder:</span> {target.funder}
                  </span>
                )}
                {target.status && (
                  <span>
                    <span className="font-medium">Status:</span> {target.status}
                  </span>
                )}
                {target.funding_amount && (
                  <span>
                    <span className="font-medium">Value:</span> £
                    {target.funding_amount.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      </BlockShell>
    );
  }

  // Single-subject card — agent-generated free-form context
  const body = extractBody(content);
  const subject = extractSubject(content);
  const citations = extractCitations(content);

  return (
    <BlockShell headline={block.headline}>
      <div className="rounded-md border border-border bg-background p-4 space-y-2">
        {subject && (
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            {subject}
          </p>
        )}
        {body ? (
          <div
            className="text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none
                       [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:pl-5 [&_ol]:pl-5
                       [&_li]:my-0.5 [&_li]:marker:text-muted-foreground/60
                       [&_strong]:font-semibold [&_strong]:text-foreground
                       [&_h1]:text-base [&_h1]:font-semibold [&_h1]:mt-2 [&_h1]:mb-1
                       [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:mt-2 [&_h2]:mb-1
                       [&_h3]:text-sm [&_h3]:font-medium [&_h3]:mt-1.5 [&_h3]:mb-0.5
                       [&_code]:text-[12px] [&_code]:bg-muted [&_code]:px-1 [&_code]:rounded"
          >
            <ReactMarkdown>{body}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No content provided for this card.
          </p>
        )}
        <CitationStrip citations={citations} />
      </div>
    </BlockShell>
  );
}
