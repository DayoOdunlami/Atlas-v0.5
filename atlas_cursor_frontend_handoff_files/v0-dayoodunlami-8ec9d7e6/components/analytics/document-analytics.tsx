"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

interface DocumentAnalyticsProps {
  timeRange: string
}

export function DocumentAnalytics({ timeRange }: DocumentAnalyticsProps) {
  // Mock data for document distribution by sector
  const sectorDistribution = [
    { name: "Rail", value: 120, color: "#006E51" },
    { name: "Maritime", value: 45, color: "#CCE2DC" },
    { name: "Highways", value: 82, color: "#2E2D2B" },
    { name: "General", value: 67, color: "#ccc" },
  ]

  // Mock data for document processing over time
  const processingData = [
    { date: "Week 1", uploaded: 23, processed: 21, errors: 2 },
    { date: "Week 2", uploaded: 34, processed: 32, errors: 2 },
    { date: "Week 3", uploaded: 28, processed: 26, errors: 2 },
    { date: "Week 4", uploaded: 41, processed: 39, errors: 2 },
  ]

  // Mock data for document types
  const documentTypes = [
    { type: "PDF", count: 156, percentage: 63 },
    { type: "DOCX", count: 67, percentage: 27 },
    { type: "TXT", count: 15, percentage: 6 },
    { type: "CSV", count: 9, percentage: 4 },
  ]

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Documents by Sector</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={sectorDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name} ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {sectorDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document Processing Pipeline</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={processingData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="uploaded" fill="#006E51" name="Uploaded" />
              <Bar dataKey="processed" fill="#CCE2DC" name="Processed" />
              <Bar dataKey="errors" fill="#ff6b6b" name="Errors" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Document Types</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {documentTypes.map((item) => (
              <div key={item.type} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium">{item.type}</div>
                  <div className="text-xs text-muted-foreground">{item.count} files</div>
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
