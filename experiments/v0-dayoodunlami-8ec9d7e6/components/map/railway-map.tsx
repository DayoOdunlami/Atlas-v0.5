"use client"

import { useState } from "react"
import { useRegionalData } from "@/hooks/use-regional-data"
import { Search, Download, Info, Layers } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

import { RegionPanel } from "@/components/map/region-panel"
import { StationDetails } from "@/components/map/station-details"
import { MapControls } from "@/components/map/map-controls"
import { RailwayMapRealBoundaries } from "./railway-map-real-boundaries"

export interface RailwayRegion {
  id: string
  name: string
  color: string
  routes: string[]
  description: string
  stations: number
  projects: number
}

export interface Station {
  id: string
  name: string
  code: string
  region: string
  coordinates: [number, number]
  type: "major" | "interchange" | "local"
  projects: Project[]
  status: "operational" | "construction" | "planned"
}

export interface Project {
  id: string
  title: string
  description: string
  status: "active" | "completed" | "planned"
  budget: string
  timeline: string
  documents: number
}

export function RailwayMap() {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const [selectedStation, setSelectedStation] = useState<Station | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [filterRegion, setFilterRegion] = useState<string>("all")

  const [showLayers, setShowLayers] = useState({
    regions: true,
    stations: true,
    projects: true,
    railLines: true,
  })

  // Use live regional data from the backend API
  const { regions, loading: regionsLoading, error: regionsError } = useRegionalData()

  const mockStations: Station[] = [
    {
      id: "london-kings-cross",
      name: "London King's Cross",
      code: "KGX",
      region: "eastern",
      coordinates: [51.5308, -0.1238],
      type: "major",
      projects: [
        {
          id: "proj-1",
          title: "Platform Extension Project",
          description: "Extending platforms 9-11 to accommodate longer trains",
          status: "active",
          budget: "£45M",
          timeline: "2024-2026",
          documents: 23,
        },
      ],
      status: "operational",
    },
    {
      id: "manchester-piccadilly",
      name: "Manchester Piccadilly",
      code: "MAN",
      region: "north-west-central",
      coordinates: [53.4773, -2.2309],
      type: "major",
      projects: [
        {
          id: "proj-2",
          title: "HS2 Integration Works",
          description: "Preparing station for High Speed 2 connectivity",
          status: "planned",
          budget: "£120M",
          timeline: "2025-2028",
          documents: 45,
        },
      ],
      status: "operational",
    },
    {
      id: "edinburgh-waverley",
      name: "Edinburgh Waverley",
      code: "EDB",
      region: "scotland",
      coordinates: [55.952, -3.1883],
      type: "major",
      projects: [
        {
          id: "proj-3",
          title: "Station Modernization",
          description: "Upgrading passenger facilities and accessibility",
          status: "active",
          budget: "£32M",
          timeline: "2024-2025",
          documents: 18,
        },
      ],
      status: "operational",
    },
  ]

  const filteredStations = mockStations.filter((station) => {
    const matchesSearch =
      station.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      station.code.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesRegion = filterRegion === "all" || station.region === filterRegion
    return matchesSearch && matchesRegion
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Railway Map Explorer</h1>
          <p className="text-muted-foreground">Interactive UK railway network with project information</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Data
          </Button>
          <Button variant="outline" onClick={() => setShowLayers({ ...showLayers, regions: !showLayers.regions })}>
            <Layers className="mr-2 h-4 w-4" />
            Layers
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Map Controls */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Search & Filter
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Input
                  placeholder="Search stations..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Select value={filterRegion} onValueChange={setFilterRegion}>
                  <SelectTrigger>
                    <SelectValue placeholder="Filter by region" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Regions</SelectItem>
                    {regions.map((region) => (
                      <SelectItem key={region.id} value={region.id}>
                        {region.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Railway Regions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {regions.map((region) => (
                <div
                  key={region.id}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedRegion === region.id ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => setSelectedRegion(selectedRegion === region.id ? null : region.id)}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: region.color }} />
                    <span className="font-medium text-sm">{region.name}</span>
                  </div>
                  <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                    <span>{region.stations} stations</span>
                    <span>{region.projects} projects</span>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <MapControls showLayers={showLayers} onLayersChange={setShowLayers} />
        </div>

        {/* Main Map */}
        <div className="lg:col-span-2">
          <div className="h-[800px]">
            <RailwayMapRealBoundaries />
          </div>
        </div>

        {/* Side Panel */}
        <div className="space-y-4">
          {selectedRegion && (
            <RegionPanel
              region={regions.find((r) => r.id === selectedRegion)!}
              onClose={() => setSelectedRegion(null)}
            />
          )}

          {selectedStation && <StationDetails station={selectedStation} onClose={() => setSelectedStation(null)} />}

          {!selectedRegion && !selectedStation && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Map Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  <p>Click on regions or stations to view detailed information and associated projects.</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span>Major Stations</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span>Interchange Stations</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full bg-gray-500" />
                    <span>Local Stations</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
