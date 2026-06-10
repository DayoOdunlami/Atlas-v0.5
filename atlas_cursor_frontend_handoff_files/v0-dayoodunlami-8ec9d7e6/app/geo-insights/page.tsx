"use client"

import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { MergedGeoInsightsApiClean } from "@/components/geo-insights/merged-geo-insights-api-clean"
import { ContextualChat } from "@/components/chat/contextual-chat"

export default function GeoInsightsPage() {
  return (
    <DashboardLayout>
      <MergedGeoInsightsApiClean />
      <ContextualChat context="insights" />
    </DashboardLayout>
  )
} 