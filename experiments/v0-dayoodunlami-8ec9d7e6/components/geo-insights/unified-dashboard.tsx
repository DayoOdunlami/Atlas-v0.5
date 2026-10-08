"use client"

import React, { useState } from 'react'
import { useGeoInsight } from './geo-insight-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { 
  Map, 
  BarChart3, 
  Maximize2, 
  Minimize2, 
  Settings,
  RefreshCw,
  RotateCcw,
  ChevronUp,
  ChevronDown,
  MapPin,
  TrendingUp,
  Activity
} from 'lucide-react'
import { MapInsightsPanel } from './map-insights-panel'
import { ContextualExplorer } from './contextual-explorer'
import { RailwayMapRealBoundaries } from '@/components/map/railway-map-real-boundaries'

export function UnifiedDashboard() {
  const { state, selectRegion, selectStation, toggleSync, dispatch } = useGeoInsight()
  
  const handleViewModeChange = (mode: 'split' | 'map-focus' | 'insights-focus') => {
    dispatch({ type: 'SET_VIEW_MODE', payload: mode })
  }

  const toggleContextualData = () => {
    dispatch({ type: 'TOGGLE_CONTEXTUAL_DATA' })
  }

  // Calculate grid classes based on view mode
  const getGridClasses = () => {
    switch (state.viewMode) {
      case 'map-focus':
        return 'grid-cols-1 lg:grid-cols-4' // Map takes 3/4, insights 1/4
      case 'insights-focus':
        return 'grid-cols-1 lg:grid-cols-4' // Map takes 1/4, insights 3/4  
      default:
        return 'grid-cols-1 lg:grid-cols-5' // Default 60/40 split (3/2)
    }
  }

  const getMapClasses = () => {
    switch (state.viewMode) {
      case 'map-focus':
        return 'lg:col-span-3'
      case 'insights-focus':
        return 'lg:col-span-1'
      default:
        return 'lg:col-span-3' // 60% width
    }
  }

  const getInsightsClasses = () => {
    switch (state.viewMode) {
      case 'map-focus':
        return 'lg:col-span-1'
      case 'insights-focus':
        return 'lg:col-span-3'
      default:
        return 'lg:col-span-2' // 40% width
    }
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="flex-none bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center">
              <Map className="mr-3 h-7 w-7 text-blue-600" />
              Geospatial Analytics Dashboard
            </h1>
            
            {/* Selection indicators */}
            <div className="flex items-center space-x-2">
              {state.selectedRegion && (
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                  <MapPin className="mr-1 h-3 w-3" />
                  {state.selectedRegion.name}
                </Badge>
              )}
              {state.selectedStation && (
                <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                  <Activity className="mr-1 h-3 w-3" />
                  {state.selectedStation.name}
                </Badge>
              )}
            </div>
          </div>
          
          {/* Controls */}
          <div className="flex items-center space-x-4">
            {/* Sync toggle */}
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700">Sync Mode</label>
              <Switch
                checked={state.syncMode}
                onCheckedChange={toggleSync}
                className="data-[state=checked]:bg-blue-600"
              />
              {state.syncMode ? (
                <RefreshCw className="h-4 w-4 text-blue-600" />
              ) : (
                <RotateCcw className="h-4 w-4 text-gray-400" />
              )}
            </div>
            
            <Separator orientation="vertical" className="h-6" />
            
            {/* View mode controls */}
            <div className="flex items-center space-x-1">
              <Button
                variant={state.viewMode === 'map-focus' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleViewModeChange('map-focus')}
                className="px-3"
              >
                <Map className="h-4 w-4 mr-1" />
                Map
              </Button>
              <Button
                variant={state.viewMode === 'split' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleViewModeChange('split')}
                className="px-3"
              >
                <BarChart3 className="h-4 w-4 mr-1" />
                Split
              </Button>
              <Button
                variant={state.viewMode === 'insights-focus' ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleViewModeChange('insights-focus')}
                className="px-3"
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                Insights
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className="flex-1 overflow-hidden">
        <div className={`grid ${getGridClasses()} gap-4 h-full p-4`}>
          {/* Map Panel */}
          <Card className={`${getMapClasses()} overflow-hidden`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <Map className="mr-2 h-5 w-5" />
                  Interactive Railway Map
                </span>
                {state.mapLoading && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-600">
                    Loading...
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0 h-full">
              <div className="h-full min-h-[600px]">
                <SimpleMapPlaceholder />
              </div>
            </CardContent>
          </Card>

          {/* Insights Panel */}
          <Card className={`${getInsightsClasses()} overflow-hidden flex flex-col`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center">
                  <BarChart3 className="mr-2 h-5 w-5" />
                  AI-Powered Insights
                </span>
                <div className="flex items-center space-x-2">
                  {state.insightsLoading && (
                    <Badge variant="outline" className="bg-orange-50 text-orange-600">
                      Analyzing...
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-gray-50 text-gray-600">
                    {state.insights.length} insights
                  </Badge>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <MapInsightsPanel />
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Contextual Data Explorer (Collapsible bottom panel) */}
      <div className="flex-none bg-white border-t border-gray-200">
        <div className="px-6 py-3">
          <Button
            variant="ghost"
            onClick={toggleContextualData}
            className="w-full flex items-center justify-between text-left"
          >
            <span className="flex items-center">
              <Settings className="mr-2 h-4 w-4" />
              Contextual Data Explorer
              {(state.selectedRegion || state.selectedStation) && (
                <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-600">
                  {state.selectedRegion ? 'Region Data' : 'Station Data'}
                </Badge>
              )}
            </span>
            {state.contextualDataExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronUp className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {state.contextualDataExpanded && (
          <div className="border-t border-gray-100 bg-gray-50">
            <ContextualExplorer />
          </div>
        )}
      </div>

      {/* Loading overlay for sync operations */}
      {state.syncMode && (state.mapLoading || state.insightsLoading) && (
        <div className="fixed inset-0 bg-black bg-opacity-10 flex items-center justify-center z-50 pointer-events-none">
          <Card className="p-4 shadow-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
              <span className="text-sm font-medium">
                Synchronizing insights with map selection...
              </span>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
} 