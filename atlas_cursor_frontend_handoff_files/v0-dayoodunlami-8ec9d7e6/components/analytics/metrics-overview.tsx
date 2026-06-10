"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, MessageSquare, FileText, Users, Star } from "lucide-react"

interface MetricsOverviewProps {
  timeRange: string
  analytics?: any
}

export function MetricsOverview({ timeRange, analytics }: MetricsOverviewProps) {
  // Use provided analytics data or show zeros if no data available
  const metricsData = analytics || {
    totalQueries: 0,
    totalDocuments: 0,
    activeUsers: 0,
    averageRating: 0,
    responseTime: 0,
    systemUptime: 0
  }

  const metrics = [
    {
      title: "AI Queries",
      value: metricsData.totalQueries?.toLocaleString() || "0",
      change: analytics ? "+23%" : "N/A",
      trend: analytics ? "up" : "none",
      icon: MessageSquare,
      description: "Total AI queries processed",
    },
    {
      title: "Documents Processed", 
      value: metricsData.totalDocuments?.toLocaleString() || "0",
      change: analytics ? "+12%" : "N/A",
      trend: analytics ? "up" : "none",
      icon: FileText,
      description: "Documents uploaded and indexed",
    },
    {
      title: "Active Users",
      value: metricsData.activeUsers?.toLocaleString() || "0",
      change: analytics ? "+8%" : "N/A",
      trend: analytics ? "up" : "none",
      icon: Users,
      description: "Unique users this period",
    },
    {
      title: "Avg Response Rating",
      value: metricsData.averageRating ? metricsData.averageRating.toFixed(1) : "0.0",
      change: analytics ? "+0.3" : "N/A",
      trend: analytics ? "up" : "none",
      icon: Star,
      description: "Average user satisfaction rating",
    },
    {
      title: "Response Time",
      value: metricsData.responseTime ? `${metricsData.responseTime.toFixed(1)}s` : "0.0s",
      change: analytics ? "-0.3s" : "N/A",
      trend: analytics ? "up" : "none",
      icon: TrendingUp,
      description: "Average AI response time",
    },
    {
      title: "System Uptime",
      value: metricsData.systemUptime ? `${metricsData.systemUptime.toFixed(1)}%` : "0.0%",
      change: analytics ? "stable" : "N/A",
      trend: analytics ? "stable" : "none",
      icon: TrendingUp,
      description: "System availability",
    },
  ]

  const getTrendIcon = (trend: string) => {
    if (trend === "up") return <TrendingUp className="h-4 w-4 text-green-500" />
    if (trend === "down") return <TrendingDown className="h-4 w-4 text-red-500" />
    return <div className="h-4 w-4" />
  }

  const getTrendColor = (trend: string) => {
    if (trend === "up") return "text-green-600"
    if (trend === "down") return "text-red-600"
    return "text-muted-foreground"
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
            <metric.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            <div className="flex items-center gap-1 text-xs">
              {getTrendIcon(metric.trend)}
              <span className={getTrendColor(metric.trend)}>{metric.change}</span>
              <span className="text-muted-foreground">from last period</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
