"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts"
import type { InsightFilters } from "@/components/insights/insight-explorer"

interface RegionalActivityChartProps {
  filters: InsightFilters
}

export function RegionalActivityChart({ filters }: RegionalActivityChartProps) {
  const data = [
    { name: "London & SE", value: 35, color: "#006E51" },
    { name: "North West", value: 25, color: "#CCE2DC" },
    { name: "Scotland", value: 20, color: "#2E2D2B" },
    { name: "Other", value: 20, color: "#E8F4F1" },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Regional Activity</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              outerRadius={60}
              fill="#8884d8"
              dataKey="value"
              label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
