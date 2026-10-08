"use client"

import { useState } from "react"
import { Plus, Edit, Trash2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface PromptTemplate {
  id: string
  name: string
  description: string
  template: string
  category: "domain" | "use-case" | "general"
  associatedId?: string
  variables: string[]
}

export function PromptTemplates() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([
    {
      id: "rail-analysis",
      name: "Rail Infrastructure Analysis",
      description: "Comprehensive analysis template for rail transport documents",
      template:
        "Analyze this document focusing on rail infrastructure elements. Consider: 1) Infrastructure requirements and specifications, 2) Safety protocols and compliance, 3) Operational efficiency factors, 4) Cost implications and budget considerations, 5) Environmental impact assessments. Provide specific insights relevant to {{project_type}} projects in the {{region}} region.",
      category: "domain",
      associatedId: "rail",
      variables: ["project_type", "region"],
    },
    {
      id: "lessons-learned-extract",
      name: "Lessons Learned Extraction",
      description: "Extract key learning points and recommendations",
      template:
        "Extract lessons learned from this document by identifying: 1) Key challenges encountered and how they were resolved, 2) Best practices that emerged during implementation, 3) Recommendations for future similar projects, 4) Critical success factors, 5) Areas for improvement. Focus on actionable insights for {{stakeholder_type}} stakeholders working on {{project_category}} initiatives.",
      category: "use-case",
      associatedId: "lessons-learned",
      variables: ["stakeholder_type", "project_category"],
    },
    {
      id: "strategic-summary",
      name: "Strategic Document Summary",
      description: "High-level strategic analysis and summary",
      template:
        "Provide a strategic summary of this document including: 1) Executive summary of key points, 2) Strategic implications and opportunities, 3) Risk factors and mitigation strategies, 4) Resource requirements and dependencies, 5) Timeline and milestone considerations. Tailor the analysis for {{audience_level}} audience with focus on {{strategic_priority}} priorities.",
      category: "general",
      variables: ["audience_level", "strategic_priority"],
    },
  ])

  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)
  const [newTemplate, setNewTemplate] = useState<Partial<PromptTemplate>>({
    name: "",
    description: "",
    template: "",
    category: "general",
    variables: [],
  })
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const extractVariables = (template: string): string[] => {
    const matches = template.match(/\{\{([^}]+)\}\}/g)
    return matches ? matches.map((match) => match.slice(2, -2)) : []
  }

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 2000)
    } catch (err) {
      console.error("Failed to copy text: ", err)
    }
  }

  const createTemplate = () => {
    if (!newTemplate.name?.trim() || !newTemplate.template?.trim()) return

    const variables = extractVariables(newTemplate.template)
    const template: PromptTemplate = {
      id: newTemplate.name.toLowerCase().replace(/\s+/g, "-"),
      name: newTemplate.name,
      description: newTemplate.description || "",
      template: newTemplate.template,
      category: newTemplate.category || "general",
      associatedId: newTemplate.associatedId,
      variables,
    }

    setTemplates((prev) => [...prev, template])
    setNewTemplate({ name: "", description: "", template: "", category: "general", variables: [] })
    setIsCreateDialogOpen(false)
  }

  const updateTemplate = () => {
    if (!editingTemplate) return

    const variables = extractVariables(editingTemplate.template)
    const updatedTemplate = { ...editingTemplate, variables }

    setTemplates((prev) => prev.map((template) => (template.id === editingTemplate.id ? updatedTemplate : template)))
    setEditingTemplate(null)
    setIsEditDialogOpen(false)
  }

  const deleteTemplate = (templateId: string) => {
    setTemplates((prev) => prev.filter((template) => template.id !== templateId))
  }

  const groupedTemplates = {
    domain: templates.filter((t) => t.category === "domain"),
    "use-case": templates.filter((t) => t.category === "use-case"),
    general: templates.filter((t) => t.category === "general"),
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Prompt Templates</h2>
          <p className="text-muted-foreground">Manage AI prompt templates for enhanced document analysis</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Create New Prompt Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Template Name</Label>
                  <Input
                    placeholder="e.g., Risk Assessment Template"
                    value={newTemplate.name || ""}
                    onChange={(e) => setNewTemplate((prev) => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Category</Label>
                  <select
                    className="w-full p-2 border rounded-md"
                    value={newTemplate.category || "general"}
                    onChange={(e) => setNewTemplate((prev) => ({ ...prev, category: e.target.value as any }))}
                  >
                    <option value="general">General</option>
                    <option value="domain">Domain-Specific</option>
                    <option value="use-case">Use Case-Specific</option>
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="Brief description of this template's purpose..."
                  value={newTemplate.description || ""}
                  onChange={(e) => setNewTemplate((prev) => ({ ...prev, description: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Prompt Template</Label>
                <Textarea
                  placeholder="Enter your prompt template here. Use {{variable_name}} for dynamic variables..."
                  value={newTemplate.template || ""}
                  onChange={(e) => setNewTemplate((prev) => ({ ...prev, template: e.target.value }))}
                  rows={6}
                />
                <p className="text-xs text-muted-foreground">
                  Use double curly braces for variables: {`{{variable_name}}`}
                </p>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createTemplate}>Create Template</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General Templates</TabsTrigger>
          <TabsTrigger value="domain">Domain Templates</TabsTrigger>
          <TabsTrigger value="use-case">Use Case Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <div className="grid gap-4">
            {groupedTemplates.general.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(template.template, template.id)}
                      >
                        {copiedId === template.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Dialog
                        open={isEditDialogOpen && editingTemplate?.id === template.id}
                        onOpenChange={setIsEditDialogOpen}
                      >
                        <DialogTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => setEditingTemplate({ ...template })}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-3xl">
                          <DialogHeader>
                            <DialogTitle>Edit Prompt Template</DialogTitle>
                          </DialogHeader>
                          {editingTemplate && (
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                  <Label>Template Name</Label>
                                  <Input
                                    value={editingTemplate.name}
                                    onChange={(e) =>
                                      setEditingTemplate((prev) => (prev ? { ...prev, name: e.target.value } : null))
                                    }
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>Category</Label>
                                  <select
                                    className="w-full p-2 border rounded-md"
                                    value={editingTemplate.category}
                                    onChange={(e) =>
                                      setEditingTemplate((prev) =>
                                        prev ? { ...prev, category: e.target.value as any } : null,
                                      )
                                    }
                                  >
                                    <option value="general">General</option>
                                    <option value="domain">Domain-Specific</option>
                                    <option value="use-case">Use Case-Specific</option>
                                  </select>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <Label>Description</Label>
                                <Input
                                  value={editingTemplate.description}
                                  onChange={(e) =>
                                    setEditingTemplate((prev) =>
                                      prev ? { ...prev, description: e.target.value } : null,
                                    )
                                  }
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Prompt Template</Label>
                                <Textarea
                                  value={editingTemplate.template}
                                  onChange={(e) =>
                                    setEditingTemplate((prev) => (prev ? { ...prev, template: e.target.value } : null))
                                  }
                                  rows={6}
                                />
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                  Cancel
                                </Button>
                                <Button onClick={updateTemplate}>Save Changes</Button>
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTemplate(template.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm font-mono whitespace-pre-wrap">{template.template}</p>
                  </div>
                  {template.variables.length > 0 && (
                    <div>
                      <span className="text-sm font-medium">Variables:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {template.variables.map((variable) => (
                          <Badge key={variable} variant="outline">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="domain" className="space-y-4">
          <div className="grid gap-4">
            {groupedTemplates.domain.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                      {template.associatedId && (
                        <Badge variant="secondary" className="mt-1">
                          Domain: {template.associatedId}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(template.template, template.id)}
                      >
                        {copiedId === template.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingTemplate({ ...template })
                          setIsEditDialogOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTemplate(template.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm font-mono whitespace-pre-wrap">{template.template}</p>
                  </div>
                  {template.variables.length > 0 && (
                    <div>
                      <span className="text-sm font-medium">Variables:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {template.variables.map((variable) => (
                          <Badge key={variable} variant="outline">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="use-case" className="space-y-4">
          <div className="grid gap-4">
            {groupedTemplates["use-case"].map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                      {template.associatedId && (
                        <Badge variant="secondary" className="mt-1">
                          Use Case: {template.associatedId}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(template.template, template.id)}
                      >
                        {copiedId === template.id ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditingTemplate({ ...template })
                          setIsEditDialogOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTemplate(template.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-muted p-3 rounded-md">
                    <p className="text-sm font-mono whitespace-pre-wrap">{template.template}</p>
                  </div>
                  {template.variables.length > 0 && (
                    <div>
                      <span className="text-sm font-medium">Variables:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {template.variables.map((variable) => (
                          <Badge key={variable} variant="outline">
                            {variable}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
