"use client"

import { TrendingUp, FileText, Users, BarChart3 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { InsightFilters } from "@/components/insights/insight-explorer"

interface MetricsOverviewProps {
  filters: InsightFilters
}

export function MetricsOverview({ filters }: MetricsOverviewProps) {
  // Mock metrics that would be filtered based on current filters
  const metrics = [
    {
      title: "Total Documents",
      value: "1,247",
      change: "+12%",
      trend: "up",
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-100",
    },
    {
      title: "Active Projects",
      value: "89",
      change: "+8%",
      trend: "up",
      icon: BarChart3,
      color: "text-green-600",
      bgColor: "bg-green-100",
    },
    {
      title: "Regions Covered",
      value: "8",
      change: "stable",
      trend: "stable",
      icon: TrendingUp,
      color: "text-orange-600",
      bgColor: "bg-orange-100",
    },
    {
      title: "Contributors",
      value: "156",
      change: "+23%",
      trend: "up",
      icon: Users,
      color: "text-purple-600",
      bgColor: "bg-purple-100",
    },
  ]

  const getTrendColor = (trend: string) => {
    if (trend === "up") return "text-green-600"
    if (trend === "down") return "text-red-600"
    return "text-muted-foreground"
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
            <div className={`rounded-full p-2 ${metric.bgColor}`}>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            <div className="flex items-center gap-1 text-xs">
              <span className={getTrendColor(metric.trend)}>{metric.change}</span>
              <span className="text-muted-foreground">from last period</span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
