"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, X } from "lucide-react"
import { useRegionalData } from "@/hooks/use-regional-data"

interface SelectedRegionInfo {
  region: {
    code: string
    name: string
    director: string
    route_miles: number
    stations: number
    cpc_projects: number
    color: string
    description: string
  }
  clickedDistrict?: {
    name: string
    code: string
  }
}

interface RailwayMapApiCleanProps {
  height?: number
  onRegionSelect?: (region: SelectedRegionInfo | null) => void
}

export function RailwayMapApiClean({ height = 900, onRegionSelect }: RailwayMapApiCleanProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const [selectedRegion, setSelectedRegion] = useState<SelectedRegionInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get live regional data from Railway backend API
  const { regions: apiRegions, loading: apiLoading, error: apiError } = useRegionalData()

  useEffect(() => {
    console.log('🆕 RailwayMapApiClean - API Regions:', apiRegions)
  }, [apiRegions])

  useEffect(() => {
    if (!mapContainer.current) return

    const initializeMap = async () => {
      try {
        // Load MapLibre GL JS
        const link = document.createElement('link')
        link.rel = 'stylesheet'
        link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css'
        document.head.appendChild(link)

        const script = document.createElement('script')
        script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js'
        script.onload = () => loadUKDataAndCreateMap()
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

    const loadUKDataAndCreateMap = async () => {
      try {
        console.log('Loading UK boundary data...')
        const response = await fetch('https://raw.githubusercontent.com/martinjc/UK-GeoJSON/master/json/administrative/gb/lad.json')
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const ukData = await response.json()
        console.log('UK data loaded:', ukData.features?.length, 'districts')
        
        createMapWithApiData(ukData)
      } catch (err) {
        console.error('Failed to load UK data:', err)
        setError('Failed to load UK boundary data')
        setIsLoading(false)
      }
    }

    const createMapWithApiData = (ukData: any) => {
      try {
        // @ts-ignore
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
          center: [-2.5, 54.0],
          zoom: 5.5,
          minZoom: 4,
          maxZoom: 12,
          maxBounds: [[-11, 49.5], [2, 61]]
        })

        // @ts-ignore
        mapInstance.addControl(new maplibregl.NavigationControl({ showCompass: false }))

        mapInstance.on('load', () => {
          addRailwayRegionsFromApi(mapInstance, ukData)
        })

        map.current = mapInstance
      } catch (err) {
        console.error('Failed to create map:', err)
        setError('Failed to create map')
        setIsLoading(false)
      }
    }

    const addRailwayRegionsFromApi = (mapInstance: any, ukData: any) => {
      try {
        console.log('🎯 Processing districts with API regions:', apiRegions?.length)
        
        if (!apiRegions || apiRegions.length === 0) {
          console.warn('⚠️ No API regions available, skipping map setup')
          setError('No regional data available')
          setIsLoading(false)
          return
        }

        const processedData = processUKDistrictsWithApi(ukData)
        
        mapInstance.addSource('uk-districts', {
          type: 'geojson',
          data: processedData
        })

        mapInstance.addLayer({
          id: 'uk-districts-fill',
          type: 'fill',
          source: 'uk-districts',
          paint: {
            'fill-color': ['get', 'railway_color'],
            'fill-opacity': 0.5
          }
        })

        mapInstance.addLayer({
          id: 'uk-districts-outline',
          type: 'line',
          source: 'uk-districts',
          paint: {
            'line-color': '#ffffff',
            'line-width': 0.5,
            'line-opacity': 0.8
          }
        })

        // Simple click handler - directly uses API data
        mapInstance.on('click', 'uk-districts-fill', (e: any) => {
          if (e.features && e.features[0]) {
            const feature = e.features[0]
            const regionCode = feature.properties.railway_code
            
            console.log('🖱️ Clicked region code:', regionCode)
            
            // Find matching API region
            const apiRegion = apiRegions.find(r => r.code === regionCode)
            
            if (apiRegion) {
              const regionInfo: SelectedRegionInfo = {
                region: apiRegion,
                clickedDistrict: {
                  name: feature.properties.LAD13NM,
                  code: feature.properties.LAD13CD
                }
              }
              
              console.log('🎯 Selected region with real API data:', regionInfo)
              setSelectedRegion(regionInfo)
              onRegionSelect?.(regionInfo)
            } else {
              console.warn('❌ No API region found for code:', regionCode)
            }
          }
        })

        console.log('✅ Successfully added railway regions from API!')
        setIsLoading(false)
      } catch (err) {
        console.error('Error adding API regions:', err)
        setError('Failed to process regional data')
        setIsLoading(false)
      }
    }

    // Wait for API data before initializing map
    if (apiRegions && apiRegions.length > 0) {
      initializeMap()
    }

    return () => {
      // Improved cleanup logic
      if (map.current && typeof map.current.remove === 'function') {
        try {
          map.current.remove()
          map.current = null
        } catch (err) {
          console.warn('Map cleanup warning:', err)
          map.current = null
        }
      }
    }
  }, [apiRegions, onRegionSelect])

  const processUKDistrictsWithApi = (ukData: any) => {
    const processedFeatures = ukData.features.map((feature: any) => {
      // Simple geographical assignment logic
      const districtName = feature.properties.LAD13NM?.toLowerCase() || ''
      const bbox = getBoundingBox(feature.geometry)
      const centerLat = (bbox.north + bbox.south) / 2
      const centerLon = (bbox.east + bbox.west) / 2

      let assignedRegion = null

      // Geographic assignment to match API regions
      if (centerLat > 55 || districtName.includes('scotland')) {
        assignedRegion = apiRegions?.find(r => r.code === 'SC') // Scotland
      } else if (centerLat > 53 && centerLat < 55.5 && centerLon > -2.5) {
        assignedRegion = apiRegions?.find(r => r.code === 'NR') // Northern  
      } else if (centerLat > 51.5 && centerLat < 53 && centerLon > -0.5) {
        assignedRegion = apiRegions?.find(r => r.code === 'ER') // Eastern
      } else if (centerLon < -2.5) {
        assignedRegion = apiRegions?.find(r => r.code === 'WR') // Western
      } else {
        assignedRegion = apiRegions?.find(r => r.code === 'SR') // Southern (default)
      }

      // Fallback to first available region
      const finalRegion = assignedRegion || apiRegions?.[0]

      return {
        ...feature,
        properties: {
          ...feature.properties,
          railway_code: finalRegion?.code || 'UNKNOWN',
          railway_name: finalRegion?.name || 'Unknown Region',
          railway_color: finalRegion?.color || '#666666'
        }
      }
    })

    return {
      type: 'FeatureCollection',
      features: processedFeatures
    }
  }

  const getBoundingBox = (geometry: any) => {
    let west = Infinity, east = -Infinity, north = -Infinity, south = Infinity

    const processCoordinates = (coords: any) => {
      if (typeof coords[0] === 'number') {
        west = Math.min(west, coords[0])
        east = Math.max(east, coords[0])
        south = Math.min(south, coords[1])
        north = Math.max(north, coords[1])
      } else {
        coords.forEach(processCoordinates)
      }
    }

    if (geometry.type === 'Polygon') {
      processCoordinates(geometry.coordinates[0])
    } else if (geometry.type === 'MultiPolygon') {
      geometry.coordinates.forEach((polygon: any) => {
        processCoordinates(polygon[0])
      })
    }

    return { west, east, north, south }
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-96 bg-muted/30 rounded-lg">
        <div className="text-center">
          <p className="text-destructive mb-2">⚠️ Map Loading Error</p>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="relative">
        <div 
          ref={mapContainer} 
          className="w-full rounded-lg border overflow-hidden shadow-lg"
          style={{ height: `${height}px` }}
        />

        {(isLoading || apiLoading) && (
          <div className="absolute inset-0 bg-background/90 flex items-center justify-center">
            <div className="text-center p-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="font-medium mb-2">Loading Railway Regions</p>
              <p className="text-sm text-muted-foreground">
                {apiLoading ? 'Fetching live data...' : 'Processing boundaries...'}
              </p>
            </div>
          </div>
        )}

        {/* Live API Region Legend */}
        {apiRegions && apiRegions.length > 0 && (
          <div className="absolute bottom-4 left-4 bg-background/95 rounded-lg p-3 border shadow-sm">
            <h4 className="font-medium mb-2 text-sm">🔴 Live API Regions</h4>
            <div className="space-y-1">
              {apiRegions.map(region => (
                <div key={region.code} className="flex items-center gap-2 text-xs">
                  <div 
                    className="w-3 h-3 rounded" 
                    style={{ backgroundColor: region.color }}
                  />
                  <span>{region.code} - {region.director}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 