import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard"
import { ContextualChat } from "@/components/chat/contextual-chat"

export default function AnalyticsPage() {
  return (
    <DashboardLayout>
      <AnalyticsDashboard />
      <ContextualChat context="analytics" />
    </DashboardLayout>
  )
}
