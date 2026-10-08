import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { DocumentManagement } from "@/components/documents/document-management"
import { ContextualChat } from "@/components/chat/contextual-chat"

export default function DocumentsPage() {
  return (
    <DashboardLayout>
      <DocumentManagement />
      <ContextualChat context="documents" />
    </DashboardLayout>
  )
}
