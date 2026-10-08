"use client"

import React from 'react'
import { useGeoInsight } from './geo-insight-provider'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { 
  MapPin, 
  Users, 
  Building, 
  Route, 
  ExternalLink,
  Activity,
  FileText,
  ArrowRight
} from 'lucide-react'

export function ContextualExplorer() {
  const { state } = useGeoInsight()

  if (!state.selectedRegion && !state.selectedStation) {
    return (
      <div className="p-8 text-center">
        <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full">
          <MapPin className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-400 mb-1">No Selection</h3>
        <p className="text-sm text-gray-500">
          Select a region or station on the map to explore contextual data
        </p>
      </div>
    )
  }

  return (
    <div className="p-6 max-h-96 overflow-y-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* Region Information */}
        {state.selectedRegion && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Building className="mr-2 h-4 w-4 text-blue-600" />
                  Region Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium text-gray-900">{state.selectedRegion.name}</h4>
                  <p className="text-sm text-gray-600 mt-1">
                    Network Rail region with comprehensive railway infrastructure
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Director</span>
                    <span className="font-medium">{state.selectedRegion.director}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Active Projects</span>
                    <Badge className="bg-blue-50 text-blue-600">
                      {state.selectedRegion.projects || 15}
                    </Badge>
                  </div>
                </div>

                <Button className="w-full" size="sm">
                  <ExternalLink className="mr-2 h-3 w-3" />
                  View Details
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Users className="mr-2 h-4 w-4 text-green-600" />
                  Network Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      2,500
                    </div>
                    <div className="text-xs text-gray-500">Route Miles</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">
                      450
                    </div>
                    <div className="text-xs text-gray-500">Stations</div>
                  </div>
                </div>
                
                <Separator />
                
                <div className="text-center">
                  <div className="text-lg font-bold text-purple-600">
                    15,000+
                  </div>
                  <div className="text-xs text-gray-500">Employees</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Route className="mr-2 h-4 w-4 text-orange-600" />
                  Key Routes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center text-sm">
                    <ArrowRight className="mr-2 h-3 w-3 text-gray-400" />
                    <span className="text-gray-700">West Coast Main Line</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <ArrowRight className="mr-2 h-3 w-3 text-gray-400" />
                    <span className="text-gray-700">East Coast Main Line</span>
                  </div>
                  <div className="flex items-center text-sm">
                    <ArrowRight className="mr-2 h-3 w-3 text-gray-400" />
                    <span className="text-gray-700">Great Western Main Line</span>
                  </div>
                  <div className="text-xs text-gray-500 italic">
                    +12 more routes
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Station Information */}
        {state.selectedStation && (
          <>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <Activity className="mr-2 h-4 w-4 text-blue-600" />
                  Station Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <h4 className="font-medium text-gray-900">{state.selectedStation.name}</h4>
                  <div className="flex items-center mt-1 text-sm text-gray-600">
                    <MapPin className="mr-1 h-3 w-3" />
                    Code: {state.selectedStation.code}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Type</span>
                    <Badge className="bg-blue-50 text-blue-600">
                      {state.selectedStation.type}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Status</span>
                    <Badge className="bg-green-50 text-green-600">
                      {state.selectedStation.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Region</span>
                    <span className="font-medium">{state.selectedStation.region}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <FileText className="mr-2 h-4 w-4 text-green-600" />
                  Active Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="border-l-2 border-blue-200 pl-3">
                    <h5 className="font-medium text-sm text-gray-900">
                      Platform Enhancement
                    </h5>
                    <p className="text-xs text-gray-600 mt-1">
                      Modernizing platform facilities and accessibility features
                    </p>
                    <div className="flex items-center justify-between mt-2">
                      <Badge className="bg-green-50 text-green-600">
                        Active
                      </Badge>
                      <span className="text-xs text-gray-500">
                        12 docs
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center text-base">
                  <MapPin className="mr-2 h-4 w-4 text-purple-600" />
                  Location Data
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm">
                  <div className="text-gray-500 mb-1">Coordinates</div>
                  <div className="font-mono text-xs bg-gray-50 p-2 rounded">
                    {state.selectedStation.coordinates[1].toFixed(6)}, {state.selectedStation.coordinates[0].toFixed(6)}
                  </div>
                </div>
                
                <Button className="w-full" size="sm">
                  <ExternalLink className="mr-2 h-3 w-3" />
                  View on Maps
                </Button>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  )
} 