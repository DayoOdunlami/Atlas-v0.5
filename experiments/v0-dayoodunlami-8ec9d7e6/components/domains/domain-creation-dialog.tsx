"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface DomainCreationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function DomainCreationDialog({ open, onOpenChange }: DomainCreationDialogProps) {
  const [newDomain, setNewDomain] = useState({
    name: "",
    description: "",
    color: "bg-gray-100 text-gray-800 border-gray-200",
  })

  const colorOptions = [
    "bg-blue-100 text-blue-800 border-blue-200",
    "bg-green-100 text-green-800 border-green-200",
    "bg-orange-100 text-orange-800 border-orange-200",
    "bg-purple-100 text-purple-800 border-purple-200",
    "bg-cyan-100 text-cyan-800 border-cyan-200",
    "bg-pink-100 text-pink-800 border-pink-200",
    "bg-yellow-100 text-yellow-800 border-yellow-200",
    "bg-gray-100 text-gray-800 border-gray-200",
  ]

  const createDomain = () => {
    if (!newDomain.name.trim()) return

    // Domain creation logic would go here
    console.log("Creating domain:", newDomain)

    // Reset form
    setNewDomain({
      name: "",
      description: "",
      color: "bg-gray-100 text-gray-800 border-gray-200",
    })
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Create Domain
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Domain</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Domain Name</Label>
            <Input
              placeholder="e.g., Aviation Transport"
              value={newDomain.name}
              onChange={(e) => setNewDomain((prev) => ({ ...prev, name: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Brief description of this domain..."
              value={newDomain.description}
              onChange={(e) => setNewDomain((prev) => ({ ...prev, description: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <Label>Color Theme</Label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  className={`w-8 h-8 rounded-full border-2 ${color} ${
                    newDomain.color === color ? "border-primary" : "border-transparent"
                  }`}
                  onClick={() => setNewDomain((prev) => ({ ...prev, color }))}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={createDomain}>Create Domain</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
