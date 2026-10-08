"use client"

import { useState } from "react"
import { Plus, Edit, Trash2, FileText, Lightbulb } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

interface UseCase {
  id: string
  name: string
  description: string
  promptTemplate?: string
  color: string
  category: string
}

export function UseCaseManager() {
  const [useCases, setUseCases] = useState<UseCase[]>([
    {
      id: "quick-playbook",
      name: "Quick Playbook Answers",
      description: "Rapid access to procedural guidance and best practices",
      category: "Operational",
      color: "bg-blue-100 text-blue-800",
      promptTemplate: "Provide quick, actionable guidance from this document for immediate operational use.",
    },
    {
      id: "lessons-learned",
      name: "Lessons Learned",
      description: "Extract insights and learning points from project experiences",
      category: "Knowledge",
      color: "bg-green-100 text-green-800",
      promptTemplate: "Identify key lessons learned, challenges faced, and recommendations from this document.",
    },
    {
      id: "project-review",
      name: "Project Review / MOT",
      description: "Comprehensive project assessment and milestone tracking",
      category: "Assessment",
      color: "bg-orange-100 text-orange-800",
      promptTemplate: "Analyze this document for project performance metrics, milestones, and review criteria.",
    },
    {
      id: "trl-mapping",
      name: "TRL / RIRL Mapping",
      description: "Technology and Research Innovation Readiness Level assessment",
      category: "Assessment",
      color: "bg-purple-100 text-purple-800",
      promptTemplate: "Evaluate technology readiness levels and innovation maturity indicators in this document.",
    },
    {
      id: "project-similarity",
      name: "Project Similarity",
      description: "Identify comparable projects and cross-reference opportunities",
      category: "Analysis",
      color: "bg-cyan-100 text-cyan-800",
      promptTemplate: "Find similarities, patterns, and comparable elements that can inform related projects.",
    },
    {
      id: "change-management",
      name: "Change Management",
      description: "Organizational change processes and impact assessment",
      category: "Strategic",
      color: "bg-pink-100 text-pink-800",
      promptTemplate: "Analyze change management aspects, stakeholder impacts, and transformation strategies.",
    },
  ])

  const [editingUseCase, setEditingUseCase] = useState<UseCase | null>(null)
  const [newUseCase, setNewUseCase] = useState<Partial<UseCase>>({
    name: "",
    description: "",
    category: "Operational",
    promptTemplate: "",
    color: "bg-gray-100 text-gray-800",
  })
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const categories = ["Operational", "Knowledge", "Assessment", "Analysis", "Strategic"]
  const colorOptions = [
    "bg-blue-100 text-blue-800",
    "bg-green-100 text-green-800",
    "bg-orange-100 text-orange-800",
    "bg-purple-100 text-purple-800",
    "bg-cyan-100 text-cyan-800",
    "bg-pink-100 text-pink-800",
    "bg-yellow-100 text-yellow-800",
    "bg-gray-100 text-gray-800",
  ]

  const createUseCase = () => {
    if (!newUseCase.name?.trim()) return

    const useCase: UseCase = {
      id: newUseCase.name.toLowerCase().replace(/\s+/g, "-"),
      name: newUseCase.name,
      description: newUseCase.description || "",
      category: newUseCase.category || "Operational",
      promptTemplate: newUseCase.promptTemplate || "",
      color: newUseCase.color || "bg-gray-100 text-gray-800",
    }

    setUseCases((prev) => [...prev, useCase])
    setNewUseCase({
      name: "",
      description: "",
      category: "Operational",
      promptTemplate: "",
      color: "bg-gray-100 text-gray-800",
    })
    setIsCreateDialogOpen(false)
  }

  const updateUseCase = () => {
    if (!editingUseCase) return

    setUseCases((prev) => prev.map((useCase) => (useCase.id === editingUseCase.id ? editingUseCase : useCase)))
    setEditingUseCase(null)
    setIsEditDialogOpen(false)
  }

  const deleteUseCase = (useCaseId: string) => {
    setUseCases((prev) => prev.filter((useCase) => useCase.id !== useCaseId))
  }

  const groupedUseCases = categories.reduce(
    (acc, category) => {
      acc[category] = useCases.filter((useCase) => useCase.category === category)
      return acc
    },
    {} as Record<string, UseCase[]>,
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Use Case Management</h2>
          <p className="text-muted-foreground">Define and manage document use cases with AI prompt templates</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Use Case
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Use Case</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Use Case Name</Label>
                <Input
                  placeholder="e.g., Risk Assessment"
                  value={newUseCase.name || ""}
                  onChange={(e) => setNewUseCase((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description of this use case..."
                  value={newUseCase.description || ""}
                  onChange={(e) => setNewUseCase((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                <select
                  className="w-full p-2 border rounded-md"
                  value={newUseCase.category || "Operational"}
                  onChange={(e) => setNewUseCase((prev) => ({ ...prev, category: e.target.value }))}
                >
                  {categories.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label>Color Theme</Label>
                <div className="flex flex-wrap gap-2">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      className={`w-8 h-8 rounded-full border-2 ${color} ${
                        newUseCase.color === color ? "border-primary" : "border-transparent"
                      }`}
                      onClick={() => setNewUseCase((prev) => ({ ...prev, color }))}
                    />
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <Label>AI Prompt Template</Label>
                <Textarea
                  placeholder="Template for AI analysis specific to this use case..."
                  value={newUseCase.promptTemplate || ""}
                  onChange={(e) => setNewUseCase((prev) => ({ ...prev, promptTemplate: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createUseCase}>Create Use Case</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-6">
        {categories.map((category) => (
          <div key={category}>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {category} Use Cases ({groupedUseCases[category]?.length || 0})
            </h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {groupedUseCases[category]?.map((useCase) => (
                <Card key={useCase.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={useCase.color}>{useCase.category}</Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Dialog
                          open={isEditDialogOpen && editingUseCase?.id === useCase.id}
                          onOpenChange={setIsEditDialogOpen}
                        >
                          <DialogTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => setEditingUseCase({ ...useCase })}>
                              <Edit className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-2xl">
                            <DialogHeader>
                              <DialogTitle>Edit Use Case</DialogTitle>
                            </DialogHeader>
                            {editingUseCase && (
                              <div className="space-y-4">
                                <div className="space-y-2">
                                  <Label>Use Case Name</Label>
                                  <Input
                                    value={editingUseCase.name}
                                    onChange={(e) =>
                                      setEditingUseCase((prev) => (prev ? { ...prev, name: e.target.value } : null))
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Description</Label>
                                  <Textarea
                                    value={editingUseCase.description}
                                    onChange={(e) =>
                                      setEditingUseCase((prev) =>
                                        prev ? { ...prev, description: e.target.value } : null,
                                      )
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Category</Label>
                                  <select
                                    className="w-full p-2 border rounded-md"
                                    value={editingUseCase.category}
                                    onChange={(e) =>
                                      setEditingUseCase((prev) => (prev ? { ...prev, category: e.target.value } : null))
                                    }
                                  >
                                    {categories.map((category) => (
                                      <option key={category} value={category}>
                                        {category}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div className="space-y-2">
                                  <Label>Color Theme</Label>
                                  <div className="flex flex-wrap gap-2">
                                    {colorOptions.map((color) => (
                                      <button
                                        key={color}
                                        className={`w-8 h-8 rounded-full border-2 ${color} ${
                                          editingUseCase.color === color ? "border-primary" : "border-transparent"
                                        }`}
                                        onClick={() => setEditingUseCase((prev) => (prev ? { ...prev, color } : null))}
                                      />
                                    ))}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>AI Prompt Template</Label>
                                  <Textarea
                                    value={editingUseCase.promptTemplate || ""}
                                    onChange={(e) =>
                                      setEditingUseCase((prev) =>
                                        prev ? { ...prev, promptTemplate: e.target.value } : null,
                                      )
                                    }
                                    rows={3}
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                    Cancel
                                  </Button>
                                  <Button onClick={updateUseCase}>Save Changes</Button>
                                </div>
                              </div>
                            )}
                          </DialogContent>
                        </Dialog>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteUseCase(useCase.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-base">{useCase.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{useCase.description}</p>

                    {useCase.promptTemplate && (
                      <>
                        <Separator />
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <Lightbulb className="h-4 w-4" />
                            <span className="text-sm font-medium">AI Prompt Template</span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">{useCase.promptTemplate}</p>
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
