import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { RailwayMap } from "@/components/map/railway-map"
import { ContextualChat } from "@/components/chat/contextual-chat"

export default function MapPage() {
  return (
    <DashboardLayout>
      <RailwayMap />
      <ContextualChat context="map" />
    </DashboardLayout>
  )
}
