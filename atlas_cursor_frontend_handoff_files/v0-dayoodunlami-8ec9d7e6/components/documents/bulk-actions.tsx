"use client"

import { Download, Trash2, Archive } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface BulkActionsProps {
  selectedCount: number
  onBulkDelete: () => void
  onExportCSV: () => void
}

export function BulkActions({ selectedCount, onBulkDelete, onExportCSV }: BulkActionsProps) {
  if (selectedCount === 0) {
    return (
      <Button variant="outline" onClick={onExportCSV}>
        <Download className="mr-2 h-4 w-4" />
        Export CSV
      </Button>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">Actions ({selectedCount})</Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportCSV}>
          <Download className="mr-2 h-4 w-4" />
          Export Selected
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Archive className="mr-2 h-4 w-4" />
          Archive Selected
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive" onClick={onBulkDelete}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete Selected
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
