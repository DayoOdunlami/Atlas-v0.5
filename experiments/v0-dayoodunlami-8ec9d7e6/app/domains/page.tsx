import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { DomainManagement } from "@/components/domains/domain-management"
import { ContextualChat } from "@/components/chat/contextual-chat"

export default function DomainsPage() {
  return (
    <DashboardLayout>
      <DomainManagement />
      <ContextualChat context="domains" />
    </DashboardLayout>
  )
}
