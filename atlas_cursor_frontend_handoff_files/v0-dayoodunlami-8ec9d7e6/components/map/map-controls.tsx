"use client"

import { Layers } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"

interface MapControlsProps {
  showLayers: {
    regions: boolean
    stations: boolean
    projects: boolean
    railLines: boolean
  }
  onLayersChange: (layers: {
    regions: boolean
    stations: boolean
    projects: boolean
    railLines: boolean
  }) => void
}

export function MapControls({ showLayers, onLayersChange }: MapControlsProps) {
  const toggleLayer = (layer: keyof typeof showLayers) => {
    onLayersChange({
      ...showLayers,
      [layer]: !showLayers[layer],
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Map Layers
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Label htmlFor="regions" className="text-sm">
            Railway Regions
          </Label>
          <Switch id="regions" checked={showLayers.regions} onCheckedChange={() => toggleLayer("regions")} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="stations" className="text-sm">
            Stations
          </Label>
          <Switch id="stations" checked={showLayers.stations} onCheckedChange={() => toggleLayer("stations")} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="projects" className="text-sm">
            Project Markers
          </Label>
          <Switch id="projects" checked={showLayers.projects} onCheckedChange={() => toggleLayer("projects")} />
        </div>
        <div className="flex items-center justify-between">
          <Label htmlFor="railLines" className="text-sm">
            Railway Lines
          </Label>
          <Switch id="railLines" checked={showLayers.railLines} onCheckedChange={() => toggleLayer("railLines")} />
        </div>
      </CardContent>
    </Card>
  )
}
