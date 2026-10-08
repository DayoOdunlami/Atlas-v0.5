"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts"

interface QueryAnalyticsProps {
  timeRange: string
}

export function QueryAnalytics({ timeRange }: QueryAnalyticsProps) {
  // Mock data for queries by sector
  const sectorData = [
    { sector: "Rail", queries: 1247, avgRating: 4.3 },
    { sector: "Maritime", queries: 456, avgRating: 4.1 },
    { sector: "Highways", queries: 789, avgRating: 4.2 },
    { sector: "General", queries: 355, avgRating: 4.0 },
  ]

  // Mock data for queries over time
  const timeData = [
    { date: "Mon", queries: 245, responseTime: 1.1 },
    { date: "Tue", queries: 312, responseTime: 1.3 },
    { date: "Wed", queries: 289, responseTime: 1.2 },
    { date: "Thu", queries: 367, responseTime: 1.4 },
    { date: "Fri", queries: 423, responseTime: 1.1 },
    { date: "Sat", queries: 198, responseTime: 0.9 },
    { date: "Sun", queries: 156, responseTime: 0.8 },
  ]

  // Mock data for use case distribution
  const useCaseData = [
    { useCase: "Quick Playbook", count: 567, percentage: 35 },
    { useCase: "Lessons Learned", count: 423, percentage: 26 },
    { useCase: "Project Review", count: 312, percentage: 19 },
    { useCase: "TRL Mapping", count: 189, percentage: 12 },
    { useCase: "Project Similarity", count: 134, percentage: 8 },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Query Volume by Sector</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={sectorData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="sector" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="queries" fill="#006E51" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Query Trends Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={timeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="queries" stroke="#006E51" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Use Case Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {useCaseData.map((item) => (
              <div key={item.useCase} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium">{item.useCase}</div>
                  <div className="text-xs text-muted-foreground">{item.count} queries</div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-muted rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
                  </div>
                  <div className="text-xs text-muted-foreground w-8">{item.percentage}%</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
