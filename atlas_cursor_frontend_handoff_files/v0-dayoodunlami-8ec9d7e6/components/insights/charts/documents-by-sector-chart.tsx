"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import type { InsightFilters } from "@/components/insights/insight-explorer"

interface DocumentsBySectorChartProps {
  filters: InsightFilters
}

export function DocumentsBySecorChart({ filters }: DocumentsBySectorChartProps) {
  const data = [
    { sector: "Rail", documents: 120, projects: 45 },
    { sector: "Highways", documents: 82, projects: 32 },
    { sector: "General", documents: 67, projects: 28 },
    { sector: "Maritime", documents: 45, projects: 18 },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents by Sector</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="sector" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="documents" fill="#006E51" name="Documents" />
            <Bar dataKey="projects" fill="#CCE2DC" name="Projects" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
