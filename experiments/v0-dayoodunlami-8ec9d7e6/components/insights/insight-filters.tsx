"use client"
import { X, Calendar, Tag, Building, Map } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { InsightFilters as InsightFiltersType } from "@/components/insights/insight-explorer"

interface InsightFiltersProps {
  filters: InsightFiltersType
  onFiltersChange: (filters: InsightFiltersType) => void
  onClose?: () => void
}

export function InsightFilters({ filters, onFiltersChange, onClose }: InsightFiltersProps) {
  const sectors = [
    { id: "rail", label: "Rail", color: "bg-blue-100 text-blue-800" },
    { id: "maritime", label: "Maritime", color: "bg-cyan-100 text-cyan-800" },
    { id: "highways", label: "Highways", color: "bg-orange-100 text-orange-800" },
    { id: "general", label: "General", color: "bg-gray-100 text-gray-800" },
  ]

  const regions = [
    "London & South East",
    "North West & Central",
    "Scotland",
    "Southern",
    "Wales & Western",
    "Eastern",
    "Yorkshire & Humber",
    "South West",
  ]

  const projectTypes = [
    "Infrastructure",
    "Modernization",
    "Electrification",
    "Digital Transformation",
    "Safety & Security",
    "Sustainability",
    "Capacity Enhancement",
    "Maintenance",
  ]

  const popularTags = [
    "AI",
    "Decarbonization",
    "Electrification",
    "Digital",
    "Safety",
    "Innovation",
    "Sustainability",
    "Automation",
    "IoT",
    "Analytics",
  ]

  const handleSectorChange = (sectorId: string, checked: boolean) => {
    const newSectors = checked ? [...filters.sectors, sectorId] : filters.sectors.filter((s) => s !== sectorId)

    onFiltersChange({ ...filters, sectors: newSectors })
  }

  const handleRegionChange = (region: string, checked: boolean) => {
    const newRegions = checked ? [...filters.regions, region] : filters.regions.filter((r) => r !== region)

    onFiltersChange({ ...filters, regions: newRegions })
  }

  const handleTagChange = (tag: string, checked: boolean) => {
    const newTags = checked ? [...filters.tags, tag] : filters.tags.filter((t) => t !== tag)

    onFiltersChange({ ...filters, tags: newTags })
  }

  const handleProjectTypeChange = (type: string, checked: boolean) => {
    const newTypes = checked ? [...filters.projectTypes, type] : filters.projectTypes.filter((t) => t !== type)

    onFiltersChange({ ...filters, projectTypes: newTypes })
  }

  const clearAllFilters = () => {
    onFiltersChange({
      sectors: [],
      regions: [],
      tags: [],
      dateRange: { from: "", to: "" },
      projectTypes: [],
    })
  }

  const getActiveFilterCount = () => {
    return (
      filters.sectors.length +
      filters.regions.length +
      filters.tags.length +
      filters.projectTypes.length +
      (filters.dateRange.from || filters.dateRange.to ? 1 : 0)
    )
  }

  return (
    <Card className="h-fit">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5" />
            Filters
            {getActiveFilterCount() > 0 && (
              <Badge variant="secondary" className="ml-2">
                {getActiveFilterCount()}
              </Badge>
            )}
          </CardTitle>
          {onClose && (
            <Button variant="ghost" size="icon" onClick={onClose} className="lg:hidden">
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        {getActiveFilterCount() > 0 && (
          <Button variant="outline" size="sm" onClick={clearAllFilters}>
            Clear All
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Date Range */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Calendar className="h-4 w-4" />
            Date Range
          </Label>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">From</Label>
              <Input
                type="date"
                value={filters.dateRange.from}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    dateRange: { ...filters.dateRange, from: e.target.value },
                  })
                }
                className="text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">To</Label>
              <Input
                type="date"
                value={filters.dateRange.to}
                onChange={(e) =>
                  onFiltersChange({
                    ...filters,
                    dateRange: { ...filters.dateRange, to: e.target.value },
                  })
                }
                className="text-xs"
              />
            </div>
          </div>
        </div>

        {/* Sectors */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Building className="h-4 w-4" />
            Sectors
          </Label>
          <div className="space-y-2">
            {sectors.map((sector) => (
              <div key={sector.id} className="flex items-center space-x-2">
                <Checkbox
                  id={`sector-${sector.id}`}
                  checked={filters.sectors.includes(sector.id)}
                  onCheckedChange={(checked) => handleSectorChange(sector.id, checked as boolean)}
                />
                <Label htmlFor={`sector-${sector.id}`} className="text-sm font-normal">
                  {sector.label}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Regions */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Map className="h-4 w-4" />
            Regions
          </Label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {regions.map((region) => (
              <div key={region} className="flex items-center space-x-2">
                <Checkbox
                  id={`region-${region}`}
                  checked={filters.regions.includes(region)}
                  onCheckedChange={(checked) => handleRegionChange(region, checked as boolean)}
                />
                <Label htmlFor={`region-${region}`} className="text-sm font-normal">
                  {region}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Project Types */}
        <div className="space-y-3">
          <Label className="text-sm font-medium">Project Types</Label>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {projectTypes.map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <Checkbox
                  id={`type-${type}`}
                  checked={filters.projectTypes.includes(type)}
                  onCheckedChange={(checked) => handleProjectTypeChange(type, checked as boolean)}
                />
                <Label htmlFor={`type-${type}`} className="text-sm font-normal">
                  {type}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Tag className="h-4 w-4" />
            Popular Tags
          </Label>
          <div className="flex flex-wrap gap-2">
            {popularTags.map((tag) => (
              <Button
                key={tag}
                variant={filters.tags.includes(tag) ? "default" : "outline"}
                size="sm"
                onClick={() => handleTagChange(tag, !filters.tags.includes(tag))}
                className="text-xs h-7"
              >
                {tag}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
