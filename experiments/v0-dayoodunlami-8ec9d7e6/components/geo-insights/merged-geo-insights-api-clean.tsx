"use client"

import React, { useState, useEffect } from "react"
import { Search, Filter, BarChart3, Sparkles, Map, Layers, Download, RefreshCw, RotateCcw, Hash } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { RailwayMapApiClean } from "@/components/map/railway-map-api-clean"
import { MetricsOverview } from "@/components/insights/metrics-overview"

export interface GeneratedInsight {
  id: string
  question: string
  chartType: "bar" | "line" | "pie" | "map" | "scatter" | "heatmap"
  data: any[]
  title: string
  description: string
  timestamp: Date
  region?: string
}

export function MergedGeoInsightsApiClean() {
  // Map state
  const [selectedRegion, setSelectedRegion] = useState<any>(null)
  const [mapLoading, setMapLoading] = useState(true)

  // Insights state  
  const [query, setQuery] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedInsights, setGeneratedInsights] = useState<GeneratedInsight[]>([])
  
  // Unified state
  const [syncMode, setSyncMode] = useState(true)
  const [viewMode, setViewMode] = useState<'split' | 'map' | 'insights'>('split')

  // Handle region selection from map - this will show region info in sidebar
  const handleRegionSelect = (regionInfo: any) => {
    setSelectedRegion(regionInfo)
  }

  // Auto-generate insights when region is selected in sync mode
  useEffect(() => {
    if (syncMode && selectedRegion?.region) {
      const regionName = selectedRegion.region.name
      const autoQuery = `Show strategic insights and project analysis for ${regionName} region`
      generateInsightForRegion(autoQuery, selectedRegion.region.code)
    }
  }, [selectedRegion, syncMode])

  const generateInsightForRegion = async (question: string, regionCode: string) => {
    setIsGenerating(true)
    
    // Simulate AI processing
    setTimeout(() => {
      const newInsight: GeneratedInsight = {
        id: Date.now().toString(),
        question,
        chartType: "bar",
        data: [
          { name: 'Active Projects', value: Math.floor(Math.random() * 50 + 10), color: '#3b82f6' },
          { name: 'Strategic Documents', value: Math.floor(Math.random() * 100 + 20), color: '#10b981' },
          { name: 'Route Miles', value: selectedRegion?.region?.route_miles || Math.floor(Math.random() * 1000 + 500), color: '#f59e0b' },
          { name: 'Stations', value: selectedRegion?.region?.stations || Math.floor(Math.random() * 200 + 50), color: '#ef4444' }
        ],
        title: `${selectedRegion?.region?.name || 'Region'} Analysis`,
        description: `AI-generated insights for ${selectedRegion?.region?.name || 'selected region'} showing project distribution, infrastructure metrics, and strategic priorities. Data sourced from Network Rail and project databases.`,
        timestamp: new Date(),
        region: regionCode
      }
      
      setGeneratedInsights(prev => [newInsight, ...prev].slice(0, 5)) // Keep latest 5
      setIsGenerating(false)
    }, 1500)
  }

  const handleManualInsightGeneration = async () => {
    if (!query.trim()) return
    
    setIsGenerating(true)
    
    setTimeout(() => {
      const newInsight: GeneratedInsight = {
        id: Date.now().toString(),
        question: query,
        chartType: "bar",
        data: generateMockData(query),
        title: generateInsightTitle(query),
        description: `AI-generated visualization based on your query: "${query}". Analysis includes data from ${Math.floor(Math.random() * 500 + 100)} documents across multiple sectors.`,
        timestamp: new Date()
      }
      
      setGeneratedInsights(prev => [newInsight, ...prev].slice(0, 5))
      setQuery("")
      setIsGenerating(false)
    }, 2000)
  }

  const generateMockData = (question: string) => {
    if (question.toLowerCase().includes("region")) {
      return [
        { name: "Scotland", value: 28, projects: 15 },
        { name: "Eastern", value: 45, projects: 23 },
        { name: "North West & Central", value: 32, projects: 18 },
        { name: "Southern", value: 38, projects: 21 },
        { name: "Wales & Western", value: 22, projects: 12 }
      ]
    }
    return [
      { name: "Rail Infrastructure", value: 120, documents: 89 },
      { name: "Station Upgrades", value: 82, documents: 67 },
      { name: "Electrification", value: 67, documents: 45 },
      { name: "Accessibility", value: 45, documents: 32 }
    ]
  }

  const generateInsightTitle = (question: string) => {
    if (question.toLowerCase().includes("region")) return "Regional Comparison"
    if (question.toLowerCase().includes("project")) return "Project Analysis"
    if (question.toLowerCase().includes("trend")) return "Trend Analysis"
    return "Railway Network Insights"
  }

  const getGridClasses = () => {
    switch (viewMode) {
      case 'map': return 'grid-cols-1'
      case 'insights': return 'grid-cols-1' 
      default: return 'grid-cols-1 lg:grid-cols-5'
    }
  }

  const getMapClasses = () => {
    switch (viewMode) {
      case 'map': return 'col-span-full'
      case 'insights': return 'hidden'
      default: return 'lg:col-span-3'
    }
  }

  const getInsightsClasses = () => {
    switch (viewMode) {
      case 'map': return 'hidden'
      case 'insights': return 'col-span-full'
      default: return 'lg:col-span-2'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center">
              <Map className="mr-3 h-7 w-7 text-blue-600" />
              Geospatial Analytics Dashboard
            </h1>
            <p className="text-muted-foreground">Interactive railway map with live API data</p>
          </div>
          
          {/* Selection indicators */}
          {selectedRegion && (
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {selectedRegion.region.name} Selected
            </Badge>
          )}
        </div>
        
        {/* Controls */}
        <div className="flex items-center space-x-4">
          {/* Sync toggle */}
          <div className="flex items-center space-x-2">
            <label className="text-sm font-medium">Auto Insights</label>
            <Switch
              checked={syncMode}
              onCheckedChange={setSyncMode}
            />
            {syncMode ? (
              <RefreshCw className="h-4 w-4 text-blue-600" />
            ) : (
              <RotateCcw className="h-4 w-4 text-gray-400" />
            )}
          </div>
          
          <Separator orientation="vertical" className="h-6" />
          
          {/* View mode controls */}
          <div className="flex items-center space-x-1">
            <Button
              variant={viewMode === 'map' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('map')}
            >
              <Map className="h-4 w-4 mr-1" />
              Map
            </Button>
            <Button
              variant={viewMode === 'split' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('split')}
            >
              <BarChart3 className="h-4 w-4 mr-1" />
              Split
            </Button>
            <Button
              variant={viewMode === 'insights' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('insights')}
            >
              <Sparkles className="h-4 w-4 mr-1" />
              Insights
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className={`grid ${getGridClasses()} gap-6`}>
        {/* Map Panel */}
        <Card className={`${getMapClasses()} overflow-hidden`}>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="flex items-center text-lg font-semibold">
                  <Map className="mr-2 h-5 w-5 text-blue-600" />
                  🗺️ Railway Regions (Live API Data)
                </span>
                <span className="text-sm text-muted-foreground font-normal ml-7">
                  Click regions to explore Network Rail data and generate insights
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  <Layers className="mr-2 h-4 w-4" />
                  Layers
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-auto transition-all duration-300">
              <RailwayMapApiClean 
                height={700} 
                onRegionSelect={handleRegionSelect}
              />
            </div>
          </CardContent>
        </Card>

        {/* Insights Panel */}
        <div className={`${getInsightsClasses()} space-y-6`}>
          {/* Selected Region Info - Only in sidebar when selected */}
          {selectedRegion && (
            <Card className="border-l-4 transition-all duration-300" style={{ borderLeftColor: selectedRegion.region.color }}>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: selectedRegion.region.color }}
                    />
                    {selectedRegion.region.name} ({selectedRegion.region.code})
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setSelectedRegion(null)}
                  >
                    ✕
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {/* Director Information */}
                <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800">
                  <p className="font-semibold text-blue-700 dark:text-blue-300 text-sm mb-1">👤 Regional Director</p>
                  <p className="text-blue-600 dark:text-blue-400 text-sm">{selectedRegion.region.director}</p>
                </div>

                {/* Statistics Grid */}
                <div className="grid grid-cols-3 gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-600">
                      {selectedRegion.region.route_miles.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Route Miles</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-blue-600">
                      {selectedRegion.region.stations.toLocaleString()}
                    </p>
                    <p className="text-xs text-muted-foreground">Stations</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-orange-600">
                      {selectedRegion.region.cpc_projects}
                    </p>
                    <p className="text-xs text-muted-foreground">CPC Projects</p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-muted-foreground mb-3">
                  {selectedRegion.region.description}
                </p>

                {selectedRegion.clickedDistrict && (
                  <div className="text-xs text-muted-foreground">
                    Clicked: {selectedRegion.clickedDistrict.name}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* AI Query Input */}
          <Card>
            <CardContent className="p-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="font-semibold">Ask about the railway network</h3>
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      placeholder="e.g., Compare infrastructure projects across regions..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleManualInsightGeneration()}
                      className="pl-9"
                    />
                  </div>
                  <Button
                    onClick={handleManualInsightGeneration}
                    disabled={!query.trim() || isGenerating}
                    size="sm"
                  >
                    {isGenerating ? (
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    ) : (
                      <BarChart3 className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Generated Insights */}
          <div className="space-y-4">
            {generatedInsights.length > 0 && (
              <div>
                <h3 className="font-semibold mb-3 flex items-center">
                  <BarChart3 className="mr-2 h-4 w-4" />
                  Generated Insights ({generatedInsights.length})
                </h3>
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {generatedInsights.map((insight) => (
                    <Card key={insight.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="font-medium text-sm">{insight.title}</h4>
                          {insight.region && (
                            <Badge variant="outline" className="text-xs">
                              {insight.region}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {insight.description}
                        </p>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{insight.timestamp.toLocaleTimeString()}</span>
                          <Badge variant="outline" className="text-xs">
                            {insight.chartType}
                          </Badge>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              </div>
            )}
            
            {generatedInsights.length === 0 && (
              <Card className="p-8 text-center">
                <Sparkles className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="font-medium text-muted-foreground mb-2">No insights yet</h3>
                <p className="text-sm text-muted-foreground">
                  {syncMode 
                    ? "Click on a region in the map to auto-generate insights"
                    : "Ask a question or enable auto insights to get started"
                  }
                </p>
              </Card>
            )}
          </div>

          {/* Network Analytics */}
          <div className="space-y-4">
            <h3 className="font-semibold">Network Analytics</h3>
            <div className="space-y-4">
              {/* Project Density by Region */}
              <Card className="p-4">
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <BarChart3 className="mr-2 h-4 w-4 text-blue-600" />
                    Project Density by Region
                  </h4>
                  <div className="space-y-2">
                    {[
                      { name: 'Southern', projects: 47, density: 'High', color: 'bg-red-500' },
                      { name: 'Eastern', projects: 34, density: 'Medium', color: 'bg-blue-500' },
                      { name: 'Scotland', projects: 28, density: 'Medium', color: 'bg-purple-500' },
                      { name: 'North West & Central', projects: 31, density: 'Medium', color: 'bg-orange-500' },
                      { name: 'Wales & Western', projects: 19, density: 'Low', color: 'bg-green-500' }
                    ].map(region => (
                      <div key={region.name} className="flex items-center justify-between p-2 bg-muted/30 rounded">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded ${region.color}`} />
                          <span className="text-sm font-medium">{region.name}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground">{region.projects} projects</span>
                          <Badge variant={region.density === 'High' ? 'destructive' : region.density === 'Medium' ? 'default' : 'secondary'} className="text-xs">
                            {region.density}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>

              {/* Popular Tags */}
              <Card className="p-4">
                <div className="space-y-3">
                  <h4 className="font-medium flex items-center">
                    <Hash className="mr-2 h-4 w-4 text-green-600" />
                    Popular Tags
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { tag: 'electrification', count: 127, color: 'bg-blue-100 text-blue-800' },
                      { tag: 'accessibility', count: 89, color: 'bg-green-100 text-green-800' },
                      { tag: 'station-upgrade', count: 76, color: 'bg-purple-100 text-purple-800' },
                      { tag: 'safety', count: 65, color: 'bg-red-100 text-red-800' },
                      { tag: 'capacity', count: 54, color: 'bg-orange-100 text-orange-800' },
                      { tag: 'digitalization', count: 43, color: 'bg-indigo-100 text-indigo-800' },
                      { tag: 'sustainability', count: 38, color: 'bg-emerald-100 text-emerald-800' },
                      { tag: 'freight', count: 29, color: 'bg-amber-100 text-amber-800' }
                    ].map(item => (
                      <Badge key={item.tag} className={`${item.color} text-xs px-2 py-1`} variant="secondary">
                        #{item.tag} ({item.count})
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Based on 159 documents and 89 active projects across all regions
                  </p>
                </div>
              </Card>

              {/* Quick Overview */}
              <Card className="p-4">
                <MetricsOverview />
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 