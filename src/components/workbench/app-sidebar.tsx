"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  useWorkbench,
  CQ_LABELS,
  isMatchCq,
  type SessionListItem,
} from "@/lib/workbench/workbench-context";
import type { CanonicalQuestionId } from "@/lib/workbench/atlas-render-model";
import {
  Home,
  Search,
  Wrench,
  Zap,
  Shield,
  Settings,
  Clock,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

const CQ_ICONS: Record<CanonicalQuestionId, React.ReactNode> = {
  "cq.home":            <Home className="w-4 h-4" />,
  "cq.match.browse":    <Search className="w-4 h-4" />,
  "cq.match.workbench": <Wrench className="w-4 h-4" />,
  "cq.match.act":       <Zap className="w-4 h-4" />,
  "cq.match.defend":    <Shield className="w-4 h-4" />,
};

// ---------------------------------------------------------------------------
// WorkbenchSessionsSection
//
// Renders a grouped list of recent sessions in the sidebar.
// Currently driven by DEMO_SESSIONS in WorkbenchContext.
//
// When backend is wired (step 5 of build sequence):
//   Replace recentSessions with: const { data } = useWorkbenchSessions(matchId)
//   No layout changes needed — just swap the data source.
// ---------------------------------------------------------------------------

function WorkbenchSessionItem({ session }: { session: SessionListItem }) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const label = session.title || `${session.passportTitle} — ${session.targetTitle}`;
  const timeAgo = formatDistanceToNow(new Date(session.updatedAt), { addSuffix: true });

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={collapsed ? label : undefined}
        className="h-auto py-2"
        // When backend wired: onClick={() => router.push(`/workbench?match_id=...&session=${session.threadId}`)}
      >
        <MessageSquare className="w-4 h-4 shrink-0 text-muted-foreground" />
        {!collapsed && (
          <div className="flex flex-col min-w-0 gap-0.5">
            <span className="text-xs font-medium leading-tight truncate">
              {label}
            </span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground truncate">
                {CQ_LABELS[session.cqId]}
              </span>
              <span className="text-[10px] text-muted-foreground/50">·</span>
              <span className="text-[10px] text-muted-foreground/70 shrink-0">
                {timeAgo}
              </span>
            </div>
          </div>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function WorkbenchSessionsSection() {
  const { recentSessions } = useWorkbench();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  if (recentSessions.length === 0) {
    return collapsed ? null : (
      <SidebarGroup>
        <SidebarGroupLabel className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Recent sessions
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <p className="px-2 py-2 text-[10px] text-muted-foreground/60 leading-relaxed">
            Sessions will appear here once the backend is wired.
          </p>
        </SidebarGroupContent>
      </SidebarGroup>
    );
  }

  return (
    <SidebarGroup>
      {!collapsed && (
        <SidebarGroupLabel className="flex items-center gap-1.5">
          <Clock className="w-3 h-3" />
          Recent sessions
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {recentSessions.map((session) => (
            <WorkbenchSessionItem key={session.id} session={session} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

// ---------------------------------------------------------------------------
// WorkbenchSidebar
// ---------------------------------------------------------------------------

export function WorkbenchSidebar() {
  const { cqId, setCqId, cqIds, session } = useWorkbench();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const hasMatch = Boolean(session.matchId);

  const homeIds = cqIds.filter((id) => !isMatchCq(id));
  const matchIds = cqIds.filter(isMatchCq);

  return (
    <Sidebar collapsible="icon">
      {/* Logo mark */}
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-3 border-b border-sidebar-border",
          collapsed && "justify-center",
        )}
      >
        <div className="w-6 h-6 rounded bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">
          A
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold truncate">Atlas</span>
        )}
      </div>

      <SidebarContent>
        {/* Top-level: Home */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {homeIds.map((id: CanonicalQuestionId) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    isActive={id === cqId}
                    tooltip={CQ_LABELS[id]}
                    onClick={() => setCqId(id)}
                  >
                    {CQ_ICONS[id]}
                    <span>{CQ_LABELS[id]}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Match-bound CQs — greyed out when no match is loaded */}
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="flex items-center gap-1.5">
              Match views
              {!hasMatch && (
                <span className="text-[9px] text-muted-foreground/50 normal-case font-normal">
                  · load a match
                </span>
              )}
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>
              {matchIds.map((id: CanonicalQuestionId) => (
                <SidebarMenuItem key={id}>
                  <SidebarMenuButton
                    isActive={id === cqId}
                    tooltip={CQ_LABELS[id]}
                    onClick={() => setCqId(id)}
                    disabled={!hasMatch}
                    className={cn(!hasMatch && "opacity-40")}
                  >
                    {CQ_ICONS[id]}
                    <span>{CQ_LABELS[id]}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Recent sessions — socket for Supabase data at step 5 */}
        <WorkbenchSessionsSection />
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Settings">
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
