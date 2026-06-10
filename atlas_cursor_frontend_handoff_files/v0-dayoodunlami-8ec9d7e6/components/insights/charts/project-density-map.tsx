"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { InsightFilters } from "@/components/insights/insight-explorer"

interface ProjectDensityMapProps {
  filters: InsightFilters
}

export function ProjectDensityMap({ filters }: ProjectDensityMapProps) {
  const regions = [
    { name: "London & South East", projects: 45, density: "high", color: "#006E51" },
    { name: "North West & Central", projects: 32, density: "medium", color: "#CCE2DC" },
    { name: "Scotland", projects: 28, density: "medium", color: "#CCE2DC" },
    { name: "Wales & Western", projects: 22, density: "low", color: "#E8F4F1" },
    { name: "Eastern", projects: 18, density: "low", color: "#E8F4F1" },
    { name: "Southern", projects: 35, density: "medium", color: "#CCE2DC" },
  ]

  const getDensityBadge = (density: string) => {
    switch (density) {
      case "high":
        return <Badge className="bg-green-100 text-green-800">High</Badge>
      case "medium":
        return <Badge className="bg-yellow-100 text-yellow-800">Medium</Badge>
      case "low":
        return <Badge className="bg-gray-100 text-gray-800">Low</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Project Density by Region</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Mock Map Visualization */}
          <div className="relative h-64 bg-gradient-to-br from-blue-50 to-green-50 rounded-lg overflow-hidden">
            <svg viewBox="0 0 400 300" className="w-full h-full">
              {regions.map((region, index) => (
                <g key={region.name}>
                  <rect
                    x={50 + (index % 3) * 100}
                    y={50 + Math.floor(index / 3) * 80}
                    width={80}
                    height={60}
                    fill={region.color}
                    stroke="#fff"
                    strokeWidth="2"
                    className="cursor-pointer hover:opacity-80"
                  />
                  <text
                    x={90 + (index % 3) * 100}
                    y={85 + Math.floor(index / 3) * 80}
                    textAnchor="middle"
                    className="fill-gray-700 text-xs font-medium"
                  >
                    {region.projects}
                  </text>
                </g>
              ))}
            </svg>

            {/* Legend */}
            <div className="absolute bottom-2 left-2 bg-white/90 p-2 rounded text-xs">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 bg-[#006E51] rounded"></div>
                <span>High (30+)</span>
              </div>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 bg-[#CCE2DC] rounded"></div>
                <span>Medium (20-29)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-[#E8F4F1] rounded"></div>
                <span>Low (&lt;20)</span>
              </div>
            </div>
          </div>

          {/* Region List */}
          <div className="space-y-2">
            {regions.map((region) => (
              <div key={region.name} className="flex items-center justify-between p-2 border rounded">
                <span className="text-sm font-medium">{region.name}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{region.projects} projects</span>
                  {getDensityBadge(region.density)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
