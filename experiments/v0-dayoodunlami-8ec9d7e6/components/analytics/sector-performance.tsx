"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Clock, Star } from "lucide-react"

interface SectorPerformanceProps {
  timeRange: string
}

export function SectorPerformance({ timeRange }: SectorPerformanceProps) {
  const sectorMetrics = [
    {
      sector: "Rail",
      queries: 1247,
      avgRating: 4.3,
      avgResponseTime: 1.1,
      topUseCase: "Quick Playbook",
      trend: "up",
      change: "+15%",
      documents: 120,
    },
    {
      sector: "Maritime",
      queries: 456,
      avgRating: 4.1,
      avgResponseTime: 1.3,
      topUseCase: "Lessons Learned",
      trend: "up",
      change: "+8%",
      documents: 45,
    },
    {
      sector: "Highways",
      queries: 789,
      avgRating: 4.2,
      avgResponseTime: 1.2,
      topUseCase: "Project Review",
      trend: "down",
      change: "-3%",
      documents: 82,
    },
    {
      sector: "General",
      queries: 355,
      avgRating: 4.0,
      avgResponseTime: 1.4,
      topUseCase: "Quick Playbook",
      trend: "up",
      change: "+12%",
      documents: 67,
    },
  ]

  const getTrendIcon = (trend: string) => {
    return trend === "up" ? (
      <TrendingUp className="h-4 w-4 text-green-500" />
    ) : (
      <TrendingDown className="h-4 w-4 text-red-500" />
    )
  }

  const getTrendColor = (trend: string) => {
    return trend === "up" ? "text-green-600" : "text-red-600"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sector Performance</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sectorMetrics.map((sector) => (
          <div key={sector.sector} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">{sector.sector}</h4>
              <div className="flex items-center gap-1">
                {getTrendIcon(sector.trend)}
                <span className={`text-sm ${getTrendColor(sector.trend)}`}>{sector.change}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Queries</div>
                <div className="font-medium">{sector.queries.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Documents</div>
                <div className="font-medium">{sector.documents}</div>
              </div>
              <div className="flex items-center gap-1">
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                <span className="font-medium">{sector.avgRating}</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="font-medium">{sector.avgResponseTime}s</span>
              </div>
            </div>

            <div>
              <div className="text-xs text-muted-foreground">Top Use Case</div>
              <Badge variant="outline" className="text-xs">
                {sector.topUseCase}
              </Badge>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
