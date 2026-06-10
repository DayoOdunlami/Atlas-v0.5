"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { InsightFilters } from "@/components/insights/insight-explorer"

interface TrendAnalysisChartProps {
  filters: InsightFilters
}

export function TrendAnalysisChart({ filters }: TrendAnalysisChartProps) {
  const data = [
    { month: "Jan", documents: 45, projects: 12 },
    { month: "Feb", documents: 52, projects: 15 },
    { month: "Mar", documents: 48, projects: 18 },
    { month: "Apr", documents: 61, projects: 22 },
    { month: "May", documents: 55, projects: 19 },
    { month: "Jun", documents: 67, projects: 25 },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity Trends</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="documents" stroke="#006E51" strokeWidth={2} name="Documents" />
            <Line type="monotone" dataKey="projects" stroke="#CCE2DC" strokeWidth={2} name="Projects" />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
