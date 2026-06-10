import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { InsightExplorer } from "@/components/insights/insight-explorer"
import { ContextualChat } from "@/components/chat/contextual-chat"

export default function InsightsPage() {
  return (
    <DashboardLayout>
      <InsightExplorer />
      <ContextualChat context="insights" />
    </DashboardLayout>
  )
}
