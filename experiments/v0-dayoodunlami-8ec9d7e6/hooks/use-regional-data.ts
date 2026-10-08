import { useState, useEffect } from 'react'

interface BackendRegion {
  code: string
  name: string
  director: string
  route_miles: number
  stations: number
  cpc_projects: number
}

interface RailwayRegion {
  code: string
  name: string
  director: string
  route_miles: number
  stations: number
  cpc_projects: number
  color: string
  routes: string[]
  description: string
}

export function useRegionalData() {
  const [regions, setRegions] = useState<RailwayRegion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Keep your existing region colors and routes
  const regionConfig = {
    'ER': {
      color: '#FF8C00',
      routes: ['North and East route', 'East Midlands route', 'Anglia route'],
      description: 'Covering East England including major routes to Cambridge, Norwich, and the East Midlands'
    },
    'SC': {
      color: '#4169E1', 
      routes: ['Scotland route'],
      description: 'Scottish railway network including connections to Edinburgh, Glasgow, and Highland routes'
    },
    'WR': {
      color: '#DA70D6',
      routes: ['Western route'],
      description: 'Western England including routes to Wales, Cardiff, Swansea'
    },
    'NR': {
      color: '#32CD32',
      routes: ['Northern route', 'North West route'],
      description: 'Northern England routes including connections to Manchester, Liverpool'
    },
    'SR': {
      color: '#20B2AA',
      routes: ['Kent route', 'Sussex route', 'Wessex route'],
      description: 'South England routes including connections to Brighton, Dover, and South West'
    }
  }

  useEffect(() => {
    fetchRegionalData()
  }, [])

  const fetchRegionalData = async () => {
    try {
      setLoading(true)
      console.log('🚀 ATTEMPTING TO FETCH REGIONS FROM RAILWAY API...')
      const response = await fetch('https://web-production-6045b.up.railway.app/api/regions')
      console.log('📡 Railway API Response:', response.status, response.statusText)
      
      if (!response.ok) {
        throw new Error(`Failed to fetch regions: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('✅ SUCCESSFULLY FETCHED RAILWAY DATA:', data)
      
      // Simple mapping - just add colors and routes to API data
      const mappedRegions: RailwayRegion[] = data.regions.map((region: BackendRegion) => {
        const config = regionConfig[region.code as keyof typeof regionConfig]
        
        return {
          ...region, // Keep all API fields as-is
          color: config?.color || '#666666',
          routes: config?.routes || ['Regional routes'],
          description: config?.description || `${region.name} railway network`
        }
      })
      
      setRegions(mappedRegions)
      setError(null)
      console.log('🎉 REGIONS MAPPED AND SET:', mappedRegions.length, 'regions')
    } catch (err) {
      console.error('Error fetching regional data:', err)
      setError(err instanceof Error ? err.message : 'Failed to load regional data')
      
      // FALLBACK DATA (API Failed) - Distinct from demo mode data
      console.warn('🚨 API FAILED - Using fallback data')
      setRegions([
        {
          id: "fallback-eastern",
          name: "🔄 FALLBACK: Eastern Region",
          color: "#FF0000", // Red to indicate fallback
          routes: ["FALLBACK: East Coast route"],
          description: "⚠️ FALLBACK DATA: API connection failed - this is emergency fallback data",
          stations: 999,
          projects: 99,
          director: "FALLBACK: Emergency Mode"
        },
        {
          id: "fallback-scotland", 
          name: "🔄 FALLBACK: Scotland Region",
          color: "#FF0000",
          routes: ["FALLBACK: Highland route"],
          description: "⚠️ FALLBACK DATA: API connection failed - this is emergency fallback data",
          stations: 888,
          projects: 88,
          director: "FALLBACK: Emergency Mode"
        },
        {
          id: "fallback-southern",
          name: "🔄 FALLBACK: Southern Region", 
          color: "#FF0000",
          routes: ["FALLBACK: South Coast route"],
          description: "⚠️ FALLBACK DATA: API connection failed - this is emergency fallback data",
          stations: 777,
          projects: 77,
          director: "FALLBACK: Emergency Mode"
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  return { regions, loading, error, refetch: fetchRegionalData }
} 