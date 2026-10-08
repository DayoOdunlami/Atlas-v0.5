import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { SettingsPage } from "@/components/settings/settings-page"
import { ContextualChat } from "@/components/chat/contextual-chat"

export default function Settings() {
  return (
    <DashboardLayout>
      <SettingsPage />
      <ContextualChat context="settings" />
    </DashboardLayout>
  )
}
