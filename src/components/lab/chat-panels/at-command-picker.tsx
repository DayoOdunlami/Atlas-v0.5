"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowUp, Square } from "lucide-react";
import type { AgentId, LensId } from "@/lib/atlas5/types";

// ---------------------------------------------------------------------------
// @ command options
// ---------------------------------------------------------------------------

type AgentOption = { kind: "agent"; label: string; value: AgentId; description: string };
type LensOption = { kind: "lens"; label: string; value: LensId; description: string };
type CommandOption = AgentOption | LensOption;

const ALL_OPTIONS: CommandOption[] = [
  { kind: "agent", label: "@atlas", value: "ATLAS", description: "Innovation Strategist" },
  { kind: "agent", label: "@jarvis", value: "JARVIS", description: "Corpus Explorer" },
  { kind: "agent", label: "@cicerone", value: "CICERONE", description: "Cross-Sector Transfer" },
  { kind: "agent", label: "@hyve", value: "HYVE", description: "Climate Adaptation" },
  { kind: "lens", label: "@cpc", value: "CPC", description: "CPC portfolio lens" },
  { kind: "lens", label: "@funder", value: "Funder", description: "Funding landscape" },
  { kind: "lens", label: "@mode", value: "Mode", description: "Transport mode lens" },
];

// ---------------------------------------------------------------------------
// AtCommandPicker popup
// ---------------------------------------------------------------------------

interface AtCommandPickerProps {
  query: string;
  onSelectAgent: (agent: AgentId) => void;
  onSelectLens: (lens: LensId) => void;
  onClose: () => void;
}

export function AtCommandPicker({
  query,
  onSelectAgent,
  onSelectLens,
  onClose,
}: AtCommandPickerProps) {
  const q = query.toLowerCase();
  const filtered = ALL_OPTIONS.filter(
    (o) => q === "" || o.label.slice(1).startsWith(q)
  );

  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [onClose]);

  if (filtered.length === 0) return null;

  const agents = filtered.filter((o): o is AgentOption => o.kind === "agent");
  const lenses = filtered.filter((o): o is LensOption => o.kind === "lens");

  return (
    <div className="absolute bottom-full mb-2 left-0 w-64 bg-popover border rounded-lg shadow-lg z-50 overflow-hidden">
      {agents.length > 0 && (
        <section>
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider bg-muted/40">
            Agents
          </div>
          {agents.map((opt) => (
            <button
              key={opt.value}
              className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors flex items-center justify-between gap-2"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectAgent(opt.value);
              }}
            >
              <span className="text-sm font-mono text-accent shrink-0">{opt.label}</span>
              <span className="text-xs text-muted-foreground truncate">{opt.description}</span>
            </button>
          ))}
        </section>
      )}
      {lenses.length > 0 && (
        <section>
          <div className="px-3 py-1.5 text-[10px] text-muted-foreground font-semibold uppercase tracking-wider bg-muted/40">
            Lenses
          </div>
          {lenses.map((opt) => (
            <button
              key={opt.value}
              className="w-full text-left px-3 py-2 hover:bg-accent/50 transition-colors flex items-center justify-between gap-2"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectLens(opt.value);
              }}
            >
              <span className="text-sm font-mono text-blue-500 shrink-0">{opt.label}</span>
              <span className="text-xs text-muted-foreground truncate">{opt.description}</span>
            </button>
          ))}
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LabInput — shared input for Panels B/C/D with @ command support
// ---------------------------------------------------------------------------

interface LabInputProps {
  onSend: (text: string) => Promise<void>;
  isLoading: boolean;
  onStop: () => void;
  onAgentChange: (agent: AgentId) => void;
  onLensChange: (lens: LensId) => void;
}

export function LabInput({
  onSend,
  isLoading,
  onStop,
  onAgentChange,
  onLensChange,
}: LabInputProps) {
  const [text, setText] = useState("");
  const [showPicker, setShowPicker] = useState(false);
  const [atQuery, setAtQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const canSend = !isLoading && text.trim().length > 0;

  const handleChange = (value: string) => {
    setText(value);

    // Detect the last @ in the text and extract the query after it
    const atIdx = value.lastIndexOf("@");
    if (atIdx !== -1) {
      const afterAt = value.slice(atIdx + 1);
      // Only show picker if there's no space after @ (still typing the command)
      if (!afterAt.includes(" ")) {
        setAtQuery(afterAt);
        setShowPicker(true);
        return;
      }
    }
    setShowPicker(false);
    setAtQuery("");
  };

  const handleSelectAgent = (agent: AgentId) => {
    // Remove the @<token> from the text
    const cleaned = text.replace(/@\S*$/, "").trimEnd();
    setText(cleaned);
    setShowPicker(false);
    setAtQuery("");
    onAgentChange(agent);
    console.log("[LabChat] agent changed →", agent);
  };

  const handleSelectLens = (lens: LensId) => {
    const cleaned = text.replace(/@\S*$/, "").trimEnd();
    setText(cleaned);
    setShowPicker(false);
    setAtQuery("");
    onLensChange(lens);
    console.log("[LabChat] lens changed →", lens);
  };

  const submit = async () => {
    if (!canSend) return;
    const msg = text.trim();
    setText("");
    setShowPicker(false);
    await onSend(msg);
  };

  return (
    <div className="p-3 px-4 bg-card shrink-0" ref={containerRef}>
      <div className="relative mx-auto max-w-none">
        {showPicker && (
          <AtCommandPicker
            query={atQuery}
            onSelectAgent={handleSelectAgent}
            onSelectLens={handleSelectLens}
            onClose={() => setShowPicker(false)}
          />
        )}

        <div className="rounded-xl border bg-card shadow-sm px-3 py-2 flex items-end gap-2">
          <Textarea
            value={text}
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Ask for anything — type @ to switch agent or lens"
            className="min-h-20 border-0 focus-visible:ring-0 px-0 resize-none shadow-none max-h-48 pb-4 px-2 bg-white"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
          />
          {isLoading ? (
            <Button
              size="icon"
              variant="ghost"
              onClick={onStop}
              title="Stop generating"
              className="text-accent hover:text-white"
            >
              <Square className="size-3 animate-pulse" />
            </Button>
          ) : (
            <Button
              size="icon"
              variant="ghost"
              disabled={!canSend}
              onClick={submit}
              title="Send"
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground text-center">
          Press Enter to send • Shift+Enter for new line • @ to switch agent/lens
        </p>
      </div>
    </div>
  );
}
