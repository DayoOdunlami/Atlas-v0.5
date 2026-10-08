"use client"

import React from 'react'
import { useGeoInsight } from './geo-insight-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Target, 
  Clock,
  Lightbulb,
  MapPin,
  Activity,
  RefreshCw,
  Filter,
  BarChart3
} from 'lucide-react'

export function MapInsightsPanel() {
  const { state, generateInsightForRegion, generateInsightForStation, updateFilters } = useGeoInsight()

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend':
        return <TrendingUp className="h-4 w-4" />
      case 'comparison':
        return <BarChart3 className="h-4 w-4" />
      case 'prediction':
        return <Target className="h-4 w-4" />
      case 'anomaly':
        return <AlertCircle className="h-4 w-4" />
      default:
        return <Activity className="h-4 w-4" />
    }
  }

  const getInsightColor = (type: string) => {
    switch (type) {
      case 'trend':
        return 'bg-blue-50 text-blue-700 border-blue-200'
      case 'comparison':
        return 'bg-green-50 text-green-700 border-green-200'
      case 'prediction':
        return 'bg-purple-50 text-purple-700 border-purple-200'
      case 'anomaly':
        return 'bg-red-50 text-red-700 border-red-200'
      default:
        return 'bg-gray-50 text-gray-700 border-gray-200'
    }
  }

  const handleGenerateInsight = async () => {
    if (state.selectedRegion) {
      await generateInsightForRegion(state.selectedRegion)
    } else if (state.selectedStation) {
      await generateInsightForStation(state.selectedStation)
    }
  }

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-GB', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  return (
    <div className="h-full flex flex-col">
      {/* Insights Header & Controls */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <h3 className="font-semibold text-gray-900">Live Insights</h3>
            {state.insights.length > 0 && (
              <Badge variant="outline" className="bg-blue-50 text-blue-600">
                {state.insights.length} active
              </Badge>
            )}
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateInsight}
              disabled={state.insightsLoading || (!state.selectedRegion && !state.selectedStation)}
              className="flex items-center space-x-1"
            >
              {state.insightsLoading ? (
                <RefreshCw className="h-3 w-3 animate-spin" />
              ) : (
                <Lightbulb className="h-3 w-3" />
              )}
              <span>Generate</span>
            </Button>
          </div>
        </div>

        {/* Selection Status */}
        {(state.selectedRegion || state.selectedStation) ? (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            {state.selectedRegion && (
              <div className="flex items-center space-x-1">
                <MapPin className="h-3 w-3" />
                <span>Region: {state.selectedRegion.name}</span>
              </div>
            )}
            {state.selectedStation && (
              <div className="flex items-center space-x-1">
                <Activity className="h-3 w-3" />
                <span>Station: {state.selectedStation.name}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-gray-500 italic">
            Select a region or station on the map to generate insights
          </div>
        )}
      </div>

      {/* Insights List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {state.insights.length === 0 ? (
            <div className="text-center py-12">
              <Activity className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-400 mb-2">No insights yet</h3>
              <p className="text-sm text-gray-500 mb-4">
                Select a region or station on the map to get AI-powered insights
              </p>
              {(state.selectedRegion || state.selectedStation) && (
                <Button
                  onClick={handleGenerateInsight}
                  disabled={state.insightsLoading}
                  className="inline-flex items-center space-x-2"
                >
                  <Lightbulb className="h-4 w-4" />
                  <span>Generate First Insight</span>
                </Button>
              )}
            </div>
          ) : (
            state.insights.map((insight) => (
              <Card key={insight.id} className="relative">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge 
                        variant="outline" 
                        className={`${getInsightColor(insight.type)} flex items-center space-x-1`}
                      >
                        {getInsightIcon(insight.type)}
                        <span className="capitalize">{insight.type}</span>
                      </Badge>
                      <Badge variant="outline" className="bg-gray-50 text-gray-600">
                        {Math.round(insight.confidence * 100)}% confidence
                      </Badge>
                    </div>
                    <div className="flex items-center text-xs text-gray-400">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatDate(insight.createdAt)}
                    </div>
                  </div>
                  <CardTitle className="text-base text-gray-900">
                    {insight.title}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    {insight.description}
                  </p>
                  
                  <div className="flex items-center text-xs text-gray-500">
                    <span>Timeframe: {insight.timeframe}</span>
                  </div>

                  {insight.recommendations && insight.recommendations.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-2 flex items-center">
                          <Target className="h-3 w-3 mr-1" />
                          Recommendations
                        </h4>
                        <ul className="space-y-1">
                          {insight.recommendations.map((rec, index) => (
                            <li key={index} className="text-xs text-gray-600 flex items-start">
                              <span className="w-1 h-1 bg-gray-400 rounded-full mt-1.5 mr-2 flex-shrink-0"></span>
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Quick Metrics Bar */}
      {state.insights.length > 0 && (
        <div className="border-t bg-gray-50 p-4">
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-lg font-bold text-blue-600">
                {state.insights.filter(i => i.type === 'trend').length}
              </div>
              <div className="text-xs text-gray-500">Trend Analysis</div>
            </div>
            <div>
              <div className="text-lg font-bold text-green-600">
                {Math.round(state.insights.reduce((acc, i) => acc + i.confidence, 0) / state.insights.length * 100)}%
              </div>
              <div className="text-xs text-gray-500">Avg Confidence</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 