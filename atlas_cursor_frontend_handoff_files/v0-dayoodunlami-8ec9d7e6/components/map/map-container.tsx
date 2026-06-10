"use client"

import { useEffect, useRef, useState } from "react"
import type { RailwayRegion, Station } from "@/components/map/railway-map"

interface MapContainerProps {
  regions: RailwayRegion[]
  stations: Station[]
  selectedRegion: string | null
  selectedStation: Station | null
  onRegionSelect: (regionId: string | null) => void
  onStationSelect: (station: Station | null) => void
  showLayers: {
    regions: boolean
    stations: boolean
    projects: boolean
    railLines: boolean
  }
}

export function MapContainer({
  regions,
  stations,
  selectedRegion,
  selectedStation,
  onRegionSelect,
  onStationSelect,
  showLayers,
}: MapContainerProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const [mapInstance, setMapInstance] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Simulate map loading
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000)

    return () => clearTimeout(timer)
  }, [])

  // Mock map implementation - in real app, this would use Leaflet or MapBox
  const handleRegionClick = (regionId: string) => {
    onRegionSelect(regionId === selectedRegion ? null : regionId)
  }

  const handleStationClick = (station: Station) => {
    onStationSelect(station.id === selectedStation?.id ? null : station)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full bg-muted/30">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading railway map...</p>
        </div>
      </div>
    )
  }

  return (
    <div ref={mapRef} className="relative h-full w-full bg-gradient-to-br from-blue-50 to-green-50 overflow-hidden">
      {/* Map Background */}
      <div className="absolute inset-0">
        <img
          src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/image-E7dq4340TkgCCloHoDxEj5niS5gjxm.png"
          alt="UK Railway Network Map"
          className="w-full h-full object-cover opacity-80"
        />
      </div>

      {/* Interactive Overlay */}
      <div className="absolute inset-0">
        <svg viewBox="0 0 800 600" className="w-full h-full">
          {/* Railway Regions */}
          {showLayers.regions &&
            regions.map((region, index) => (
              <g key={region.id}>
                {/* Mock region boundaries */}
                <path
                  d={`M ${100 + index * 120} 50 L ${200 + index * 120} 50 L ${200 + index * 120} 150 L ${100 + index * 120} 150 Z`}
                  fill={region.color}
                  fillOpacity={selectedRegion === region.id ? 0.6 : 0.3}
                  stroke={region.color}
                  strokeWidth="2"
                  className="cursor-pointer transition-all hover:fill-opacity-50"
                  onClick={() => handleRegionClick(region.id)}
                />
                <text
                  x={150 + index * 120}
                  y={100}
                  textAnchor="middle"
                  className="fill-white font-semibold text-sm pointer-events-none"
                >
                  {region.name.split(" ")[0]}
                </text>
              </g>
            ))}

          {/* Railway Stations */}
          {showLayers.stations &&
            stations.map((station, index) => {
              const x = 150 + (index % 5) * 120
              const y = 200 + Math.floor(index / 5) * 80
              const isSelected = selectedStation?.id === station.id

              return (
                <g key={station.id}>
                  <circle
                    cx={x}
                    cy={y}
                    r={station.type === "major" ? 8 : station.type === "interchange" ? 6 : 4}
                    fill={station.type === "major" ? "#2563eb" : station.type === "interchange" ? "#16a34a" : "#6b7280"}
                    stroke={isSelected ? "#f59e0b" : "white"}
                    strokeWidth={isSelected ? 3 : 2}
                    className="cursor-pointer transition-all hover:r-6"
                    onClick={() => handleStationClick(station)}
                  />
                  <text
                    x={x}
                    y={y + 20}
                    textAnchor="middle"
                    className="fill-gray-700 text-xs font-medium pointer-events-none"
                  >
                    {station.name.split(" ")[0]}
                  </text>
                </g>
              )
            })}

          {/* Railway Lines */}
          {showLayers.railLines && (
            <g>
              {/* Mock railway lines connecting stations */}
              <path
                d="M 150 200 Q 270 180 390 200 Q 510 220 630 200"
                stroke="#374151"
                strokeWidth="3"
                fill="none"
                strokeDasharray="5,5"
                opacity="0.7"
              />
              <path
                d="M 150 280 Q 270 260 390 280 Q 510 300 630 280"
                stroke="#374151"
                strokeWidth="3"
                fill="none"
                strokeDasharray="5,5"
                opacity="0.7"
              />
            </g>
          )}

          {/* Project Markers */}
          {showLayers.projects &&
            stations
              .filter((s) => s.projects.length > 0)
              .map((station, index) => {
                const x = 150 + (index % 5) * 120
                const y = 200 + Math.floor(index / 5) * 80

                return (
                  <g key={`project-${station.id}`}>
                    <circle
                      cx={x + 12}
                      cy={y - 12}
                      r="6"
                      fill="#f59e0b"
                      stroke="white"
                      strokeWidth="2"
                      className="animate-pulse"
                    />
                    <text
                      x={x + 12}
                      y={y - 8}
                      textAnchor="middle"
                      className="fill-white text-xs font-bold pointer-events-none"
                    >
                      {station.projects.length}
                    </text>
                  </g>
                )
              })}
        </svg>
      </div>

      {/* Map Controls */}
      <div className="absolute top-4 right-4 flex flex-col gap-2">
        <button className="bg-white p-2 rounded shadow-md hover:bg-gray-50">
          <span className="text-lg">+</span>
        </button>
        <button className="bg-white p-2 rounded shadow-md hover:bg-gray-50">
          <span className="text-lg">−</span>
        </button>
      </div>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 p-3 rounded-lg shadow-md">
        <h4 className="font-semibold text-sm mb-2">Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-600"></div>
            <span>Major Station</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-600"></div>
            <span>Interchange</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
            <span>Active Project</span>
          </div>
        </div>
      </div>
    </div>
  )
}
