"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, ZoomIn, ZoomOut, RotateCcw } from "lucide-react"

// Railway regions data matching your specification
const RAILWAY_REGIONS = [
  {
    region_id: "london_north_eastern",
    name: "London North Eastern",
    code: "LNE", 
    description: "Covers East Coast Main Line, West Highland Line, and Pennine routes",
    color: "#1f77b4",
    major_cities: ["London", "Edinburgh", "Glasgow", "Newcastle", "Leeds", "York"]
  },
  {
    region_id: "london_north_western", 
    name: "London North Western",
    code: "LNW",
    description: "West Coast Main Line and cross‑country routes",
    color: "#ff7f0e",
    major_cities: ["London", "Birmingham", "Manchester", "Liverpool", "Preston", "Carlisle"]
  },
  {
    region_id: "western",
    name: "Western", 
    code: "WR",
    description: "Great Western Main Line and Welsh routes",
    color: "#2ca02c",
    major_cities: ["London", "Bristol", "Cardiff", "Swansea", "Plymouth", "Exeter"]
  },
  {
    region_id: "southern",
    name: "Southern",
    code: "SR", 
    description: "South Coast routes and London commuter lines",
    color: "#d62728",
    major_cities: ["London", "Brighton", "Portsmouth", "Southampton", "Dover", "Hastings"]
  },
  {
    region_id: "eastern",
    name: "Eastern",
    code: "ER",
    description: "East Anglia and East Coast routes", 
    color: "#9467bd",
    major_cities: ["London", "Cambridge", "Norwich", "Ipswich", "Peterborough", "Kings Lynn"]
  },
  {
    region_id: "scotland",
    name: "Scotland",
    code: "SC",
    description: "Scottish railway network including Highland lines",
    color: "#8c564b", 
    major_cities: ["Glasgow", "Edinburgh", "Aberdeen", "Dundee", "Inverness", "Stirling"]
  }
]

interface RegionDetails {
  region: typeof RAILWAY_REGIONS[0]
  stats: {
    stations: number
    projects: number
    documents: number
  }
}

export function RailwayMapV2() {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const [selectedRegion, setSelectedRegion] = useState<RegionDetails | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!mapContainer.current) return

    const loadMapLibre = async () => {
      try {
        // Load CSS
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'
        document.head.appendChild(link)

        // Load JS
        const script = document.createElement('script')
        script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'
        
        script.onload = () => {
          initializeMap()
        }
        
        script.onerror = () => {
          setError('Failed to load mapping library')
          setIsLoading(false)
        }
        
        document.head.appendChild(script)
      } catch (err) {
        setError('Failed to initialize map')
        setIsLoading(false)
      }
    }

    const initializeMap = () => {
      try {
        // @ts-ignore - MapLibre loaded dynamically
        const mapInstance = new maplibregl.Map({
          container: mapContainer.current!,
          style: {
            version: 8,
            sources: {
              'osm': {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '© OpenStreetMap contributors'
              }
            },
            layers: [{
              id: 'osm-tiles',
              type: 'raster',
              source: 'osm'
            }]
          },
          center: [-2.5, 54.0], // Center on UK
          zoom: 5.5,
          minZoom: 4,
          maxZoom: 12,
          maxBounds: [[-11, 49.5], [2, 61]]
        })

        // @ts-ignore
        mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }))

        mapInstance.on('load', () => {
          loadRailwayRegions(mapInstance)
        })

        map.current = mapInstance
      } catch (err) {
        setError('Failed to create map')
        setIsLoading(false)
      }
    }

    const loadRailwayRegions = async (mapInstance: any) => {
      try {
        // Create simplified railway regions GeoJSON
        const railwayGeoJSON = {
          type: 'FeatureCollection',
          features: RAILWAY_REGIONS.map(region => ({
            type: 'Feature',
            properties: {
              region_id: region.region_id,
              name: region.name,
              code: region.code,
              description: region.description,
              color: region.color,
              major_cities: region.major_cities
            },
            geometry: {
              type: 'Polygon',
              coordinates: [generateRegionBounds(region.region_id)]
            }
          }))
        }

        // Add railway regions source
        mapInstance.addSource('railway-regions', {
          type: 'geojson',
          data: railwayGeoJSON
        })

        // Add railway regions fill layer
        mapInstance.addLayer({
          id: 'railway-regions-fill',
          type: 'fill',
          source: 'railway-regions',
          paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 0.4
          }
        })

        // Add railway regions outline
        mapInstance.addLayer({
          id: 'railway-regions-outline', 
          type: 'line',
          source: 'railway-regions',
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 2,
            'line-opacity': 0.8
          }
        })

        // Add click handler
        mapInstance.on('click', 'railway-regions-fill', (e: any) => {
          if (e.features && e.features[0]) {
            const feature = e.features[0]
            const regionData = RAILWAY_REGIONS.find(r => r.region_id === feature.properties.region_id)
            
            if (regionData) {
              setSelectedRegion({
                region: regionData,
                stats: {
                  stations: Math.floor(Math.random() * 200) + 50,
                  projects: Math.floor(Math.random() * 20) + 5,
                  documents: Math.floor(Math.random() * 100) + 20
                }
              })
            }
          }
        })

        // Add hover effects
        mapInstance.on('mouseenter', 'railway-regions-fill', () => {
          mapInstance.getCanvas().style.cursor = 'pointer'
        })

        mapInstance.on('mouseleave', 'railway-regions-fill', () => {
          mapInstance.getCanvas().style.cursor = ''
        })

        setIsLoading(false)
      } catch (err) {
        setError('Failed to load map data')
        setIsLoading(false)
      }
    }

    loadMapLibre()

    return () => {
      if (map.current) {
        map.current.remove()
      }
    }
  }, [])

  const generateRegionBounds = (regionId: string): number[][] => {
    // Simplified bounding boxes for each railway region
    const bounds: Record<string, number[][]> = {
      scotland: [[-8, 60.5], [-1.5, 60.5], [-1.5, 54.5], [-8, 54.5], [-8, 60.5]],
      london_north_eastern: [[-1.5, 55.5], [1.5, 55.5], [1.5, 51], [-1.5, 51], [-1.5, 55.5]],
      london_north_western: [[-3.5, 55], [-1, 55], [-1, 51], [-3.5, 51], [-3.5, 55]], 
      eastern: [[0, 53.5], [2, 53.5], [2, 50.5], [0, 50.5], [0, 53.5]],
      western: [[-5.5, 53], [-2, 53], [-2, 49.5], [-5.5, 49.5], [-5.5, 53]],
      southern: [[-1.5, 51.5], [1.5, 51.5], [1.5, 49.5], [-1.5, 49.5], [-1.5, 51.5]]
    }
    return bounds[regionId] || bounds.southern
  }

  const handleZoomIn = () => {
    if (map.current) {
      const currentZoom = map.current.getZoom()
      map.current.flyTo({ zoom: Math.min(12, currentZoom + 1) })
    }
  }

  const handleZoomOut = () => {
    if (map.current) {
      const currentZoom = map.current.getZoom()
      map.current.flyTo({ zoom: Math.max(4, currentZoom - 1) })
    }
  }

  const handleResetView = () => {
    if (map.current) {
      map.current.flyTo({ center: [-2.5, 54.0], zoom: 5.5 })
    }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-muted/30 rounded-lg">
        <div className="text-center">
          <p className="text-destructive mb-2">Failed to load interactive map</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Interactive Railway Map</h1>
          <p className="text-muted-foreground">Explore UK railway regions and network data</p>
        </div>
        <Badge variant="secondary">
          {isLoading ? "Loading..." : "Interactive"}
        </Badge>
      </div>

      <div className="relative">
        <div 
          ref={mapContainer} 
          className="w-full rounded-lg border overflow-hidden"
          style={{ height: '600px' }}
        />

        {isLoading && (
          <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading interactive map...</p>
            </div>
          </div>
        )}

        {/* Map Controls */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          <Button size="sm" variant="outline" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={handleResetView}>
            <RotateCcw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Region Details Panel */}
      {selectedRegion && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="flex items-center gap-2">
              <div 
                className="w-4 h-4 rounded"
                style={{ backgroundColor: selectedRegion.region.color }}
              />
              {selectedRegion.region.name} ({selectedRegion.region.code})
            </CardTitle>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSelectedRegion(null)}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">{selectedRegion.region.description}</p>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div>
                <p className="text-2xl font-bold">{selectedRegion.stats.stations}</p>
                <p className="text-sm text-muted-foreground">Stations</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{selectedRegion.stats.projects}</p>
                <p className="text-sm text-muted-foreground">Active Projects</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{selectedRegion.stats.documents}</p>
                <p className="text-sm text-muted-foreground">Documents</p>
              </div>
              <div>
                <p className="text-2xl font-bold">{selectedRegion.region.major_cities.length}</p>
                <p className="text-sm text-muted-foreground">Major Cities</p>
              </div>
            </div>

            <div>
              <p className="font-semibold mb-2">Major Cities:</p>
              <div className="flex flex-wrap gap-1">
                {selectedRegion.region.major_cities.map(city => (
                  <Badge key={city} variant="outline">{city}</Badge>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
} 