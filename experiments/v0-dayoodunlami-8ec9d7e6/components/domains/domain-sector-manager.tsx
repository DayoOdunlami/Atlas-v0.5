"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Globe, Calendar, Tag, Eye, Grid, List, Edit2, Check, X, Download, Upload, Trash2, MoreVertical, Settings, ChevronDown, Plus, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Checkbox } from "@/components/ui/checkbox"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useDemoMode, DEMO_DATA } from "@/lib/demo-mode"

interface Domain {
  id: string
  name: string
  description: string
  color: string
  icon: string
  is_active: boolean
  document_count: number
  use_case_count: number
  created_at: string
  updated_at: string
}

interface UseCase {
  id: string
  name: string
  description: string
  category: string
  domain_id: string
  is_active: boolean
  document_count: number
  created_at: string
  updated_at: string
}

type ViewMode = "cards" | "table"
type ManagementMode = "domains" | "use-cases"

interface EditingState {
  [itemId: string]: {
    [field: string]: boolean
  }
}

export function DomainSectorManager() {
  const [viewMode, setViewMode] = useState<ViewMode>("table")
  const [managementMode, setManagementMode] = useState<ManagementMode>("domains")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")
  const [loading, setLoading] = useState(true)
  const [domains, setDomains] = useState<Domain[]>([])
  const [useCases, setUseCases] = useState<UseCase[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<EditingState>({})
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [itemToDelete, setItemToDelete] = useState<Domain | UseCase | null>(null)
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const { demoMode } = useDemoMode()

  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
    icon: "🏢",
    category: "General"
  })

  // Demo data
  const demoDomains: Domain[] = [
    {
      id: "1",
      name: "Rail & Transit",
      description: "Railway infrastructure, stations, and transit systems",
      color: "#8B5CF6",
      icon: "🚆",
      is_active: true,
      document_count: 45,
      use_case_count: 8,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-20T14:30:00Z"
    },
    {
      id: "2", 
      name: "Highway & Roads",
      description: "Road infrastructure, traffic management, and highway systems",
      color: "#F59E0B",
      icon: "🛣️",
      is_active: true,
      document_count: 32,
      use_case_count: 6,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-18T09:15:00Z"
    },
    {
      id: "3",
      name: "Maritime",
      description: "Ports, shipping, and maritime transportation systems",
      color: "#06B6D4",
      icon: "⚓",
      is_active: true,
      document_count: 28,
      use_case_count: 5,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-19T16:45:00Z"
    },
    {
      id: "4",
      name: "AI & Technology",
      description: "Machine Learning, AI systems, and emerging technologies",
      color: "#3B82F6",
      icon: "🤖",
      is_active: true,
      document_count: 15,
      use_case_count: 4,
      created_at: "2024-01-16T11:30:00Z",
      updated_at: "2024-01-21T13:20:00Z"
    },
    {
      id: "5",
      name: "General",
      description: "Cross-cutting topics and general strategy documents",
      color: "#6B7280",
      icon: "📋",
      is_active: true,
      document_count: 67,
      use_case_count: 3,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-17T12:10:00Z"
    },
    {
      id: "6",
      name: "Archived Domain",
      description: "Example of an inactive domain with orphaned documents",
      color: "#EF4444",
      icon: "📦",
      is_active: false,
      document_count: 12,
      use_case_count: 0,
      created_at: "2024-01-10T08:00:00Z",
      updated_at: "2024-01-22T10:00:00Z"
    }
  ]

  const demoUseCases: UseCase[] = [
    {
      id: "1",
      name: "Strategy Development",
      description: "Strategic planning and high-level decision making",
      category: "Strategic",
      domain_id: "1",
      is_active: true,
      document_count: 12,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-20T14:30:00Z"
    },
    {
      id: "2",
      name: "Infrastructure Planning",
      description: "Plan and assess infrastructure projects",
      category: "Operational",
      domain_id: "1",
      is_active: true,
      document_count: 18,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-19T11:20:00Z"
    },
    {
      id: "3",
      name: "Safety & Compliance",
      description: "Safety protocols and regulatory compliance",
      category: "Assessment",
      domain_id: "1",
      is_active: true,
      document_count: 15,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-18T15:45:00Z"
    },
    {
      id: "4",
      name: "Traffic Management",
      description: "Optimize traffic flow and management systems",
      category: "Operational",
      domain_id: "2",
      is_active: true,
      document_count: 22,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-21T09:30:00Z"
    },
    {
      id: "5",
      name: "Port Operations",
      description: "Harbor and port facility management",
      category: "Operational",
      domain_id: "3",
      is_active: true,
      document_count: 16,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-20T16:15:00Z"
    },
    {
      id: "6",
      name: "Orphaned Use Case",
      description: "Use case with no associated domain",
      category: "Unknown",
      domain_id: "", // No domain
      is_active: false,
      document_count: 3,
      created_at: "2024-01-10T08:00:00Z",
      updated_at: "2024-01-22T10:00:00Z"
    }
  ]

  useEffect(() => {
    loadData()
  }, [managementMode])

  const loadData = async () => {
    try {
      setLoading(true)
      
      if (demoMode) {
        // Use demo data
        setDomains(demoDomains)
        setUseCases(demoUseCases)
        setLoading(false)
      } else {
        // TODO: Implement real API calls
        // const response = await apiClient.domains.list()
        // setDomains(response.domains || [])
        // const useCaseResponse = await apiClient.useCases.list()
        // setUseCases(useCaseResponse.useCases || [])
        
        // For now, use demo data
        setDomains(demoDomains)
        setUseCases(demoUseCases)
        setLoading(false)
      }
    } catch (error) {
      console.error("Failed to load data:", error)
      setLoading(false)
    }
  }

  const getCurrentItems = () => {
    return managementMode === "domains" ? domains : useCases
  }

  const getFilteredItems = () => {
    let items = getCurrentItems()
    
    // Apply search filter
    if (searchQuery) {
      items = items.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    
    // Apply status filter
    if (selectedFilter === "active") {
      items = items.filter(item => item.is_active)
    } else if (selectedFilter === "inactive") {
      items = items.filter(item => !item.is_active)
    } else if (selectedFilter === "orphaned" && managementMode === "use-cases") {
      items = items.filter(item => !(item as UseCase).domain_id)
    } else if (selectedFilter === "with-documents") {
      items = items.filter(item => item.document_count > 0)
    }
    
    // Apply sorting
    if (sortBy === "name") {
      items.sort((a, b) => a.name.localeCompare(b.name))
    } else if (sortBy === "documents") {
      items.sort((a, b) => b.document_count - a.document_count)
    } else if (sortBy === "recent") {
      items.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    }
    
    return items
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedItems(new Set(getFilteredItems().map(item => item.id)))
    } else {
      setSelectedItems(new Set())
    }
  }

  const handleSelectItem = (itemId: string, checked: boolean) => {
    const newSelected = new Set(selectedItems)
    if (checked) {
      newSelected.add(itemId)
    } else {
      newSelected.delete(itemId)
    }
    setSelectedItems(newSelected)
  }

  const startEditing = (itemId: string, field: string) => {
    setEditing(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: true }
    }))
  }

  const stopEditing = (itemId: string, field: string) => {
    setEditing(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: false }
    }))
  }

  const saveFieldEdit = async (itemId: string, field: string, value: string) => {
    try {
      // TODO: Implement API call to update field
      // await apiClient[managementMode === "domains" ? "domains" : "useCases"].update(itemId, { [field]: value })
      
      // Update local state for demo
      if (managementMode === "domains") {
        setDomains(prev => prev.map(item => 
          item.id === itemId ? { ...item, [field]: value, updated_at: new Date().toISOString() } : item
        ))
      } else {
        setUseCases(prev => prev.map(item => 
          item.id === itemId ? { ...item, [field]: value, updated_at: new Date().toISOString() } : item
        ))
      }
      
      stopEditing(itemId, field)
    } catch (error) {
      console.error("Failed to save edit:", error)
    }
  }

  const handleCreate = async () => {
    try {
      const itemData = {
        ...newItem,
        is_active: true,
        document_count: 0,
        ...(managementMode === "use-cases" ? { use_case_count: 0 } : {}),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      
      // TODO: Implement API call
      // const response = await apiClient[managementMode === "domains" ? "domains" : "useCases"].create(itemData)
      
      // Update local state for demo
      const newId = Date.now().toString()
      if (managementMode === "domains") {
        setDomains(prev => [...prev, { ...itemData, id: newId, use_case_count: 0 } as Domain])
      } else {
        setUseCases(prev => [...prev, { ...itemData, id: newId, domain_id: "", category: newItem.category } as UseCase])
      }
      
      setShowCreateDialog(false)
      setNewItem({ name: "", description: "", color: "#3B82F6", icon: "🏢", category: "General" })
    } catch (error) {
      console.error("Failed to create item:", error)
    }
  }

  const handleDelete = async (item: Domain | UseCase) => {
    if (item.document_count > 0) {
      setItemToDelete(item)
      setShowDeleteDialog(true)
    } else {
      await performDelete(item.id)
    }
  }

  const performDelete = async (itemId: string) => {
    try {
      // TODO: Implement API call
      // await apiClient[managementMode === "domains" ? "domains" : "useCases"].delete(itemId)
      
      // Update local state for demo
      if (managementMode === "domains") {
        setDomains(prev => prev.filter(item => item.id !== itemId))
      } else {
        setUseCases(prev => prev.filter(item => item.id !== itemId))
      }
      
      setShowDeleteDialog(false)
      setItemToDelete(null)
    } catch (error) {
      console.error("Failed to delete item:", error)
    }
  }

  const getStatusBadge = (isActive: boolean, documentCount: number) => {
    if (!isActive) {
      return <Badge variant="outline" className="bg-gray-100 text-gray-600">Inactive</Badge>
    }
    if (documentCount === 0) {
      return <Badge variant="outline" className="bg-yellow-100 text-yellow-700">No Documents</Badge>
    }
    return <Badge variant="outline" className="bg-green-100 text-green-700">Active</Badge>
  }

  const getDomainBadge = (domainId: string) => {
    if (!domainId) {
      return <Badge variant="outline" className="bg-red-100 text-red-700">Orphaned</Badge>
    }
    const domain = domains.find(d => d.id === domainId)
    return (
      <Badge variant="outline" style={{ backgroundColor: domain?.color + "20", color: domain?.color }}>
        {domain?.icon} {domain?.name}
      </Badge>
    )
  }

  const EditableCell = ({ 
    itemId, 
    field, 
    value, 
    type = "text",
    options = []
  }: { 
    itemId: string
    field: string
    value: string
    type?: "text" | "textarea" | "select" | "color"
    options?: { value: string; label: string }[]
  }) => {
    const [editValue, setEditValue] = useState(value)
    const isEditing = editing[itemId]?.[field]

    if (!isEditing) {
      return (
        <div className="flex items-center gap-2 group cursor-pointer" onClick={() => startEditing(itemId, field)}>
          <span className={field === "color" ? "flex items-center gap-2" : ""}>
            {field === "color" && (
              <div className="w-4 h-4 rounded border" style={{ backgroundColor: value }} />
            )}
            {type === "textarea" ? (
              <span className="line-clamp-2">{value}</span>
            ) : (
              value
            )}
          </span>
          <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100" />
        </div>
      )
    }

    const handleSave = () => {
      saveFieldEdit(itemId, field, editValue)
    }

    const handleCancel = () => {
      setEditValue(value)
      stopEditing(itemId, field)
    }

    return (
      <div className="flex items-center gap-2">
        {type === "select" ? (
          <Select value={editValue} onValueChange={setEditValue}>
            <SelectTrigger className="w-full h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : type === "color" ? (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="w-8 h-8 rounded border cursor-pointer"
            />
            <span className="text-sm font-mono">{editValue}</span>
          </div>
        ) : type === "textarea" ? (
          <Textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full min-h-[60px]"
            autoFocus
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full h-8"
            autoFocus
          />
        )}
        <Button size="sm" variant="ghost" onClick={handleSave}>
          <Check className="h-3 w-3" />
        </Button>
        <Button size="sm" variant="ghost" onClick={handleCancel}>
          <X className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  const filteredItems = getFilteredItems()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Domain & Sector Management</h1>
          <p className="text-muted-foreground">
            Manage domains, sectors, and use cases with document relationship tracking
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add {managementMode === "domains" ? "Domain" : "Use Case"}
          </Button>
        </div>
      </div>

      {/* Management Mode Toggle */}
      <div className="flex items-center gap-4">
        <Button
          variant={managementMode === "domains" ? "default" : "outline"}
          onClick={() => setManagementMode("domains")}
        >
          <Globe className="h-4 w-4 mr-2" />
          Domains ({domains.length})
        </Button>
        <Button
          variant={managementMode === "use-cases" ? "default" : "outline"}
          onClick={() => setManagementMode("use-cases")}
        >
          <Tag className="h-4 w-4 mr-2" />
          Use Cases ({useCases.length})
        </Button>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={`Search ${managementMode}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-[300px]"
            />
          </div>
          
          <Select value={selectedFilter} onValueChange={setSelectedFilter}>
            <SelectTrigger className="w-[150px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Items</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="inactive">Inactive Only</SelectItem>
              <SelectItem value="with-documents">With Documents</SelectItem>
              {managementMode === "use-cases" && (
                <SelectItem value="orphaned">Orphaned</SelectItem>
              )}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name A-Z</SelectItem>
              <SelectItem value="documents">Document Count</SelectItem>
              <SelectItem value="recent">Recently Updated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "table" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("table")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "cards" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("cards")}
          >
            <Grid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedItems.size > 0 && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                {selectedItems.size} item{selectedItems.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </Button>
                <Button variant="outline" size="sm" onClick={() => setBulkEditMode(true)}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Bulk Edit
                </Button>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-muted-foreground">Loading {managementMode}...</div>
        </div>
      ) : (
        <>
          {viewMode === "table" ? (
            /* Table View */
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={selectedItems.size === filteredItems.length && filteredItems.length > 0}
                          onCheckedChange={handleSelectAll}
                        />
                      </TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Description</TableHead>
                      {managementMode === "domains" && <TableHead>Color</TableHead>}
                      {managementMode === "domains" && <TableHead>Icon</TableHead>}
                      {managementMode === "use-cases" && <TableHead>Domain</TableHead>}
                      {managementMode === "use-cases" && <TableHead>Category</TableHead>}
                      <TableHead>Status</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="w-12">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <Checkbox
                            checked={selectedItems.has(item.id)}
                            onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <EditableCell
                            itemId={item.id}
                            field="name"
                            value={item.name}
                          />
                        </TableCell>
                        <TableCell className="max-w-xs">
                          <EditableCell
                            itemId={item.id}
                            field="description"
                            value={item.description}
                            type="textarea"
                          />
                        </TableCell>
                        {managementMode === "domains" && (
                          <TableCell>
                            <EditableCell
                              itemId={item.id}
                              field="color"
                              value={(item as Domain).color}
                              type="color"
                            />
                          </TableCell>
                        )}
                        {managementMode === "domains" && (
                          <TableCell>
                            <EditableCell
                              itemId={item.id}
                              field="icon"
                              value={(item as Domain).icon}
                            />
                          </TableCell>
                        )}
                        {managementMode === "use-cases" && (
                          <TableCell>
                            {getDomainBadge((item as UseCase).domain_id)}
                          </TableCell>
                        )}
                        {managementMode === "use-cases" && (
                          <TableCell>
                            <EditableCell
                              itemId={item.id}
                              field="category"
                              value={(item as UseCase).category}
                              type="select"
                              options={[
                                { value: "Strategic", label: "Strategic" },
                                { value: "Operational", label: "Operational" },
                                { value: "Assessment", label: "Assessment" },
                                { value: "Knowledge", label: "Knowledge" },
                                { value: "Analysis", label: "Analysis" },
                                { value: "General", label: "General" }
                              ]}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          {getStatusBadge(item.is_active, item.document_count)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.document_count}</span>
                            {item.document_count > 0 && (
                              <Button variant="ghost" size="sm">
                                <Eye className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(item.updated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              {managementMode === "use-cases" && !(item as UseCase).domain_id && (
                                <DropdownMenuItem>
                                  <Tag className="h-4 w-4 mr-2" />
                                  Assign Domain
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-600"
                                onClick={() => handleDelete(item)}
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            /* Card View */
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredItems.map((item) => (
                <Card key={item.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <Checkbox
                          checked={selectedItems.has(item.id)}
                          onCheckedChange={(checked) => handleSelectItem(item.id, checked as boolean)}
                        />
                        <div className="flex-1">
                          <CardTitle className="text-base leading-tight flex items-center gap-2">
                            {managementMode === "domains" && (item as Domain).icon}
                            {item.name}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {item.description}
                          </p>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Badges */}
                      <div className="flex flex-wrap gap-2">
                        {getStatusBadge(item.is_active, item.document_count)}
                        {managementMode === "domains" && (
                          <Badge variant="outline" style={{ backgroundColor: (item as Domain).color + "20", color: (item as Domain).color }}>
                            Domain
                          </Badge>
                        )}
                        {managementMode === "use-cases" && (
                          <Badge variant="outline" className="bg-purple-100 text-purple-700">
                            {(item as UseCase).category}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Stats */}
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>Documents:</span>
                          <span className="font-medium">{item.document_count}</span>
                        </div>
                        {managementMode === "domains" && (
                          <div className="flex items-center justify-between">
                            <span>Use Cases:</span>
                            <span className="font-medium">{(item as Domain).use_case_count}</span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span>Updated:</span>
                          <span>{new Date(item.updated_at).toLocaleDateString()}</span>
                        </div>
                      </div>

                      {/* Domain info for use cases */}
                      {managementMode === "use-cases" && (
                        <div>
                          {getDomainBadge((item as UseCase).domain_id)}
                        </div>
                      )}

                      {/* Warning for items with documents */}
                      {item.document_count > 0 && (
                        <Alert className="border-orange-200 bg-orange-50">
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription className="text-xs">
                            This {managementMode.slice(0, -1)} has {item.document_count} associated documents
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New {managementMode === "domains" ? "Domain" : "Use Case"}</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder={`Enter ${managementMode === "domains" ? "domain" : "use case"} name`}
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newItem.description}
                onChange={(e) => setNewItem(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter description..."
                rows={3}
              />
            </div>

            {managementMode === "domains" && (
              <>
                <div>
                  <Label htmlFor="color">Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      id="color"
                      value={newItem.color}
                      onChange={(e) => setNewItem(prev => ({ ...prev, color: e.target.value }))}
                      className="w-12 h-10 rounded border cursor-pointer"
                    />
                    <Input
                      value={newItem.color}
                      onChange={(e) => setNewItem(prev => ({ ...prev, color: e.target.value }))}
                      placeholder="#3B82F6"
                      className="font-mono"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="icon">Icon (Emoji)</Label>
                  <Input
                    id="icon"
                    value={newItem.icon}
                    onChange={(e) => setNewItem(prev => ({ ...prev, icon: e.target.value }))}
                    placeholder="🏢"
                    className="text-lg"
                  />
                </div>
              </>
            )}

            {managementMode === "use-cases" && (
              <div>
                <Label htmlFor="category">Category</Label>
                <Select value={newItem.category} onValueChange={(value) => setNewItem(prev => ({ ...prev, category: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Strategic">Strategic</SelectItem>
                    <SelectItem value="Operational">Operational</SelectItem>
                    <SelectItem value="Assessment">Assessment</SelectItem>
                    <SelectItem value="Knowledge">Knowledge</SelectItem>
                    <SelectItem value="Analysis">Analysis</SelectItem>
                    <SelectItem value="General">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!newItem.name}>
              Create {managementMode === "domains" ? "Domain" : "Use Case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {managementMode === "domains" ? "Domain" : "Use Case"}</DialogTitle>
          </DialogHeader>
          
          {itemToDelete && (
            <div className="space-y-4">
              <p>Are you sure you want to delete <strong>{itemToDelete.name}</strong>?</p>
              
              {itemToDelete.document_count > 0 && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Warning:</strong> This {managementMode.slice(0, -1)} has {itemToDelete.document_count} associated documents. 
                    These documents will become orphaned and need to be reassigned or cleaned up.
                  </AlertDescription>
                </Alert>
              )}
              
              <p className="text-sm text-muted-foreground">
                This action cannot be undone.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={() => itemToDelete && performDelete(itemToDelete.id)}
            >
              Delete {managementMode === "domains" ? "Domain" : "Use Case"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}