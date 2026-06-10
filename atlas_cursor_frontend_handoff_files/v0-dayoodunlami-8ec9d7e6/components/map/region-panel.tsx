"use client"

import { X, MapPin, Briefcase, Route } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { RailwayRegion } from "@/components/map/railway-map"

interface RegionPanelProps {
  region: RailwayRegion
  onClose: () => void
}

export function RegionPanel({ region, onClose }: RegionPanelProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className="w-4 h-4 rounded" style={{ backgroundColor: region.color }} />
            {region.name}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{region.description}</p>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{region.stations}</div>
              <div className="text-xs text-muted-foreground">Stations</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{region.projects}</div>
              <div className="text-xs text-muted-foreground">Projects</div>
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Route className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Routes</span>
          </div>
          <div className="space-y-1">
            {region.routes.map((route, index) => (
              <Badge key={index} variant="outline" className="text-xs">
                {route}
              </Badge>
            ))}
          </div>
        </div>

        <div className="pt-2 border-t">
          <Button className="w-full" size="sm">
            View Region Documents
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
