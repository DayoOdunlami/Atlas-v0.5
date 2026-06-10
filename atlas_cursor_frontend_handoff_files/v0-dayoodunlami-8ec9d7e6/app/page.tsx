import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ChatInterface } from "@/components/chat/chat-interface"

export default function Home() {
  return (
    <DashboardLayout>
      <ChatInterface />
    </DashboardLayout>
  )
}
