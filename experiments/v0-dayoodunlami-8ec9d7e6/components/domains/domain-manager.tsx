"use client"

import { useState } from "react"
import { Plus, Edit, Trash2, Globe, Tag, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Separator } from "@/components/ui/separator"

interface Domain {
  id: string
  name: string
  description: string
  topics: string[]
  promptTemplate?: string
  color: string
}

export function DomainManager() {
  const [domains, setDomains] = useState<Domain[]>([
    {
      id: "ai",
      name: "AI & Technology",
      description: "Artificial Intelligence, Machine Learning, and emerging technologies",
      topics: ["Machine Learning", "Natural Language Processing", "Computer Vision", "Automation"],
      color: "bg-blue-100 text-blue-800",
      promptTemplate:
        "Analyze this document from an AI and technology perspective, focusing on innovation, implementation challenges, and strategic implications.",
    },
    {
      id: "rail",
      name: "Rail Transport",
      description: "Railway infrastructure, operations, and modernization",
      topics: ["Rail Infrastructure", "Station Management", "Railway Safety", "Electrification", "High-Speed Rail"],
      color: "bg-green-100 text-green-800",
      promptTemplate:
        "Examine this document for rail transport insights, including infrastructure needs, safety considerations, and operational efficiency.",
    },
    {
      id: "highway",
      name: "Highway & Roads",
      description: "Road infrastructure, traffic management, and highway systems",
      topics: ["Road Infrastructure", "Traffic Management", "Highway Safety", "Smart Roads"],
      color: "bg-orange-100 text-orange-800",
      promptTemplate:
        "Review this document for highway and road transport elements, focusing on infrastructure development and traffic optimization.",
    },
    {
      id: "maritime",
      name: "Maritime Transport",
      description: "Ports, shipping, and maritime infrastructure",
      topics: ["Port Operations", "Shipping", "Maritime Safety", "Coastal Infrastructure"],
      color: "bg-cyan-100 text-cyan-800",
      promptTemplate:
        "Analyze this document for maritime transport aspects, including port operations, shipping logistics, and coastal infrastructure.",
    },
  ])

  const [editingDomain, setEditingDomain] = useState<Domain | null>(null)
  const [newDomain, setNewDomain] = useState<Partial<Domain>>({
    name: "",
    description: "",
    topics: [],
    promptTemplate: "",
    color: "bg-gray-100 text-gray-800",
  })
  const [newTopic, setNewTopic] = useState("")
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)

  const addTopic = (domainId: string, topic: string) => {
    if (!topic.trim()) return

    setDomains((prev) =>
      prev.map((domain) => (domain.id === domainId ? { ...domain, topics: [...domain.topics, topic.trim()] } : domain)),
    )
  }

  const removeTopic = (domainId: string, topicToRemove: string) => {
    setDomains((prev) =>
      prev.map((domain) =>
        domain.id === domainId
          ? { ...domain, topics: domain.topics.filter((topic) => topic !== topicToRemove) }
          : domain,
      ),
    )
  }

  const createDomain = () => {
    if (!newDomain.name?.trim()) return

    const domain: Domain = {
      id: newDomain.name.toLowerCase().replace(/\s+/g, "-"),
      name: newDomain.name,
      description: newDomain.description || "",
      topics: newDomain.topics || [],
      promptTemplate: newDomain.promptTemplate || "",
      color: newDomain.color || "bg-gray-100 text-gray-800",
    }

    setDomains((prev) => [...prev, domain])
    setNewDomain({ name: "", description: "", topics: [], promptTemplate: "", color: "bg-gray-100 text-gray-800" })
    setIsCreateDialogOpen(false)
  }

  const updateDomain = () => {
    if (!editingDomain) return

    setDomains((prev) => prev.map((domain) => (domain.id === editingDomain.id ? editingDomain : domain)))
    setEditingDomain(null)
    setIsEditDialogOpen(false)
  }

  const deleteDomain = (domainId: string) => {
    setDomains((prev) => prev.filter((domain) => domain.id !== domainId))
  }

  const colorOptions = [
    "bg-blue-100 text-blue-800",
    "bg-green-100 text-green-800",
    "bg-orange-100 text-orange-800",
    "bg-cyan-100 text-cyan-800",
    "bg-purple-100 text-purple-800",
    "bg-pink-100 text-pink-800",
    "bg-yellow-100 text-yellow-800",
    "bg-gray-100 text-gray-800",
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Domain Management</h2>
          <p className="text-muted-foreground">Create and manage knowledge domains for document categorization</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
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
                  value={newDomain.name || ""}
                  onChange={(e) => setNewDomain((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="Brief description of this domain..."
                  value={newDomain.description || ""}
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
              <div className="space-y-2">
                <Label>AI Prompt Template</Label>
                <Textarea
                  placeholder="Template for AI analysis of documents in this domain..."
                  value={newDomain.promptTemplate || ""}
                  onChange={(e) => setNewDomain((prev) => ({ ...prev, promptTemplate: e.target.value }))}
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createDomain}>Create Domain</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {domains.map((domain) => (
          <Card key={domain.id} className="relative">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5" />
                  <div>
                    <CardTitle className="text-lg">{domain.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{domain.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Dialog open={isEditDialogOpen && editingDomain?.id === domain.id} onOpenChange={setIsEditDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" onClick={() => setEditingDomain({ ...domain })}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Edit Domain</DialogTitle>
                      </DialogHeader>
                      {editingDomain && (
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label>Domain Name</Label>
                            <Input
                              value={editingDomain.name}
                              onChange={(e) =>
                                setEditingDomain((prev) => (prev ? { ...prev, name: e.target.value } : null))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Textarea
                              value={editingDomain.description}
                              onChange={(e) =>
                                setEditingDomain((prev) => (prev ? { ...prev, description: e.target.value } : null))
                              }
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Color Theme</Label>
                            <div className="flex flex-wrap gap-2">
                              {colorOptions.map((color) => (
                                <button
                                  key={color}
                                  className={`w-8 h-8 rounded-full border-2 ${color} ${
                                    editingDomain.color === color ? "border-primary" : "border-transparent"
                                  }`}
                                  onClick={() => setEditingDomain((prev) => (prev ? { ...prev, color } : null))}
                                />
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label>AI Prompt Template</Label>
                            <Textarea
                              value={editingDomain.promptTemplate || ""}
                              onChange={(e) =>
                                setEditingDomain((prev) => (prev ? { ...prev, promptTemplate: e.target.value } : null))
                              }
                              rows={3}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Topics</Label>
                            <div className="flex flex-wrap gap-2 border rounded-md p-2 min-h-[60px]">
                              {editingDomain.topics.map((topic) => (
                                <Badge key={topic} className={editingDomain.color}>
                                  {topic}
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-4 w-4 ml-1 p-0"
                                    onClick={() =>
                                      setEditingDomain((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              topics: prev.topics.filter((t) => t !== topic),
                                            }
                                          : null,
                                      )
                                    }
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </Badge>
                              ))}
                              <div className="flex items-center gap-2 mt-2 w-full">
                                <Input
                                  placeholder="Add topic..."
                                  className="h-8"
                                  value={newTopic}
                                  onChange={(e) => setNewTopic(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter" && newTopic.trim()) {
                                      e.preventDefault()
                                      setEditingDomain((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              topics: [...prev.topics, newTopic.trim()],
                                            }
                                          : null,
                                      )
                                      setNewTopic("")
                                    }
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => {
                                    if (newTopic.trim()) {
                                      setEditingDomain((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              topics: [...prev.topics, newTopic.trim()],
                                            }
                                          : null,
                                      )
                                      setNewTopic("")
                                    }
                                  }}
                                >
                                  <Plus className="h-3 w-3 mr-1" /> Add
                                </Button>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button onClick={updateDomain}>Save Changes</Button>
                          </div>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteDomain(domain.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="h-4 w-4" />
                  <span className="text-sm font-medium">Topics ({domain.topics.length})</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {domain.topics.slice(0, 4).map((topic) => (
                    <Badge key={topic} variant="secondary" className={domain.color}>
                      {topic}
                    </Badge>
                  ))}
                  {domain.topics.length > 4 && <Badge variant="outline">+{domain.topics.length - 4} more</Badge>}
                </div>
              </div>

              {domain.promptTemplate && (
                <>
                  <Separator />
                  <div>
                    <span className="text-sm font-medium">AI Prompt Template</span>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{domain.promptTemplate}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
