import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { DocumentUpload } from "@/components/documents/document-upload"
import { ContextualChat } from "@/components/chat/contextual-chat"

export default function UploadPage() {
  return (
    <DashboardLayout>
      <DocumentUpload />
      <ContextualChat context="upload" />
    </DashboardLayout>
  )
}
