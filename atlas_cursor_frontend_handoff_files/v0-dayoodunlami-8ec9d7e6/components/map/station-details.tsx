"use client"

import { X, MapPin, FileText, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import type { Station } from "@/components/map/railway-map"

interface StationDetailsProps {
  station: Station
  onClose: () => void
}

export function StationDetails({ station, onClose }: StationDetailsProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
        return "bg-green-100 text-green-800"
      case "construction":
        return "bg-yellow-100 text-yellow-800"
      case "planned":
        return "bg-blue-100 text-blue-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getProjectStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-100 text-green-800"
      case "completed":
        return "bg-blue-100 text-blue-800"
      case "planned":
        return "bg-yellow-100 text-yellow-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            {station.name}
          </CardTitle>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Badge variant="outline">{station.code}</Badge>
          <Badge className={getStatusColor(station.status)}>{station.status}</Badge>
          <Badge variant="secondary">{station.type}</Badge>
        </div>

        <div className="text-sm text-muted-foreground">
          <p>
            Coordinates: {station.coordinates[0].toFixed(4)}, {station.coordinates[1].toFixed(4)}
          </p>
        </div>

        {station.projects.length > 0 && (
          <div className="space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Active Projects ({station.projects.length})
            </h4>
            {station.projects.map((project) => (
              <div key={project.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <h5 className="font-medium text-sm">{project.title}</h5>
                  <Badge className={getProjectStatusColor(project.status)}>{project.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{project.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Budget:</span>
                    <span className="ml-1 font-medium">{project.budget}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Timeline:</span>
                    <span className="ml-1 font-medium">{project.timeline}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">{project.documents} documents</span>
                  <Button variant="outline" size="sm">
                    <ExternalLink className="mr-1 h-3 w-3" />
                    View Details
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="pt-2 border-t">
          <Button className="w-full" size="sm">
            View Station Documents
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
