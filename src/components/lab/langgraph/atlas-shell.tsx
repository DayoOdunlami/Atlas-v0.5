"use client";

/**
 * AtlasShell — static visual preview of the target assistant-ui layout.
 *
 * Three-column flex layout:
 *   ThreadList (240px) | Chat (flex-1) | Artifact panel (flex-2)
 *
 * Mock data only — no LangGraph wiring yet.
 * Goal: approve the end-state UI before a line of wiring is written.
 */

import { useState } from "react";
import {
  MapPin, Zap, Globe, Leaf, Plus, MessageSquare,
  ChevronRight, CheckCircle2, Loader2, Cpu, Mic,
  Search, BookOpen, FileText, BarChart3, Copy, ThumbsUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { MainLayout } from "@/components/dashboard/dashboard";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AgentId = "ATLAS" | "JARVIS" | "CICERONE" | "HYVE";
type ThreadItem = { id: string; title: string; agent: AgentId; time: string };

// ---------------------------------------------------------------------------
// Mock data
// ---------------------------------------------------------------------------

const AGENTS: Array<{ id: AgentId; label: string; icon: typeof MapPin; color: string; bg: string }> = [
  { id: "ATLAS",    label: "ATLAS",    icon: MapPin,  color: "text-indigo-600", bg: "bg-indigo-50 border-indigo-200" },
  { id: "JARVIS",   label: "JARVIS",   icon: Search,  color: "text-violet-600", bg: "bg-violet-50 border-violet-200" },
  { id: "CICERONE", label: "CICERONE", icon: Globe,   color: "text-amber-600",  bg: "bg-amber-50 border-amber-200"  },
  { id: "HYVE",     label: "HYVE",     icon: Leaf,    color: "text-emerald-600",bg: "bg-emerald-50 border-emerald-200" },
];

const THREADS: ThreadItem[] = [
  { id: "1", title: "Autonomous freight corridors UK", agent: "ATLAS",    time: "2m ago" },
  { id: "2", title: "EV charging investment brief",    agent: "ATLAS",    time: "1h ago" },
  { id: "3", title: "Active travel evidence base",     agent: "JARVIS",   time: "3h ago" },
  { id: "4", title: "Helsinki MaaS → UK transfer",    agent: "CICERONE", time: "Yesterday" },
  { id: "5", title: "Coastal adaptation HIVE study",  agent: "HYVE",     time: "2d ago" },
];

const COT_STEPS = [
  { id: "extract_query",            label: "Extracting query intent",    done: true  },
  { id: "search_corpus",            label: "Searching CPC corpus",       done: true  },
  { id: "external_evidence_search", label: "Searching external evidence",done: true  },
  { id: "build_five_case",          label: "Building Five Case brief",   done: false },
];

const MOCK_RESPONSE = `The strategic case for CPC commissioning a programme on **autonomous freight corridors** in the UK rests on three converging pressures:

**1. Decarbonisation imperative**
Road freight accounts for 17% of UK transport emissions. Autonomous platooning on dedicated corridors can reduce fuel consumption by 10–15% per vehicle, with full electrification reducing lifecycle emissions by up to 80% against the 2050 baseline.

**2. Productivity and competitiveness**
UK logistics productivity trails EU peers by 12%. Autonomous freight corridors reduce driver cost (£38k/yr average), enable 24/7 operation, and improve on-time delivery rates by an estimated 23% on pilot routes.

**3. CPC strategic fit**
CPC has existing corpus evidence on smart motorway infrastructure, last-mile logistics, and connected vehicle standards. This programme sits directly within the Connected Places mandate and leverages four existing JARVIS-identified projects.`;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function AgentDot({ id }: { id: AgentId }) {
  const colors: Record<AgentId, string> = {
    ATLAS: "bg-indigo-500", JARVIS: "bg-violet-500",
    CICERONE: "bg-amber-500", HYVE: "bg-emerald-500",
  };
  return <span className={cn("inline-block size-2 rounded-full shrink-0", colors[id])} />;
}

function ThreadListPanel({
  active, onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full border-r bg-muted/20 w-[240px] shrink-0">
      {/* Header */}
      <div className="p-3 border-b flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Threads</span>
        <button className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground rounded px-1.5 py-0.5 hover:bg-muted transition-colors">
          <Plus className="size-3" /> New
        </button>
      </div>

      {/* Thread list */}
      <div className="flex-1 overflow-y-auto py-1">
        {THREADS.map((t) => (
          <button
            key={t.id}
            onClick={() => onSelect(t.id)}
            className={cn(
              "w-full text-left px-3 py-2.5 flex items-start gap-2 hover:bg-muted/60 transition-colors",
              active === t.id && "bg-muted"
            )}
          >
            <AgentDot id={t.agent} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{t.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t.time}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function CoTPanel() {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-lg border bg-muted/30 text-xs overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/50 transition-colors"
      >
        <Loader2 className="size-3 text-amber-500 animate-spin shrink-0" />
        <span className="font-medium text-muted-foreground">Thinking…</span>
        <ChevronRight className={cn("ml-auto size-3 text-muted-foreground transition-transform", open && "rotate-90")} />
      </button>
      {open && (
        <div className="px-3 pb-2.5 flex flex-col gap-1.5 border-t">
          {COT_STEPS.map((s) => (
            <div key={s.id} className="flex items-center gap-2 py-0.5">
              {s.done
                ? <CheckCircle2 className="size-3 text-emerald-500 shrink-0" />
                : <Loader2 className="size-3 text-amber-500 animate-spin shrink-0" />
              }
              <span className={cn("text-[11px]", s.done ? "text-foreground" : "text-muted-foreground")}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[75%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5 text-sm leading-relaxed">
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({ text, streaming }: { text: string; streaming?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="prose prose-sm max-w-none dark:prose-invert text-foreground">
        <ReactMarkdown>{text}</ReactMarkdown>
        {streaming && <span className="inline-block w-0.5 h-4 bg-foreground animate-pulse ml-0.5 align-text-bottom" />}
      </div>
      {!streaming && (
        <div className="flex items-center gap-1 mt-0.5">
          <button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <Copy className="size-3" />
          </button>
          <button className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <ThumbsUp className="size-3" />
          </button>
          <div className="flex gap-1 ml-1">
            {["[1]", "[2]", "[3]", "[4]"].map((c) => (
              <Badge key={c} variant="outline" className="text-[10px] font-mono px-1 py-0 h-4 border-primary/30 text-primary/70">
                {c}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChatPane({ activeAgent, onAgentChange }: { activeAgent: AgentId; onAgentChange: (a: AgentId) => void }) {
  return (
    <div className="flex flex-col flex-1 min-w-0 min-h-0 overflow-hidden">
      {/* Header: agent tabs + model selector */}
      <div className="shrink-0 border-b bg-background/95 backdrop-blur-sm px-4 py-2 flex items-center gap-1.5">
        {AGENTS.map((a) => {
          const Icon = a.icon;
          const isActive = a.id === activeAgent;
          return (
            <button
              key={a.id}
              onClick={() => onAgentChange(a.id)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-all",
                isActive ? cn(a.bg, a.color) : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              <Icon className="size-3 shrink-0" />
              {a.label}
            </button>
          );
        })}
        <div className="flex-1" />
        {/* Model selector */}
        <button className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium bg-muted/60 border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Cpu className="size-3 shrink-0" />
          Claude Sonnet 4.6
        </button>
        {/* Voice button */}
        <button className="inline-flex items-center justify-center size-7 rounded-full border bg-muted/60 border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
          <Mic className="size-3" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="flex flex-col gap-5 px-6 py-6 max-w-2xl mx-auto">
          <UserBubble text="What is the strategic case for CPC to commission a programme on autonomous freight corridors in the UK?" />
          <CoTPanel />
          <AssistantBubble text={MOCK_RESPONSE} streaming />
        </div>
      </div>

      {/* Input */}
      <div className="shrink-0 border-t bg-background px-4 py-3">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2 rounded-2xl border bg-muted/30 px-3 py-2.5 focus-within:ring-1 focus-within:ring-ring">
            <div className="flex gap-1.5 shrink-0 pb-0.5">
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 cursor-pointer hover:bg-muted">
                @ATLAS
              </Badge>
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 cursor-pointer hover:bg-muted text-muted-foreground">
                CPC
              </Badge>
            </div>
            <textarea
              rows={1}
              placeholder="Ask a question or type @ to switch agent…"
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground min-h-[24px] max-h-[120px]"
              readOnly
            />
            <button className="shrink-0 inline-flex items-center justify-center size-7 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors mb-0.5">
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AtlasShell — root layout
// ---------------------------------------------------------------------------

export function AtlasShell() {
  const [activeThread, setActiveThread] = useState("1");
  const [activeAgent, setActiveAgent] = useState<AgentId>("ATLAS");

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left: thread list */}
      <ThreadListPanel active={activeThread} onSelect={setActiveThread} />

      {/* Centre: chat */}
      <ChatPane activeAgent={activeAgent} onAgentChange={setActiveAgent} />

      {/* Right: artifact panel */}
      <div className="overflow-y-auto border-l shrink-0 w-[420px]">
        <MainLayout className="w-full" />
      </div>
    </div>
  );
}
