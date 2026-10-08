"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { InsightFilters } from "@/components/insights/insight-explorer"

interface TagCloudWidgetProps {
  filters: InsightFilters
}

export function TagCloudWidget({ filters }: TagCloudWidgetProps) {
  const tags = [
    { name: "AI", count: 45, size: "large" },
    { name: "Decarbonization", count: 38, size: "large" },
    { name: "Digital", count: 32, size: "medium" },
    { name: "Safety", count: 28, size: "medium" },
    { name: "Innovation", count: 25, size: "medium" },
    { name: "Electrification", count: 22, size: "small" },
    { name: "Automation", count: 18, size: "small" },
    { name: "IoT", count: 15, size: "small" },
    { name: "Analytics", count: 12, size: "small" },
    { name: "Sustainability", count: 10, size: "small" },
  ]

  const getTagSize = (size: string) => {
    switch (size) {
      case "large":
        return "text-lg"
      case "medium":
        return "text-base"
      case "small":
        return "text-sm"
      default:
        return "text-sm"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Popular Tags</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge
              key={tag.name}
              variant="outline"
              className={`${getTagSize(tag.size)} cursor-pointer hover:bg-primary hover:text-primary-foreground transition-colors`}
            >
              {tag.name} ({tag.count})
            </Badge>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
