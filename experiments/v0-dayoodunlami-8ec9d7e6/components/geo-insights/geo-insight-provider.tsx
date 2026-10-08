"use client"

import React, { createContext, useContext, useReducer, useEffect } from 'react'

// Types from existing components
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

export interface RailwayRegion {
  id: string
  name: string
  director: string
  description: string
  routes: string[]
  stats: {
    routeMiles: number
    stations: number
    employees: string
  }
  url: string
  color: string
  projects: number
}

export interface InsightFilters {
  region: string | null
  dateRange: {
    start: Date | null
    end: Date | null
  }
  sector: string[]
  projectStatus: string[]
  metricType: string[]
}

export interface GeneratedInsight {
  id: string
  type: 'trend' | 'comparison' | 'prediction' | 'anomaly'
  title: string
  description: string
  confidence: number
  region?: string
  station?: string
  timeframe: string
  chartData?: any
  recommendations?: string[]
  createdAt: Date
}

export interface GeoInsightState {
  // Map state
  selectedRegion: RailwayRegion | null
  selectedStation: Station | null
  hoveredRegion: string | null
  mapLoading: boolean
  
  // Insights state  
  filters: InsightFilters
  insights: GeneratedInsight[]
  metrics: {
    totalProjects: number
    totalStations: number
    totalEmployees: number
    averageBudget: number
  }
  insightsLoading: boolean
  
  // Shared state
  syncMode: boolean // Whether map and insights are synchronized
  viewMode: 'split' | 'map-focus' | 'insights-focus'
  contextualDataExpanded: boolean
}

type GeoInsightAction =
  | { type: 'SET_SELECTED_REGION'; payload: RailwayRegion | null }
  | { type: 'SET_SELECTED_STATION'; payload: Station | null }
  | { type: 'SET_HOVERED_REGION'; payload: string | null }
  | { type: 'SET_MAP_LOADING'; payload: boolean }
  | { type: 'SET_FILTERS'; payload: Partial<InsightFilters> }
  | { type: 'ADD_INSIGHT'; payload: GeneratedInsight }
  | { type: 'SET_INSIGHTS'; payload: GeneratedInsight[] }
  | { type: 'SET_METRICS'; payload: Partial<GeoInsightState['metrics']> }
  | { type: 'SET_INSIGHTS_LOADING'; payload: boolean }
  | { type: 'SET_SYNC_MODE'; payload: boolean }
  | { type: 'SET_VIEW_MODE'; payload: GeoInsightState['viewMode'] }
  | { type: 'TOGGLE_CONTEXTUAL_DATA' }
  | { type: 'RESET_STATE' }

const initialState: GeoInsightState = {
  selectedRegion: null,
  selectedStation: null,
  hoveredRegion: null,
  mapLoading: true,
  filters: {
    region: null,
    dateRange: { start: null, end: null },
    sector: [],
    projectStatus: [],
    metricType: []
  },
  insights: [],
  metrics: {
    totalProjects: 0,
    totalStations: 0,
    totalEmployees: 0,
    averageBudget: 0
  },
  insightsLoading: false,
  syncMode: true,
  viewMode: 'split',
  contextualDataExpanded: false
}

function geoInsightReducer(state: GeoInsightState, action: GeoInsightAction): GeoInsightState {
  switch (action.type) {
    case 'SET_SELECTED_REGION':
      return {
        ...state,
        selectedRegion: action.payload,
        // Auto-generate insights when region is selected in sync mode
        insightsLoading: state.syncMode && action.payload ? true : state.insightsLoading
      }
    
    case 'SET_SELECTED_STATION':
      return {
        ...state,
        selectedStation: action.payload,
        insightsLoading: state.syncMode && action.payload ? true : state.insightsLoading
      }
    
    case 'SET_HOVERED_REGION':
      return { ...state, hoveredRegion: action.payload }
    
    case 'SET_MAP_LOADING':
      return { ...state, mapLoading: action.payload }
    
    case 'SET_FILTERS':
      return {
        ...state,
        filters: { ...state.filters, ...action.payload },
        insightsLoading: true // Trigger insights refresh when filters change
      }
    
    case 'ADD_INSIGHT':
      return {
        ...state,
        insights: [action.payload, ...state.insights].slice(0, 10), // Keep latest 10
        insightsLoading: false
      }
    
    case 'SET_INSIGHTS':
      return {
        ...state,
        insights: action.payload,
        insightsLoading: false
      }
    
    case 'SET_METRICS':
      return {
        ...state,
        metrics: { ...state.metrics, ...action.payload }
      }
    
    case 'SET_INSIGHTS_LOADING':
      return { ...state, insightsLoading: action.payload }
    
    case 'SET_SYNC_MODE':
      return { ...state, syncMode: action.payload }
    
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload }
    
    case 'TOGGLE_CONTEXTUAL_DATA':
      return { ...state, contextualDataExpanded: !state.contextualDataExpanded }
    
    case 'RESET_STATE':
      return initialState
    
    default:
      return state
  }
}

interface GeoInsightContextType {
  state: GeoInsightState
  dispatch: React.Dispatch<GeoInsightAction>
  // Helper functions
  selectRegion: (region: RailwayRegion | null) => void
  selectStation: (station: Station | null) => void
  updateFilters: (filters: Partial<InsightFilters>) => void
  generateInsightForRegion: (region: RailwayRegion) => Promise<void>
  generateInsightForStation: (station: Station) => Promise<void>
  toggleSync: () => void
}

const GeoInsightContext = createContext<GeoInsightContextType | undefined>(undefined)

export function GeoInsightProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(geoInsightReducer, initialState)

  // Helper functions
  const selectRegion = (region: RailwayRegion | null) => {
    dispatch({ type: 'SET_SELECTED_REGION', payload: region })
  }

  const selectStation = (station: Station | null) => {
    dispatch({ type: 'SET_SELECTED_STATION', payload: station })
  }

  const updateFilters = (filters: Partial<InsightFilters>) => {
    dispatch({ type: 'SET_FILTERS', payload: filters })
  }

  const generateInsightForRegion = async (region: RailwayRegion) => {
    dispatch({ type: 'SET_INSIGHTS_LOADING', payload: true })
    
    try {
      // Mock insight generation - replace with actual API call
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      const insight: GeneratedInsight = {
        id: `insight-${Date.now()}`,
        type: 'trend',
        title: `${region.name} Region Analysis`,
        description: `Analysis shows strong performance in ${region.name} with ${region.stats.stations} stations across ${region.stats.routeMiles.toLocaleString()} route miles.`,
        confidence: 0.85,
        region: region.id,
        timeframe: 'Last 12 months',
        recommendations: [
          `Focus on ${region.routes[0]} route optimization`,
          'Consider capacity expansion projects',
          'Monitor passenger flow patterns'
        ],
        createdAt: new Date()
      }
      
      dispatch({ type: 'ADD_INSIGHT', payload: insight })
    } catch (error) {
      console.error('Failed to generate insight:', error)
      dispatch({ type: 'SET_INSIGHTS_LOADING', payload: false })
    }
  }

  const generateInsightForStation = async (station: Station) => {
    dispatch({ type: 'SET_INSIGHTS_LOADING', payload: true })
    
    try {
      await new Promise(resolve => setTimeout(resolve, 1200))
      
      const insight: GeneratedInsight = {
        id: `insight-${Date.now()}`,
        type: 'comparison',
        title: `${station.name} Station Metrics`,
        description: `Station analysis reveals ${station.projects.length} active projects with operational status: ${station.status}.`,
        confidence: 0.78,
        station: station.id,
        timeframe: 'Current quarter',
        recommendations: [
          'Monitor project delivery timelines',
          'Assess passenger capacity needs',
          'Review maintenance schedules'
        ],
        createdAt: new Date()
      }
      
      dispatch({ type: 'ADD_INSIGHT', payload: insight })
    } catch (error) {
      console.error('Failed to generate insight:', error)
      dispatch({ type: 'SET_INSIGHTS_LOADING', payload: false })
    }
  }

  const toggleSync = () => {
    dispatch({ type: 'SET_SYNC_MODE', payload: !state.syncMode })
  }

  // Auto-generate insights when region/station changes in sync mode
  useEffect(() => {
    if (state.syncMode && state.selectedRegion && state.insightsLoading) {
      generateInsightForRegion(state.selectedRegion)
    }
  }, [state.selectedRegion, state.syncMode])

  useEffect(() => {
    if (state.syncMode && state.selectedStation && state.insightsLoading) {
      generateInsightForStation(state.selectedStation)
    }
  }, [state.selectedStation, state.syncMode])

  const contextValue: GeoInsightContextType = {
    state,
    dispatch,
    selectRegion,
    selectStation,
    updateFilters,
    generateInsightForRegion,
    generateInsightForStation,
    toggleSync
  }

  return (
    <GeoInsightContext.Provider value={contextValue}>
      {children}
    </GeoInsightContext.Provider>
  )
}

export function useGeoInsight() {
  const context = useContext(GeoInsightContext)
  if (context === undefined) {
    throw new Error('useGeoInsight must be used within a GeoInsightProvider')
  }
  return context
} 