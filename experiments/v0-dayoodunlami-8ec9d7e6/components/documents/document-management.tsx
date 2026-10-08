"use client"

import { useState, useEffect } from "react"
import { Search, Download, Upload, MoreHorizontal, Eye, Trash2, Edit, FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { DocumentFilters } from "@/components/documents/document-filters"
import { DocumentStats } from "@/components/documents/document-stats"
import { DocumentPreview } from "@/components/documents/document-preview"
import { BulkActions } from "@/components/documents/bulk-actions"
import { CSVImportDialog } from "@/components/documents/csv-import-dialog"
import apiClient, { type DocumentFilters as Filters, type Sector, type UseCase } from "@/lib/api-client"
import Link from "next/link"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BulkEditPanel } from "@/components/documents/bulk-edit-panel"
import { useDemoMode, DEMO_DATA } from "@/lib/demo-mode"

interface Document {
  id: string
  title: string
  sector: Sector
  useCases: UseCase[]
  source: string
  date: string
  status: "processing" | "ready" | "error"
  fileType: string
  fileSize: string
}

interface ImportResult {
  totalRows: number
  processedRows: number
  newRecords: number
  updatedRecords: number
  skippedRows: number
  errors: Array<{
    row: number
    field?: string
    message: string
    severity: "error" | "warning"
  }>
}

export function DocumentManagement() {
  const [documents, setDocuments] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([])
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null)
  const [filters, setFilters] = useState<Filters>({})
  const [bulkEditMode, setBulkEditMode] = useState(false)
  const [bulkEditData, setBulkEditData] = useState({
    title: "",
    sector: "",
    useCase: "",
    tags: "",
  })
  const [csvImportOpen, setCsvImportOpen] = useState(false)
  const { useSampleData } = useDemoMode()

  useEffect(() => {
    loadDocuments()
  }, [filters, searchQuery, useSampleData])

  const loadDocuments = async () => {
    setLoading(true)
    try {
      if (useSampleData) {
        // Use demo data when demo mode is enabled
        setTimeout(() => {
          const demoDocuments = DEMO_DATA.documents.map(doc => ({
            id: doc.id,
            title: doc.title,
            sector: doc.sector.toLowerCase() as Sector,
            useCases: [doc.use_case.toLowerCase() as UseCase],
            source: doc.metadata.source,
            date: new Date(doc.created_at).toLocaleDateString(),
            status: doc.status as "processing" | "ready" | "error",
            fileType: "PDF",
            fileSize: "2.4 MB",
          }))
          setDocuments(demoDocuments)
          setLoading(false)
        }, 500) // Simulate loading delay
      } else {
        // Use real API data
        const response = await apiClient.documents.list({
          ...filters,
          search: searchQuery,
        })

        // Mock additional data for demonstration
        const documentsWithMeta = response.documents.map((doc) => ({
          ...doc,
          fileType: "PDF",
          fileSize: "2.4 MB",
        }))

        setDocuments(documentsWithMeta)
        setLoading(false)
      }
    } catch (error) {
      console.error("Failed to load documents:", error)
      setLoading(false)
    }
  }

  const handleDeleteDocument = async (id: string) => {
    try {
      await apiClient.documents.delete(id)
      setDocuments((docs) => docs.filter((doc) => doc.id !== id))
    } catch (error) {
      console.error("Failed to delete document:", error)
    }
  }

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedDocuments.map((id) => apiClient.documents.delete(id)))
      setDocuments((docs) => docs.filter((doc) => !selectedDocuments.includes(doc.id)))
      setSelectedDocuments([])
    } catch (error) {
      console.error("Failed to delete documents:", error)
    }
  }

  const handleImportComplete = (result: ImportResult) => {
    console.log("Import completed:", result)
    // Refresh documents list
    loadDocuments()
    // Show success notification
    // You could add a toast notification here
  }

  const getStatusBadge = (status: Document["status"]) => {
    switch (status) {
      case "ready":
        return (
          <Badge variant="default" className="bg-green-100 text-green-800">
            Ready
          </Badge>
        )
      case "processing":
        return <Badge variant="secondary">Processing</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const getSectorBadge = (sector: Sector) => {
    const colors = {
      rail: "bg-blue-100 text-blue-800",
      maritime: "bg-cyan-100 text-cyan-800",
      highways: "bg-orange-100 text-orange-800",
      general: "bg-gray-100 text-gray-800",
    }

    return (
      <Badge variant="outline" className={colors[sector]}>
        {sector.charAt(0).toUpperCase() + sector.slice(1)}
      </Badge>
    )
  }

  return (
    <div className="space-y-6">
      {/* Demo Mode Indicator */}
      {useSampleData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            📄 <strong>Demo Mode:</strong> Displaying sample document data
          </p>
        </div>
      )}
      
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Document Management</h1>
          <p className="text-muted-foreground">Manage and organize your strategic documents</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setCsvImportOpen(true)}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <BulkActions
            selectedCount={selectedDocuments.length}
            onBulkDelete={handleBulkDelete}
            onExportCSV={() => {
              // Implement CSV export
              console.log("Exporting CSV...")
            }}
          />
        </div>
      </div>

      <DocumentStats />

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Documents</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search documents..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 sm:w-[300px]"
                />
              </div>
              <DocumentFilters filters={filters} onFiltersChange={setFilters} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading documents...</div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="enable-live-editing"
                      checked={bulkEditMode}
                      onChange={(e) => setBulkEditMode(e.target.checked)}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="enable-live-editing" className="text-sm font-medium">
                      Enable Live Editing
                    </label>
                  </div>
                  {selectedDocuments.length > 0 && (
                    <Badge variant="secondary">{selectedDocuments.length} selected</Badge>
                  )}
                </div>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <input
                          type="checkbox"
                          checked={selectedDocuments.length === documents.length && documents.length > 0}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDocuments(documents.map((doc) => doc.id))
                            } else {
                              setSelectedDocuments([])
                            }
                          }}
                          className="rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead>Title</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Sector</TableHead>
                      <TableHead>Use Cases</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>File Info</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documents.map((document) => (
                      <TableRow key={document.id}>
                        <TableCell>
                          <input
                            type="checkbox"
                            checked={selectedDocuments.includes(document.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedDocuments([...selectedDocuments, document.id])
                              } else {
                                setSelectedDocuments(selectedDocuments.filter((id) => id !== document.id))
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          {bulkEditMode ? (
                            <Input
                              value={document.title}
                              onChange={(e) => {
                                // Handle inline editing
                                setDocuments((docs) =>
                                  docs.map((doc) => (doc.id === document.id ? { ...doc, title: e.target.value } : doc)),
                                )
                              }}
                              className="min-w-[200px]"
                            />
                          ) : (
                            <button
                              onClick={() => setPreviewDocument(document)}
                              className="text-left hover:text-primary"
                            >
                              {document.title}
                            </button>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[300px]">
                          {bulkEditMode ? (
                            <Input placeholder="Document description..." className="min-w-[250px]" />
                          ) : (
                            <div className="text-sm text-muted-foreground truncate">
                              Strategic document outlining key initiatives and implementation approaches for
                              transportation infrastructure development.
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {bulkEditMode ? (
                            <Select
                              value={document.sector}
                              onValueChange={(value) => {
                                setDocuments((docs) =>
                                  docs.map((doc) =>
                                    doc.id === document.id ? { ...doc, sector: value as Sector } : doc,
                                  ),
                                )
                              }}
                            >
                              <SelectTrigger className="w-[120px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="rail">Rail</SelectItem>
                                <SelectItem value="maritime">Maritime</SelectItem>
                                <SelectItem value="highways">Highways</SelectItem>
                                <SelectItem value="general">General</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            getSectorBadge(document.sector)
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {document.useCases.slice(0, 2).map((useCase) => (
                              <Badge key={useCase} variant="outline" className="text-xs">
                                {useCase.replace("-", " ")}
                              </Badge>
                            ))}
                            {document.useCases.length > 2 && (
                              <Badge variant="outline" className="text-xs">
                                +{document.useCases.length - 2}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{document.source}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(document.date).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{getStatusBadge(document.status)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          <div>
                            <div>{document.fileType}</div>
                            <div>{document.fileSize}</div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                                <span className="sr-only">Open menu</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => setPreviewDocument(document)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Preview
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit className="mr-2 h-4 w-4" />
                                Edit Metadata
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Download className="mr-2 h-4 w-4" />
                                Download
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDeleteDocument(document.id)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {documents.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <div className="text-muted-foreground">
                      <p className="text-lg font-medium">No documents found</p>
                      <p className="mt-1">Upload your first document to get started</p>
                    </div>
                    <Button className="mt-4" asChild>
                      <Link href="/upload">
                        <Upload className="mr-2 h-4 w-4" />
                        Upload Document
                      </Link>
                    </Button>
                  </div>
                )}
              </div>

              {selectedDocuments.length > 0 && (
                <BulkEditPanel
                  selectedCount={selectedDocuments.length}
                  bulkEditData={bulkEditData}
                  onBulkEditDataChange={setBulkEditData}
                  onApplyBulkEdit={() => {
                    // Apply bulk edits to selected documents
                    setDocuments((docs) =>
                      docs.map((doc) => {
                        if (selectedDocuments.includes(doc.id)) {
                          return {
                            ...doc,
                            ...(bulkEditData.title && { title: bulkEditData.title }),
                            ...(bulkEditData.sector && { sector: bulkEditData.sector as Sector }),
                            // Add other bulk edit fields as needed
                          }
                        }
                        return doc
                      }),
                    )
                    // Clear selections and reset bulk edit data
                    setSelectedDocuments([])
                    setBulkEditData({ title: "", sector: "", useCase: "", tags: "" })
                  }}
                  onClearSelection={() => setSelectedDocuments([])}
                />
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {previewDocument && <DocumentPreview document={previewDocument} onClose={() => setPreviewDocument(null)} />}

      <CSVImportDialog open={csvImportOpen} onOpenChange={setCsvImportOpen} onImportComplete={handleImportComplete} />
    </div>
  )
}
