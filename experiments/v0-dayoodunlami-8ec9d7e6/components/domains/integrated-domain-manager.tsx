"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Globe, ChevronDown, ChevronRight, Tag, Eye, Grid, List, Edit2, Check, X, Download, Copy, Trash2, MoreVertical, Plus, AlertTriangle, Move, Users, ChevronUp } from "lucide-react"
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
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useDemoMode } from "@/lib/demo-mode"
import { useToast } from "@/hooks/use-toast"
import apiClient, { Domain, UseCase } from "@/lib/api-client"

// Extended Domain interface with use_cases
interface DomainWithUseCases extends Domain {
  use_cases: UseCase[]
}

type ViewMode = "hierarchy" | "flat" | "cards"

interface EditingState {
  [itemId: string]: {
    [field: string]: boolean
  }
}

export function IntegratedDomainManager() {
  const [viewMode, setViewMode] = useState<ViewMode>("hierarchy")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFilter, setSelectedFilter] = useState("all")
  const [sortBy, setSortBy] = useState("name")
  const [loading, setLoading] = useState(true)
  const [domains, setDomains] = useState<DomainWithUseCases[]>([])
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [editing, setEditing] = useState<EditingState>({})
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showCopyDialog, setShowCopyDialog] = useState(false)
  const [itemToCopy, setItemToCopy] = useState<Domain | UseCase | null>(null)
  const [copyType, setCopyType] = useState<"domain" | "use-case">("domain")
  const { demoMode } = useDemoMode()
  const { toast } = useToast()
  const [error, setError] = useState<string | null>(null)

  const [newItem, setNewItem] = useState({
    name: "",
    description: "",
    color: "#3B82F6",
    icon: "🏢",
    category: "General",
    domain_id: ""
  })

  // Add Use Case dialog state
  const [showAddUseCaseDialog, setShowAddUseCaseDialog] = useState(false)
  const [addUseCaseDomainId, setAddUseCaseDomainId] = useState<string | null>(null)
  const [newUseCase, setNewUseCase] = useState({
    name: '',
    description: '',
    category: 'General',
  })

  // Demo data with integrated structure  
  const demoDomains: DomainWithUseCases[] = [
    {
      id: "1",
      name: "Rail & Transit",
      description: "Railway infrastructure, stations, and transit systems",
      color: "#8B5CF6",
      icon: "🚆",
      is_active: true,
      document_count: 45,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-20T14:30:00Z",
      use_cases: [
        {
          id: "uc1",
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
          id: "uc2",
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
          id: "uc3",
          name: "Safety & Compliance",
          description: "Safety protocols and regulatory compliance",
          category: "Assessment",
          domain_id: "1",
          is_active: true,
          document_count: 15,
          created_at: "2024-01-15T10:00:00Z",
          updated_at: "2024-01-18T15:45:00Z"
        }
      ]
    },
    {
      id: "2",
      name: "Highway & Roads",
      description: "Road infrastructure, traffic management, and highway systems",
      color: "#F59E0B",
      icon: "🛣️",
      is_active: true,
      document_count: 32,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-18T09:15:00Z",
      use_cases: [
        {
          id: "uc4",
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
          id: "uc5",
          name: "Smart Infrastructure",
          description: "IoT and smart road technologies",
          category: "Strategic",
          domain_id: "2",
          is_active: true,
          document_count: 10,
          created_at: "2024-01-16T14:00:00Z",
          updated_at: "2024-01-21T16:20:00Z"
        }
      ]
    },
    {
      id: "3",
      name: "Maritime",
      description: "Ports, shipping, and maritime transportation systems",
      color: "#06B6D4",
      icon: "⚓",
      is_active: true,
      document_count: 28,
      created_at: "2024-01-15T10:00:00Z",
      updated_at: "2024-01-19T16:45:00Z",
      use_cases: [
        {
          id: "uc6",
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
          id: "uc7",
          name: "Shipping Analytics",
          description: "Maritime logistics and shipping optimization",
          category: "Analysis",
          domain_id: "3",
          is_active: true,
          document_count: 12,
          created_at: "2024-01-16T11:00:00Z",
          updated_at: "2024-01-20T13:45:00Z"
        }
      ]
    }
  ]

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      if (demoMode) {
        // Use demo data in demo mode
        setDomains(demoDomains)
        setExpandedDomains(new Set(demoDomains.map(d => d.id)))
      } else {
        // Real API call to get domains with their use cases
        const response = await apiClient.domains.listWithUseCases()
        setDomains(response.domains || [])
        // Auto-expand all domains to show relationships
        setExpandedDomains(new Set((response.domains || []).map(d => d.id)))
      }
      
      setLoading(false)
    } catch (error) {
      console.error("Failed to load data:", error)
      setError("Failed to load domains and use cases. Please try again.")
      setLoading(false)
      
      // Fallback to demo data on error
      setDomains(demoDomains)
      setExpandedDomains(new Set(demoDomains.map(d => d.id)))
    }
  }

  const toggleDomainExpansion = (domainId: string) => {
    const newExpanded = new Set(expandedDomains)
    if (newExpanded.has(domainId)) {
      newExpanded.delete(domainId)
    } else {
      newExpanded.add(domainId)
    }
    setExpandedDomains(newExpanded)
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
      if (!demoMode) {
        // Check if it's a domain or use case
        const isDomain = domains.some(d => d.id === itemId)
        const isUseCase = domains.some(d => d.use_cases?.some(uc => uc.id === itemId))
        
        if (isDomain) {
          await apiClient.domains.update(itemId, { [field]: value })
        } else if (isUseCase) {
          await apiClient.useCases.update(itemId, { [field]: value })
        }
      }
      
      // Update local state
      setDomains(prev => prev.map(domain => {
        if (domain.id === itemId) {
          return { ...domain, [field]: value, updated_at: new Date().toISOString() }
        }
        // Also check use cases
        return {
          ...domain,
          use_cases: domain.use_cases?.map(uc => 
            uc.id === itemId ? { ...uc, [field]: value, updated_at: new Date().toISOString() } : uc
          ) || []
        }
      }))
      
      stopEditing(itemId, field)
      
      // Show success message for updates
      const isDomain = domains.some(d => d.id === itemId)
      const itemName = isDomain 
        ? domains.find(d => d.id === itemId)?.name 
        : domains.flatMap(d => d.use_cases || []).find(uc => uc.id === itemId)?.name
      
      toast({
        title: "✅ Update Successful",
        description: `${isDomain ? 'Domain' : 'Use Case'} "${itemName}" has been updated.`,
      })
    } catch (error) {
      console.error("Failed to save edit:", error)
      setError("Failed to save changes. Please try again.")
    }
  }

  const handleCopyDomain = async (domain: DomainWithUseCases) => {
    try {
      if (!demoMode) {
        // Real API call to copy domain
        await apiClient.domains.copy(domain.id, `${domain.name} (Copy)`)
        // Reload data to get the copied domain with its use cases
        await loadData()
        // Show success message
        toast({
          title: "✅ Domain Copied Successfully",
          description: `"${domain.name}" has been copied with all its use cases.`,
        })
      } else {
        // Demo copy operation
        const newDomain = {
          ...domain,
          id: `copy_${domain.id}_${Date.now()}`,
          name: `${domain.name} (Copy)`,
          document_count: 0, // Copies don't inherit document links
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          use_cases: domain.use_cases?.map(uc => ({
            ...uc,
            id: `copy_${uc.id}_${Date.now()}`,
            domain_id: `copy_${domain.id}_${Date.now()}`,
            document_count: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })) || []
        }
        
        setDomains(prev => [...prev, newDomain])
        setExpandedDomains(prev => new Set([...prev, newDomain.id]))
        // Show success message for demo
        toast({
          title: "✅ Domain Copied Successfully", 
          description: `"${domain.name}" has been copied with all its use cases.`,
        })
      }
    } catch (error) {
      console.error("Failed to copy domain:", error)
      setError("Failed to copy domain. Please try again.")
    }
  }

  const handleCopyUseCase = async (useCase: UseCase, targetDomainId?: string) => {
    try {
      if (!demoMode) {
        // Real API call to copy use case
        await apiClient.useCases.copy(useCase.id, targetDomainId, `${useCase.name} (Copy)`)
        // Reload data to get the copied use case
        await loadData()
        // Show success message
        const targetDomain = targetDomainId ? domains.find(d => d.id === targetDomainId)?.name : "same domain"
        toast({
          title: "✅ Use Case Copied Successfully",
          description: `"${useCase.name}" has been copied to ${targetDomain}.`,
        })
      } else {
        // Demo copy operation
        const newUseCase = {
          ...useCase,
          id: `copy_${useCase.id}_${Date.now()}`,
          name: `${useCase.name} (Copy)`,
          domain_id: targetDomainId || useCase.domain_id,
          document_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
        
        setDomains(prev => prev.map(domain => 
          domain.id === newUseCase.domain_id 
            ? { ...domain, use_cases: [...(domain.use_cases || []), newUseCase] }
            : domain
        ))
        // Show success message for demo
        const targetDomain = targetDomainId ? domains.find(d => d.id === targetDomainId)?.name : "same domain"
        toast({
          title: "✅ Use Case Copied Successfully",
          description: `"${useCase.name}" has been copied to ${targetDomain}.`,
        })
      }
    } catch (error) {
      console.error("Failed to copy use case:", error)
      setError("Failed to copy use case. Please try again.")
    }
  }

  const handleMoveUseCase = async (useCaseId: string, targetDomainId: string) => {
    try {
      if (!demoMode) {
        // Real API call to move use case
        await apiClient.useCases.move(useCaseId, targetDomainId)
        // Reload data to reflect the move
        await loadData()
        // Show success message
        const targetDomain = domains.find(d => d.id === targetDomainId)?.name || "target domain"
        toast({
          title: "✅ Use Case Moved Successfully", 
          description: `Use case has been moved to "${targetDomain}".`,
        })
      } else {
        // Demo move operation
        let useCaseToMove: UseCase | null = null
        
        // Remove from current domain and get the use case
        setDomains(prev => prev.map(domain => {
          const useCaseIndex = domain.use_cases?.findIndex(uc => uc.id === useCaseId) ?? -1
          if (useCaseIndex >= 0 && domain.use_cases) {
            useCaseToMove = { ...domain.use_cases[useCaseIndex], domain_id: targetDomainId }
            return {
              ...domain,
              use_cases: domain.use_cases.filter(uc => uc.id !== useCaseId)
            }
          }
          return domain
        }))
        
        // Add to target domain
        if (useCaseToMove) {
          setDomains(prev => prev.map(domain => 
            domain.id === targetDomainId
              ? { ...domain, use_cases: [...(domain.use_cases || []), useCaseToMove!] }
              : domain
          ))
          // Show success message for demo
          const targetDomain = domains.find(d => d.id === targetDomainId)?.name || "target domain"
          toast({
            title: "✅ Use Case Moved Successfully",
            description: `Use case has been moved to "${targetDomain}".`,
          })
        }
      }
    } catch (error) {
      console.error("Failed to move use case:", error)
      setError("Failed to move use case. Please try again.")
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
            onKeyDown={(e) => {
              if (e.key === 'Enter' && e.ctrlKey) {
                handleSave()
              } else if (e.key === 'Escape') {
                handleCancel()
              }
            }}
            className="w-full min-h-[60px]"
            autoFocus
          />
        ) : (
          <Input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleSave()
              } else if (e.key === 'Escape') {
                handleCancel()
              }
            }}
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

  const getCategoryBadge = (category: string) => {
    const colors = {
      Strategic: "bg-purple-100 text-purple-700",
      Operational: "bg-blue-100 text-blue-700", 
      Assessment: "bg-green-100 text-green-700",
      Knowledge: "bg-orange-100 text-orange-700",
      Analysis: "bg-cyan-100 text-cyan-700",
      General: "bg-gray-100 text-gray-700"
    }
    
    return (
      <Badge variant="outline" className={colors[category as keyof typeof colors] || colors.General}>
        {category}
      </Badge>
    )
  }

  const filteredDomains = domains.filter(domain => {
    if (!searchQuery) return true
    return domain.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           domain.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
           domain.use_cases.some(uc => 
             uc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
             uc.description.toLowerCase().includes(searchQuery.toLowerCase())
           )
  })

  const handleDeleteDomain = async (domain: DomainWithUseCases) => {
    try {
      if (!demoMode) {
        // Real API call to delete domain
        await apiClient.domains.delete(domain.id)
        // Reload data to reflect the deletion
        await loadData()
        // Show success message
        toast({
          title: "✅ Domain Deleted Successfully",
          description: `"${domain.name}" and all its use cases have been deleted.`,
        })
      } else {
        // Demo delete operation
        setDomains(prev => prev.filter(d => d.id !== domain.id))
        // Show success message for demo
        toast({
          title: "✅ Domain Deleted Successfully",
          description: `"${domain.name}" and all its use cases have been deleted.`,
        })
      }
    } catch (error) {
      console.error("Failed to delete domain:", error)
      setError("Failed to delete domain. Please try again.")
    }
  }

  const handleDeleteUseCase = async (useCase: UseCase) => {
    try {
      if (!demoMode) {
        // Real API call to delete use case
        await apiClient.useCases.delete(useCase.id)
        // Reload data to reflect the deletion
        await loadData()
        // Show success message
        toast({
          title: "✅ Use Case Deleted Successfully",
          description: `"${useCase.name}" has been deleted.`,
        })
      } else {
        // Demo delete operation
        setDomains(prev => prev.map(domain => ({
          ...domain,
          use_cases: domain.use_cases?.filter(uc => uc.id !== useCase.id) || []
        })))
        // Show success message for demo
        toast({
          title: "✅ Use Case Deleted Successfully",
          description: `"${useCase.name}" has been deleted.`,
        })
      }
    } catch (error) {
      console.error("Failed to delete use case:", error)
      setError("Failed to delete use case. Please try again.")
    }
  }

  const handleCreateDomain = async () => {
    try {
      if (!newItem.name.trim()) return

      const domainData = {
        name: newItem.name,
        description: newItem.description,
        color: newItem.color,
        icon: newItem.icon
      }

      if (!demoMode) {
        // Real API call to create domain
        await apiClient.domains.create(domainData)
        // Reload data to get the new domain
        await loadData()
        // Show success message
        toast({
          title: "✅ Domain Created Successfully",
          description: `"${newItem.name}" has been created.`,
        })
      } else {
        // Demo create operation
        const newDomain: DomainWithUseCases = {
          id: `domain_${Date.now()}`,
          name: newItem.name,
          description: newItem.description,
          color: newItem.color,
          icon: newItem.icon,
          is_active: true,
          document_count: 0,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          use_cases: []
        }
        
        setDomains(prev => [...prev, newDomain])
        setExpandedDomains(prev => new Set([...prev, newDomain.id]))
        // Show success message for demo
        toast({
          title: "✅ Domain Created Successfully",
          description: `"${newItem.name}" has been created.`,
        })
      }

      // Reset form and close dialog
      setNewItem({ name: "", description: "", color: "#3B82F6", icon: "🏢", category: "General", domain_id: "" })
      setShowCreateDialog(false)
    } catch (error) {
      console.error("Failed to create domain:", error)
      setError("Failed to create domain. Please try again.")
    }
  }

  const openAddUseCaseDialog = (domainId: string) => {
    setAddUseCaseDomainId(domainId)
    setNewUseCase({ name: '', description: '', category: 'General' })
    setShowAddUseCaseDialog(true)
  }

  const handleCreateUseCase = async () => {
    if (!addUseCaseDomainId || !newUseCase.name.trim()) return
    try {
      if (!demoMode) {
        await apiClient.useCases.create({
          name: newUseCase.name,
          description: newUseCase.description,
          category: newUseCase.category,
          domain_id: addUseCaseDomainId,
        })
        await loadData()
        toast({
          title: '✅ Use Case Created Successfully',
          description: `"${newUseCase.name}" has been added.`,
        })
      } else {
        // Demo mode: add to local state
        setDomains(prev => prev.map(domain =>
          domain.id === addUseCaseDomainId
            ? {
                ...domain,
                use_cases: [
                  ...domain.use_cases,
                  {
                    id: `uc_${Date.now()}`,
                    name: newUseCase.name,
                    description: newUseCase.description,
                    category: newUseCase.category,
                    domain_id: addUseCaseDomainId,
                    is_active: true,
                    document_count: 0,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  },
                ],
              }
            : domain
        ))
        toast({
          title: '✅ Use Case Created Successfully',
          description: `"${newUseCase.name}" has been added.`,
        })
      }
      setShowAddUseCaseDialog(false)
    } catch (error) {
      console.error('Failed to create use case:', error)
      setError('Failed to create use case. Please try again.')
    }
  }

  // Move use case up/down in a domain
  const moveUseCaseInDomain = (domainId: string, useCaseId: string, direction: 'up' | 'down') => {
    setDomains(prev => prev.map(domain => {
      if (domain.id !== domainId) return domain
      const idx = domain.use_cases.findIndex(uc => uc.id === useCaseId)
      if (idx === -1) return domain
      const newUseCases = [...domain.use_cases]
      if (direction === 'up' && idx > 0) {
        [newUseCases[idx - 1], newUseCases[idx]] = [newUseCases[idx], newUseCases[idx - 1]]
      } else if (direction === 'down' && idx < newUseCases.length - 1) {
        [newUseCases[idx], newUseCases[idx + 1]] = [newUseCases[idx + 1], newUseCases[idx]]
      }
      return { ...domain, use_cases: newUseCases }
    }))
    // TODO: Persist order to backend if supported
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Integrated Domain Management</h1>
          <p className="text-muted-foreground">
            Manage domains and use cases with hierarchical relationships and easy duplication
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Domain
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            {error}
            <Button 
              variant="outline" 
              size="sm" 
              className="ml-2" 
              onClick={() => setError(null)}
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* View Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search domains and use cases..."
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
              <SelectItem value="with-documents">With Documents</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === "hierarchy" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("hierarchy")}
          >
            <List className="h-4 w-4 mr-1" />
            Hierarchy
          </Button>
          <Button
            variant={viewMode === "cards" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("cards")}
          >
            <Grid className="h-4 w-4 mr-1" />
            Cards
          </Button>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="text-muted-foreground">Loading domains...</div>
        </div>
      ) : (
        <>
          {viewMode === "hierarchy" ? (
            /* Hierarchical Table View */
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12"></TableHead>
                      <TableHead>Name & Description</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Documents</TableHead>
                      <TableHead>Last Updated</TableHead>
                      <TableHead className="w-12">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDomains.map((domain) => (
                      <>
                        {/* Domain Row */}
                        <TableRow key={domain.id} className="border-b-2">
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleDomainExpansion(domain.id)}
                            >
                              {expandedDomains.has(domain.id) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )}
                            </Button>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded flex items-center justify-center text-lg" 
                                   style={{ backgroundColor: domain.color + "20" }}>
                                {domain.icon}
                              </div>
                              <div>
                                <div className="font-semibold flex items-center gap-2">
                                  <Globe className="h-4 w-4" />
                                  <EditableCell
                                    itemId={domain.id}
                                    field="name"
                                    value={domain.name}
                                  />
                                </div>
                                <div className="text-sm text-muted-foreground line-clamp-1">
                                  <EditableCell
                                    itemId={domain.id}
                                    field="description"
                                    value={domain.description}
                                    type="textarea"
                                  />
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" style={{ backgroundColor: domain.color + "20", color: domain.color }}>
                              Domain ({domain.use_cases.length} use cases)
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(domain.is_active, domain.document_count)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{domain.document_count}</span>
                              {domain.document_count > 0 && (
                                <Button variant="ghost" size="sm">
                                  <Eye className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(domain.updated_at).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleCopyDomain(domain)}>
                                  <Copy className="h-4 w-4 mr-2" />
                                  Copy Domain + Use Cases
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openAddUseCaseDialog(domain.id)}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Add Use Case
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem>
                                  <Edit2 className="h-4 w-4 mr-2" />
                                  Edit Domain
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onClick={() => handleDeleteDomain(domain)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete Domain
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>

                        {/* Use Cases Rows (when expanded) */}
                        {expandedDomains.has(domain.id) && domain.use_cases.map((useCase) => (
                          <TableRow key={useCase.id} className="bg-muted/30">
                            <TableCell className="pl-8">
                              <div className="w-4 h-4 border-l border-b border-muted-foreground/30 rounded-bl"></div>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3 pl-4">
                                <Tag className="h-4 w-4 text-muted-foreground" />
                                <div>
                                  <div className="font-medium">
                                    <EditableCell
                                      itemId={useCase.id}
                                      field="name"
                                      value={useCase.name}
                                    />
                                  </div>
                                  <div className="text-sm text-muted-foreground line-clamp-1">
                                    <EditableCell
                                      itemId={useCase.id}
                                      field="description"
                                      value={useCase.description}
                                      type="textarea"
                                    />
                                  </div>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {getCategoryBadge(useCase.category)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(useCase.is_active, useCase.document_count)}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{useCase.document_count}</span>
                                {useCase.document_count > 0 && (
                                  <Button variant="ghost" size="sm">
                                    <Eye className="h-3 w-3" />
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(useCase.updated_at).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" disabled={domain.use_cases.findIndex(uc => uc.id === useCase.id) === 0} onClick={() => moveUseCaseInDomain(domain.id, useCase.id, 'up')}>
                                  <ChevronUp className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" disabled={domain.use_cases.findIndex(uc => uc.id === useCase.id) === domain.use_cases.length - 1} onClick={() => moveUseCaseInDomain(domain.id, useCase.id, 'down')}>
                                  <ChevronDown className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                            <TableCell>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleCopyUseCase(useCase)}>
                                    <Copy className="h-4 w-4 mr-2" />
                                    Copy to Same Domain
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Move className="h-4 w-4 mr-2" />
                                    Copy to Other Domain
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <Users className="h-4 w-4 mr-2" />
                                    Move to Other Domain
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem>
                                    <Edit2 className="h-4 w-4 mr-2" />
                                    Edit Use Case
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    className="text-red-600"
                                    onClick={() => handleDeleteUseCase(useCase)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Use Case
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ) : (
            /* Card View */
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredDomains.map((domain) => (
                <Card key={domain.id} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center text-xl" 
                             style={{ backgroundColor: domain.color + "20" }}>
                          {domain.icon}
                        </div>
                        <div>
                          <CardTitle className="text-lg">{domain.name}</CardTitle>
                          <p className="text-sm text-muted-foreground">
                            {domain.use_cases.length} use cases • {domain.document_count} docs
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
                          <DropdownMenuItem onClick={() => handleCopyDomain(domain)}>
                            <Copy className="h-4 w-4 mr-2" />
                            Copy Domain
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            className="text-red-600"
                            onClick={() => handleDeleteDomain(domain)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Domain
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Domain Description */}
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {domain.description}
                      </p>
                      
                      {/* Domain Status */}
                      <div className="flex items-center gap-2">
                        {getStatusBadge(domain.is_active, domain.document_count)}
                        <Badge variant="outline" style={{ backgroundColor: domain.color + "20", color: domain.color }}>
                          Domain
                        </Badge>
                      </div>

                      {/* Use Cases List */}
                      <div className="space-y-2">
                        <div className="text-sm font-medium flex items-center gap-2">
                          <Tag className="h-4 w-4" />
                          Use Cases ({domain.use_cases.length})
                        </div>
                        <div className="space-y-1 pl-6">
                          {domain.use_cases.slice(0, 3).map((useCase) => (
                            <div key={useCase.id} className="flex items-center justify-between text-sm">
                              <span className="truncate">{useCase.name}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground">{useCase.document_count}</span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                      <MoreVertical className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleCopyUseCase(useCase)}>
                                      <Copy className="h-4 w-4 mr-2" />
                                      Copy
                                    </DropdownMenuItem>
                                    <DropdownMenuItem>
                                      <Move className="h-4 w-4 mr-2" />
                                      Move
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem 
                                      className="text-red-600"
                                      onClick={() => handleDeleteUseCase(useCase)}
                                    >
                                      <Trash2 className="h-4 w-4 mr-2" />
                                      Delete
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </div>
                          ))}
                          {domain.use_cases.length > 3 && (
                            <div className="text-xs text-muted-foreground">
                              +{domain.use_cases.length - 3} more use cases
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div className="flex items-center gap-2 pt-2 border-t">
                        <Button variant="outline" size="sm" onClick={() => handleCopyDomain(domain)}>
                          <Copy className="h-3 w-3 mr-1" />
                          Copy
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => openAddUseCaseDialog(domain.id)}>
                          <Plus className="h-3 w-3 mr-1" />
                          Add Use Case
                        </Button>
                      </div>
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
            <DialogTitle>Create New Domain</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Domain Name</Label>
              <Input
                id="name"
                value={newItem.name}
                onChange={(e) => setNewItem(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter domain name"
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="color">Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    id="color"
                    value={newItem.color}
                    onChange={(e) => setNewItem(prev => ({ ...prev, color: e.target.value }))}
                    className="w-10 h-10 rounded border cursor-pointer"
                  />
                  <Input
                    value={newItem.color}
                    onChange={(e) => setNewItem(prev => ({ ...prev, color: e.target.value }))}
                    placeholder="#3B82F6"
                    className="font-mono text-sm"
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
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button disabled={!newItem.name} onClick={handleCreateDomain}>
              Create Domain
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Use Case Dialog */}
      <Dialog open={showAddUseCaseDialog} onOpenChange={setShowAddUseCaseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Use Case</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Use Case Name</Label>
              <Input
                id="name"
                value={newUseCase.name}
                onChange={(e) => setNewUseCase(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter use case name"
              />
            </div>

            <div>
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newUseCase.description}
                onChange={(e) => setNewUseCase(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter description..."
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select value={newUseCase.category} onValueChange={(value) => setNewUseCase(prev => ({ ...prev, category: value }))} className="w-full">
                <SelectTrigger className="w-full h-8">
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
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUseCaseDialog(false)}>
              Cancel
            </Button>
            <Button disabled={!newUseCase.name} onClick={handleCreateUseCase}>
              Create Use Case
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 