"use client"

import { useEffect, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { X, ZoomIn, ZoomOut, RotateCcw, Loader2 } from "lucide-react"
import { useRegionalData } from "@/hooks/use-regional-data"

// Default fallback regions with improved geographical mapping
const FALLBACK_RAILWAY_REGIONS = [
  {
    region_id: "scotland",
    name: "Scotland",
    code: "SC",
    description: "Scottish railway network",
    color: "#8c564b",
    major_cities: ["Glasgow", "Edinburgh", "Aberdeen", "Dundee"],
    // Network Rail official data
    networkRail: {
      director: "Liam Sumpter",
      fullDescription: "Oversees railway infrastructure across Scotland, including the scenic Highlands, Glasgow and Edinburgh.",
      routes: ["Scotland"],
      stats: {
        routeMiles: 2700,
        stations: 350,
        employees: "5,000+"
      },
      url: "https://www.networkrail.co.uk/running-the-railway/our-regions/scotland/"
    }
  },
  {
    region_id: "london_north_eastern",
    name: "London North Eastern",
    code: "LNE",
    description: "East Coast routes and Yorkshire",
    color: "#1f77b4",
    major_cities: ["York", "Leeds", "Newcastle", "Sheffield"]
  },
  {
    region_id: "london_north_western",
    name: "London North Western",
    code: "LNW",
    description: "West Coast and North West England",
    color: "#ff7f0e",
    major_cities: ["Manchester", "Liverpool", "Birmingham", "Preston"],
    // Network Rail official data
    networkRail: {
      director: "Jake Kelly",
      fullDescription: "Known as the 'Backbone of Britain' – connecting major cities like London, Birmingham, Liverpool and Manchester via the West Coast Main Line.",
      routes: ["North West", "Central", "West Coast Mainline South"],
      stats: {
        routeMiles: 4200,
        stations: 580,
        employees: "11,000+"
      },
      url: "https://www.networkrail.co.uk/running-the-railway/our-regions/north-west-and-central/"
    }
  },
  {
    region_id: "eastern",
    name: "Eastern",
    code: "ER",
    description: "East Anglia and eastern England",
    color: "#9467bd",
    major_cities: ["Cambridge", "Norwich", "Ipswich", "Peterborough"],
    // Network Rail official data
    networkRail: {
      director: "Jason Hamilton",
      fullDescription: "Covers key economic hubs including London, the East Midlands, and Yorkshire. Includes the East Coast Main Line.",
      routes: ["Anglia", "East Midlands", "North & East"],
      stats: {
        routeMiles: 4000,
        stations: 700,
        employees: "14,000+"
      },
      url: "https://www.networkrail.co.uk/running-the-railway/our-regions/eastern/"
    }
  },
  {
    region_id: "western",
    name: "Western",
    code: "WR",
    description: "Wales and western England",
    color: "#2ca02c",
    major_cities: ["Cardiff", "Swansea", "Bristol", "Plymouth"],
    // Network Rail official data
    networkRail: {
      director: "Michelle Handforth",
      fullDescription: "Links London to South Wales and the South West of England. Covers major hubs like Bristol and Cardiff.",
      routes: ["Western", "Wales"],
      stats: {
        routeMiles: 3700,
        stations: 400,
        employees: "8,000+"
      },
      url: "https://www.networkrail.co.uk/running-the-railway/our-regions/wales-and-western/"
    }
  },
  {
    region_id: "southern",
    name: "Southern",
    code: "SR",
    description: "South England and London commuter routes",
    color: "#d62728",
    major_cities: ["London", "Brighton", "Portsmouth", "Canterbury"],
    // Network Rail official data
    networkRail: {
      director: "Ellie Burrows dummy data",
      fullDescription: "The busiest and most densely populated part of the network. Includes London commuter routes and the South West Main Line.",
      routes: ["Kent", "Sussex", "Wessex"],
      stats: {
        routeMiles: 3000,
        stations: 800,
        employees: "13,000+"
      },
      url: "https://www.networkrail.co.uk/running-the-railway/our-regions/southern/"
    }
  }
]

export function RailwayMapRealBoundaries({ height = 900, onRegionSelect }: { height?: number, onRegionSelect?: (region: any) => void }) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<any>(null)
  const [selectedRegion, setSelectedRegion] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dataInfo, setDataInfo] = useState<any>(null)
  
  // Get live regional data from Railway backend - Force redeploy
  const { regions: liveRegions, loading: backendLoading, error: backendError } = useRegionalData()
  
  // Use live data if available, otherwise fallback to defaults
  // Re-enable fallback but prioritize API data in click handler
  const RAILWAY_REGIONS = liveRegions && liveRegions.length > 0 ? liveRegions : FALLBACK_RAILWAY_REGIONS
  // const RAILWAY_REGIONS = liveRegions && liveRegions.length > 0 ? liveRegions : []

  // Debug logging to see what we're actually working with
  useEffect(() => {
    console.log('🔍 RailwayMapRealBoundaries data check:')
    console.log('  liveRegions:', liveRegions)
    console.log('  liveRegions.length:', liveRegions?.length)
    console.log('  RAILWAY_REGIONS being used:', RAILWAY_REGIONS)
    console.log('  backendLoading:', backendLoading)
    console.log('  backendError:', backendError)
  }, [liveRegions, backendLoading, backendError])

  useEffect(() => {
    if (!mapContainer.current) return

    const initializeMap = async () => {
      try {
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
        
        setDataInfo({
          districts: ukData.features?.length || 0,
          source: 'martinjc/UK-GeoJSON'
        })

        createMapWithRealBoundaries(ukData)
      } catch (err) {
        console.error('Failed to load UK data:', err)
        setError('Failed to load UK boundary data')
        setIsLoading(false)
      }
    }

    const createMapWithRealBoundaries = (ukData: any) => {
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
          addRealUKBoundaries(mapInstance, ukData)
        })

        map.current = mapInstance
      } catch (err) {
        setError('Failed to create map')
        setIsLoading(false)
      }
    }

    const addRealUKBoundaries = (mapInstance: any, ukData: any) => {
      try {
        console.log('Processing UK districts...')
        
        const processedData = processUKDistricts(ukData)
        
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

        const popup = new maplibregl.Popup({
          closeButton: false,
          closeOnClick: false
        })

        mapInstance.on('click', 'uk-districts-fill', (e: any) => {
          if (e.features && e.features[0]) {
            const feature = e.features[0]
            const regionId = feature.properties.railway_region
            
            // Find region by matching region_id to our API data
            let regionData = null
            
            // Map component region_id to API region codes
            const regionMapping: Record<string, string> = {
              'eastern': 'ER',
              'scotland': 'SC', 
              'western': 'WR',
              'london_north_western': 'NR',
              'london_north_eastern': 'LNE', // Fallback data only
              'southern': 'SR'
            }
            
            // Try to find in live API data first
            const apiCode = regionMapping[regionId]
            if (apiCode && liveRegions && liveRegions.length > 0) {
              const apiRegion = liveRegions.find(r => r.code === apiCode)
              if (apiRegion) {
                // Create compatible structure for API data
                regionData = {
                  region_id: regionId,
                  name: apiRegion.name,
                  code: apiRegion.code,
                  description: apiRegion.description,
                  color: apiRegion.color,
                  major_cities: [],
                  networkRail: {
                    director: apiRegion.director, // Real Supabase director!
                    fullDescription: apiRegion.description,
                    routes: apiRegion.routes,
                    stats: {
                      routeMiles: apiRegion.route_miles,
                      stations: apiRegion.stations,
                      employees: "Network Staff"
                    },
                    url: `https://www.networkrail.co.uk/running-the-railway/our-regions/${apiRegion.name.toLowerCase()}/`
                  }
                }
              }
            }
            
            // Fallback to hardcoded data if no API data found
            if (!regionData) {
              regionData = FALLBACK_RAILWAY_REGIONS.find(r => r.region_id === regionId)
            }
            
            if (regionData) {
              const regionInfo = {
                region: regionData,
                stats: {
                  stations: regionData.networkRail?.stats?.stations || Math.floor(Math.random() * 200) + 50,
                  projects: Math.floor(Math.random() * 20) + 5,
                  documents: Math.floor(Math.random() * 100) + 20
                },
                clickedDistrict: {
                  name: feature.properties.LAD13NM,
                  code: feature.properties.LAD13CD
                }
              }
              console.log('🎯 Selected region with real API data:', regionInfo)
              setSelectedRegion(regionInfo)
              onRegionSelect?.(regionInfo)
            }
          }
        })

        mapInstance.on('mouseenter', 'uk-districts-fill', (e: any) => {
          mapInstance.getCanvas().style.cursor = 'pointer'
          
          if (e.features && e.features[0]) {
            const feature = e.features[0]
            popup.setLngLat(e.lngLat)
              .setHTML(`
                <div class="font-medium">${feature.properties.LAD13NM}</div>
                <div class="text-sm text-gray-600">${feature.properties.railway_region_name}</div>
              `)
              .addTo(mapInstance)
          }
        })

        mapInstance.on('mouseleave', 'uk-districts-fill', () => {
          mapInstance.getCanvas().style.cursor = ''
          popup.remove()
        })

        console.log('Successfully added real UK boundaries with live data!')
        setIsLoading(false)
      } catch (err) {
        console.error('Error adding boundaries:', err)
        setError('Failed to process boundaries')
        setIsLoading(false)
      }
    }

    initializeMap()

    return () => {
      if (map.current) {
        map.current.remove()
      }
    }
  }, [])

  const processUKDistricts = (ukData: any) => {
    const processedFeatures = ukData.features.map((feature: any) => {
      const assignedRegion = RAILWAY_REGIONS.find(region => 
        assignDistrictToRailwayRegion(feature, region)
      )

      const railwayRegion = assignedRegion || RAILWAY_REGIONS[5]

      return {
        ...feature,
        properties: {
          ...feature.properties,
          railway_region: railwayRegion.region_id,
          railway_region_name: railwayRegion.name,
          railway_color: railwayRegion.color,
          railway_code: railwayRegion.code
        }
      }
    })

    return {
      type: 'FeatureCollection',
      features: processedFeatures
    }
  }

  const assignDistrictToRailwayRegion = (district: any, region: any): boolean => {
    const districtName = district.properties.LAD13NM?.toLowerCase() || ''
    
    const bbox = getBoundingBox(district.geometry)
    const centerLat = (bbox.north + bbox.south) / 2
    const centerLon = (bbox.east + bbox.west) / 2

    switch (region.region_id) {
      case 'scotland':
        return centerLat > 55 || districtName.includes('scotland') ||
               districtName.includes('edinburgh') || districtName.includes('glasgow')
      
      case 'london_north_eastern':
        return (centerLat > 53 && centerLat < 55.5 && centerLon > -2.5) ||
               districtName.includes('york') || districtName.includes('leeds') ||
               districtName.includes('newcastle') || districtName.includes('sheffield')
      
      case 'london_north_western':
        return (centerLat > 52 && centerLat < 55 && centerLon < -1.5) ||
               districtName.includes('manchester') || districtName.includes('liverpool') ||
               districtName.includes('birmingham') || districtName.includes('preston')
      
      case 'eastern':
        return (centerLat > 51.5 && centerLat < 53 && centerLon > -0.5) ||
               districtName.includes('cambridge') || districtName.includes('norwich') ||
               districtName.includes('ipswich') || districtName.includes('peterborough')
      
      case 'western':
        return centerLon < -2.5 || districtName.includes('wales') ||
               districtName.includes('cardiff') || districtName.includes('bristol') ||
               districtName.includes('plymouth') || districtName.includes('exeter')
      
      case 'southern':
        return (centerLat < 52 && centerLon > -1.5) ||
               districtName.includes('london') || districtName.includes('brighton') ||
               districtName.includes('portsmouth') || districtName.includes('canterbury')
      
      default:
        return false
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

  const handleZoomIn = () => {
    if (map.current) {
      map.current.flyTo({ zoom: Math.min(12, map.current.getZoom() + 1) })
    }
  }

  const handleZoomOut = () => {
    if (map.current) {
      map.current.flyTo({ zoom: Math.max(4, map.current.getZoom() - 1) })
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
          className="w-full rounded-lg border overflow-hidden shadow-lg transition-all duration-300"
          style={{ height: `${height}px` }}
        />

        {isLoading && (
          <div className="absolute inset-0 bg-background/90 flex items-center justify-center">
            <div className="text-center p-6">
              <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
              <p className="font-medium mb-2">Loading Real UK Boundaries</p>
              <p className="text-sm text-muted-foreground">
                Processing {dataInfo?.districts || '400+'} district boundaries...
              </p>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 left-4 bg-background/95 rounded-lg p-3 border shadow-sm">
          <h4 className="font-medium mb-2 text-sm">Railway Regions</h4>
          <div className="space-y-1">
            {RAILWAY_REGIONS.map(region => (
              <div key={region.region_id} className="flex items-center gap-2 text-xs">
                <div 
                  className="w-3 h-3 rounded" 
                  style={{ backgroundColor: region.color }}
                />
                <span>{region.code}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="absolute bottom-2 right-2 bg-black/70 text-white rounded px-2 py-1 text-xs">
          UK boundaries: © martinjc/UK-GeoJSON | Map: © OpenStreetMap
        </div>
      </div>

      {selectedRegion && (
        <Card className="border-l-4" style={{ borderLeftColor: selectedRegion.region.color }}>
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
              onClick={() => {
                setSelectedRegion(null)
                onRegionSelect?.(null)
              }}
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent>
            {/* Network Rail Official Description */}
            <p className="text-muted-foreground mb-4">
              {selectedRegion.region.networkRail?.fullDescription || selectedRegion.region.description}
            </p>
            
            {selectedRegion.clickedDistrict && (
              <div className="mb-4 p-3 bg-muted/30 rounded">
                <p className="font-medium text-sm">📍 Clicked District</p>
                <p className="text-sm">{selectedRegion.clickedDistrict.name}</p>
                <p className="text-xs text-muted-foreground">{selectedRegion.clickedDistrict.code}</p>
              </div>
            )}

            {/* Director Information */}
            {selectedRegion.region.networkRail && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                <p className="font-semibold text-blue-700 dark:text-blue-300 mb-1">👤 Regional Director</p>
                <p className="text-blue-600 dark:text-blue-400">{selectedRegion.region.networkRail.director}</p>
              </div>
            )}

            {/* Network Rail Statistics */}
            {selectedRegion.region.networkRail && (
              <div className="mb-4">
                <p className="font-semibold mb-2 text-green-600">📊 Network Rail Statistics</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">{selectedRegion.region.networkRail.stats.routeMiles.toLocaleString()}</p>
                    <p className="text-xs text-green-600 dark:text-green-300">Route Miles</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">{selectedRegion.region.networkRail.stats.stations.toLocaleString()}</p>
                    <p className="text-xs text-green-600 dark:text-green-300">Stations</p>
                  </div>
                  <div className="text-center p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800">
                    <p className="text-xl font-bold text-green-700 dark:text-green-400">{selectedRegion.region.networkRail.stats.employees}</p>
                    <p className="text-xs text-green-600 dark:text-green-300">Employees</p>
                  </div>
                </div>
              </div>
            )}

            {/* Placeholder Data for CPC Projects & Documents */}
            <div className="mb-4">
              <p className="font-semibold mb-2 text-orange-600">🚧 Placeholder Data (To Be Updated)</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-200 dark:border-orange-800">
                  <p className="text-xl font-bold text-orange-700 dark:text-orange-400">{Math.floor(Math.random() * 20) + 5}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-300">CPC Projects*</p>
                </div>
                <div className="text-center p-3 bg-orange-50 dark:bg-orange-950/20 rounded border border-orange-200 dark:border-orange-800">
                  <p className="text-xl font-bold text-orange-700 dark:text-orange-400">{Math.floor(Math.random() * 100) + 20}</p>
                  <p className="text-xs text-orange-600 dark:text-orange-300">Documents*</p>
                </div>
              </div>
              <p className="text-xs text-orange-500 mt-2 italic">* Dummy data - will be replaced with real CPC project data and document scraping</p>
            </div>

            {/* Railway Routes */}
            {selectedRegion.region.networkRail && (
              <div className="mb-4">
                <p className="font-semibold mb-2">🚂 Railway Routes:</p>
                <div className="flex flex-wrap gap-1">
                  {selectedRegion.region.networkRail.routes.map((route: string) => (
                    <Badge key={route} variant="outline">{route}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Major Cities (fallback) */}
            <div className="mb-4">
              <p className="font-semibold mb-2">🏙️ Major Cities:</p>
              <div className="flex flex-wrap gap-1">
                {selectedRegion.region.major_cities.map((city: string) => (
                  <Badge key={city} variant="secondary">{city}</Badge>
                ))}
              </div>
            </div>

            {/* Network Rail Link */}
            {selectedRegion.region.networkRail && (
              <div className="pt-3 border-t">
                <Button 
                  className="w-full" 
                  onClick={() => window.open(selectedRegion.region.networkRail.url, '_blank')}
                >
                  🔗 View on Network Rail
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
} 