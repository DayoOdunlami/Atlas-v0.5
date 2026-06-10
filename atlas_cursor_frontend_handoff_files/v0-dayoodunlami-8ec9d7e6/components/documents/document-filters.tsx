"use client"

import { Filter, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import type { DocumentFilters as Filters } from "@/lib/api-client"

interface DocumentFiltersProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
}

export function DocumentFilters({ filters, onFiltersChange }: DocumentFiltersProps) {
  const activeFiltersCount = Object.values(filters).filter(Boolean).length

  const clearFilters = () => {
    onFiltersChange({})
  }

  const updateFilter = (key: keyof Filters, value: string | undefined) => {
    onFiltersChange({
      ...filters,
      [key]: value || undefined,
    })
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" className="relative">
          <Filter className="mr-2 h-4 w-4" />
          Filters
          {activeFiltersCount > 0 && (
            <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
              {activeFiltersCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filters</h4>
            {activeFiltersCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-3 w-3" />
                Clear all
              </Button>
            )}
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium">Sector</label>
              <Select value={filters.sector || ""} onValueChange={(value) => updateFilter("sector", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All sectors" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sectors</SelectItem>
                  <SelectItem value="rail">Rail</SelectItem>
                  <SelectItem value="maritime">Maritime</SelectItem>
                  <SelectItem value="highways">Highways</SelectItem>
                  <SelectItem value="general">General</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Use Case</label>
              <Select value={filters.useCase || ""} onValueChange={(value) => updateFilter("useCase", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="All use cases" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All use cases</SelectItem>
                  <SelectItem value="quick-playbook">Quick Playbook</SelectItem>
                  <SelectItem value="lessons-learned">Lessons Learned</SelectItem>
                  <SelectItem value="project-review">Project Review</SelectItem>
                  <SelectItem value="trl-mapping">TRL Mapping</SelectItem>
                  <SelectItem value="project-similarity">Project Similarity</SelectItem>
                  <SelectItem value="change-management">Change Management</SelectItem>
                  <SelectItem value="product-acceptance">Product Acceptance</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">Date From</label>
                <input
                  type="date"
                  value={filters.dateFrom || ""}
                  onChange={(e) => updateFilter("dateFrom", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date To</label>
                <input
                  type="date"
                  value={filters.dateTo || ""}
                  onChange={(e) => updateFilter("dateTo", e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
