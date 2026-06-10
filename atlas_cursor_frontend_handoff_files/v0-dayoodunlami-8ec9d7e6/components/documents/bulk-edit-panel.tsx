"use client"

import { useState } from "react"
import { Save, X, Tag, FileText, Building, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import type { UseCase } from "@/lib/api-client"

interface BulkEditData {
  title: string
  sector: string
  useCase: string
  tags: string
}

interface BulkEditPanelProps {
  selectedCount: number
  bulkEditData: BulkEditData
  onBulkEditDataChange: (data: BulkEditData) => void
  onApplyBulkEdit: () => void
  onClearSelection: () => void
}

export function BulkEditPanel({
  selectedCount,
  bulkEditData,
  onBulkEditDataChange,
  onApplyBulkEdit,
  onClearSelection,
}: BulkEditPanelProps) {
  const [enabledFields, setEnabledFields] = useState({
    title: false,
    sector: false,
    useCase: false,
    tags: false,
  })

  const useCaseOptions: { value: UseCase; label: string }[] = [
    { value: "quick-playbook", label: "Quick Playbook Answers" },
    { value: "lessons-learned", label: "Lessons Learned" },
    { value: "project-review", label: "Project Review / MOT" },
    { value: "trl-mapping", label: "TRL / RIRL Mapping" },
    { value: "project-similarity", label: "Project Similarity" },
    { value: "change-management", label: "Change Management" },
    { value: "product-acceptance", label: "Product Acceptance" },
  ]

  const handleFieldToggle = (field: keyof typeof enabledFields, enabled: boolean) => {
    setEnabledFields((prev) => ({ ...prev, [field]: enabled }))
    if (!enabled) {
      // Clear the field value when disabled
      onBulkEditDataChange({ ...bulkEditData, [field]: "" })
    }
  }

  const handleApply = () => {
    // Only apply changes for enabled fields
    const filteredData = Object.entries(bulkEditData).reduce(
      (acc, [key, value]) => {
        if (enabledFields[key as keyof typeof enabledFields] && value) {
          acc[key as keyof BulkEditData] = value
        }
        return acc
      },
      {} as Partial<BulkEditData>,
    )

    onApplyBulkEdit()
  }

  const hasEnabledFields = Object.values(enabledFields).some(Boolean)
  const hasValidData = Object.entries(bulkEditData).some(
    ([key, value]) => enabledFields[key as keyof typeof enabledFields] && value,
  )

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Update Multiple Documents at Once</CardTitle>
          <Button variant="ghost" size="icon" onClick={onClearSelection}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Changes will be applied to {selectedCount} currently selected documents. Make sure your filters are set
          correctly.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          {/* Document Title */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="update-title"
                checked={enabledFields.title}
                onCheckedChange={(checked) => handleFieldToggle("title", checked as boolean)}
              />
              <Label htmlFor="update-title" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Update Document Title
              </Label>
            </div>
            <Input
              placeholder="New title for selected documents"
              value={bulkEditData.title}
              onChange={(e) => onBulkEditDataChange({ ...bulkEditData, title: e.target.value })}
              disabled={!enabledFields.title}
              className="ml-6"
            />
          </div>

          {/* Sector */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="update-sector"
                checked={enabledFields.sector}
                onCheckedChange={(checked) => handleFieldToggle("sector", checked as boolean)}
              />
              <Label htmlFor="update-sector" className="flex items-center gap-2">
                <Building className="h-4 w-4" />
                Update Sector
              </Label>
            </div>
            <Select
              value={bulkEditData.sector}
              onValueChange={(value) => onBulkEditDataChange({ ...bulkEditData, sector: value })}
              disabled={!enabledFields.sector}
            >
              <SelectTrigger className="ml-6">
                <SelectValue placeholder="Select sector" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rail">Rail</SelectItem>
                <SelectItem value="maritime">Maritime</SelectItem>
                <SelectItem value="highways">Highways</SelectItem>
                <SelectItem value="general">General</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Use Case */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="update-usecase"
                checked={enabledFields.useCase}
                onCheckedChange={(checked) => handleFieldToggle("useCase", checked as boolean)}
              />
              <Label htmlFor="update-usecase" className="flex items-center gap-2">
                <Target className="h-4 w-4" />
                Update Use Case
              </Label>
            </div>
            <Select
              value={bulkEditData.useCase}
              onValueChange={(value) => onBulkEditDataChange({ ...bulkEditData, useCase: value })}
              disabled={!enabledFields.useCase}
            >
              <SelectTrigger className="ml-6">
                <SelectValue placeholder="Select use case" />
              </SelectTrigger>
              <SelectContent>
                {useCaseOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tags */}
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="update-tags"
                checked={enabledFields.tags}
                onCheckedChange={(checked) => handleFieldToggle("tags", checked as boolean)}
              />
              <Label htmlFor="update-tags" className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Update Tags
              </Label>
            </div>
            <Input
              placeholder="Add tags (comma separated)"
              value={bulkEditData.tags}
              onChange={(e) => onBulkEditDataChange({ ...bulkEditData, tags: e.target.value })}
              disabled={!enabledFields.tags}
              className="ml-6"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t">
          <div className="text-sm text-muted-foreground">
            {hasEnabledFields ? (
              <span>{Object.values(enabledFields).filter(Boolean).length} field(s) selected for update</span>
            ) : (
              <span>Select fields to update</span>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClearSelection}>
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={!hasEnabledFields || !hasValidData}
              className="bg-primary hover:bg-primary/90"
            >
              <Save className="mr-2 h-4 w-4" />
              Apply Changes ({selectedCount})
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
