"use client"

import { useState, useEffect } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Download, RefreshCw } from "lucide-react"
import { MetricsOverview } from "@/components/analytics/metrics-overview"
import { QueryAnalytics } from "@/components/analytics/query-analytics"
import { DocumentAnalytics } from "@/components/analytics/document-analytics"
import { FeedbackAnalytics } from "@/components/analytics/feedback-analytics"
import { SectorPerformance } from "@/components/analytics/sector-performance"
import { SystemHealth } from "@/components/analytics/system-health"
import { RecentActivity } from "@/components/analytics/recent-activity"
import apiClient from "@/lib/api-client"
import { useDemoMode, DEMO_DATA } from "@/lib/demo-mode"

export function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState("7d")
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<any>(null)
  const { useSampleData } = useDemoMode()

  useEffect(() => {
    loadAnalytics()
  }, [timeRange, useSampleData])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      if (useSampleData) {
        // Use demo data when demo mode is enabled
        setTimeout(() => {
          setAnalytics({
            system: DEMO_DATA.analytics,
            feedback: {
              total_feedback: 156,
              average_rating: 4.2,
              recent_feedback: []
            },
            activity: DEMO_DATA.recentActivity,
            sectors: DEMO_DATA.sectorMetrics
          })
          setLoading(false)
        }, 500) // Simulate loading delay
      } else {
        // Use real API data or set null when no backend is available
        try {
          const [systemAnalytics, feedbackAnalytics] = await Promise.all([
            apiClient.admin.getAnalytics(),
            apiClient.admin.getFeedback(),
          ])

          setAnalytics({
            system: systemAnalytics,
            feedback: feedbackAnalytics,
          })
        } catch (apiError) {
          console.warn('API not available, showing empty state:', apiError)
          // Set analytics to null so components show zeros
          setAnalytics(null)
        }
        setLoading(false)
      }
    } catch (error) {
      console.error("Failed to load analytics:", error)
      // Set analytics to null for empty state
      setAnalytics(null)
      setLoading(false)
    }
  }

  const exportData = () => {
    // Implement analytics export
    console.log("Exporting analytics data...")
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading analytics...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Demo Mode Indicator */}
      {useSampleData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            📊 <strong>Demo Mode:</strong> Displaying sample analytics data
          </p>
        </div>
      )}
      
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground">System performance and user insights for Strategy AI</p>
        </div>
        <div className="flex gap-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadAnalytics}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          <Button variant="outline" onClick={exportData}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>

      <MetricsOverview timeRange={timeRange} analytics={analytics?.system} />

      <div className="grid gap-6 lg:grid-cols-2">
        <QueryAnalytics timeRange={timeRange} sectors={analytics?.sectors} />
        <DocumentAnalytics timeRange={timeRange} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <FeedbackAnalytics analytics={analytics?.feedback} />
        <SectorPerformance timeRange={timeRange} sectors={analytics?.sectors} />
        <SystemHealth />
      </div>

      <RecentActivity activity={analytics?.activity} />
    </div>
  )
}
