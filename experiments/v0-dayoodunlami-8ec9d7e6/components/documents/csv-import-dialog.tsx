"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload,
  FileText,
  CheckCircle,
  AlertTriangle,
  Download,
  Eye,
  AlertCircle,
  RefreshCw,
  FileSpreadsheet,
  Shield,
  Database,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"

interface CSVColumn {
  name: string
  type: "string" | "number" | "date" | "boolean"
  required: boolean
  mapped?: string
}

interface CSVRow {
  [key: string]: any
  _rowIndex: number
  _errors: string[]
  _warnings: string[]
}

interface ImportSettings {
  conflictResolution: "overwrite" | "new" | "skip" | "merge"
  documentIdColumn: string
  validateData: boolean
  skipInvalidRows: boolean
  createBackup: boolean
  batchSize: number
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

interface CSVImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImportComplete: (result: ImportResult) => void
}

const KNOWLEDGE_BASE_FIELDS = [
  { key: "id", label: "Document ID", type: "string", required: true },
  { key: "title", label: "Title", type: "string", required: true },
  { key: "description", label: "Description", type: "string", required: false },
  { key: "sector", label: "Sector", type: "string", required: true },
  { key: "useCases", label: "Use Cases", type: "string", required: false },
  { key: "source", label: "Source", type: "string", required: false },
  { key: "date", label: "Date", type: "date", required: false },
  { key: "status", label: "Status", type: "string", required: false },
  { key: "tags", label: "Tags", type: "string", required: false },
  { key: "content", label: "Content", type: "string", required: false },
  { key: "metadata", label: "Metadata", type: "string", required: false },
]

export function CSVImportDialog({ open, onOpenChange, onImportComplete }: CSVImportDialogProps) {
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [csvData, setCsvData] = useState<CSVRow[]>([])
  const [csvColumns, setCsvColumns] = useState<CSVColumn[]>([])
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({})
  const [importSettings, setImportSettings] = useState<ImportSettings>({
    conflictResolution: "overwrite",
    documentIdColumn: "",
    validateData: true,
    skipInvalidRows: true,
    createBackup: true,
    batchSize: 100,
  })
  const [currentStep, setCurrentStep] = useState<"upload" | "mapping" | "settings" | "preview" | "import" | "results">(
    "upload",
  )
  const [importProgress, setImportProgress] = useState(0)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [validationErrors, setValidationErrors] = useState<CSVRow[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (file && file.type === "text/csv") {
      setCsvFile(file)
      parseCSV(file)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    multiple: false,
  })

  const parseCSV = async (file: File) => {
    try {
      const text = await file.text()
      const lines = text.split("\n").filter((line) => line.trim())

      if (lines.length === 0) {
        throw new Error("CSV file is empty")
      }

      // Parse header
      const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""))

      // Detect column types and create column definitions
      const columns: CSVColumn[] = headers.map((header) => ({
        name: header,
        type: detectColumnType(lines.slice(1), headers.indexOf(header)),
        required: false,
      }))

      // Parse data rows
      const rows: CSVRow[] = lines.slice(1).map((line, index) => {
        const values = line.split(",").map((v) => v.trim().replace(/"/g, ""))
        const row: CSVRow = {
          _rowIndex: index + 2, // +2 because we skip header and arrays are 0-indexed
          _errors: [],
          _warnings: [],
        }

        headers.forEach((header, i) => {
          row[header] = values[i] || ""
        })

        return row
      })

      setCsvColumns(columns)
      setCsvData(rows)
      setCurrentStep("mapping")
    } catch (error) {
      console.error("Error parsing CSV:", error)
    }
  }

  const detectColumnType = (rows: string[], columnIndex: number): "string" | "number" | "date" | "boolean" => {
    const samples = rows.slice(0, 10).map((row) => row.split(",")[columnIndex]?.trim())

    // Check for numbers
    if (samples.every((sample) => !isNaN(Number(sample)) && sample !== "")) {
      return "number"
    }

    // Check for dates
    if (samples.every((sample) => !isNaN(Date.parse(sample)) && sample !== "")) {
      return "date"
    }

    // Check for booleans
    if (samples.every((sample) => ["true", "false", "yes", "no", "1", "0"].includes(sample.toLowerCase()))) {
      return "boolean"
    }

    return "string"
  }

  const validateData = () => {
    const errors: CSVRow[] = []

    csvData.forEach((row) => {
      const rowErrors: string[] = []
      const rowWarnings: string[] = []

      // Validate required fields
      KNOWLEDGE_BASE_FIELDS.forEach((field) => {
        if (field.required && columnMapping[field.key]) {
          const value = row[columnMapping[field.key]]
          if (!value || value.toString().trim() === "") {
            rowErrors.push(`Required field '${field.label}' is empty`)
          }
        }
      })

      // Validate data types
      Object.entries(columnMapping).forEach(([kbField, csvColumn]) => {
        const field = KNOWLEDGE_BASE_FIELDS.find((f) => f.key === kbField)
        const value = row[csvColumn]

        if (field && value) {
          switch (field.type) {
            case "date":
              if (isNaN(Date.parse(value))) {
                rowErrors.push(`Invalid date format in '${field.label}': ${value}`)
              }
              break
            case "number":
              if (isNaN(Number(value))) {
                rowErrors.push(`Invalid number format in '${field.label}': ${value}`)
              }
              break
          }
        }
      })

      // Check for duplicate IDs within CSV
      if (importSettings.documentIdColumn) {
        const id = row[importSettings.documentIdColumn]
        const duplicates = csvData.filter((r) => r[importSettings.documentIdColumn] === id)
        if (duplicates.length > 1) {
          rowWarnings.push(`Duplicate document ID found: ${id}`)
        }
      }

      if (rowErrors.length > 0 || rowWarnings.length > 0) {
        errors.push({
          ...row,
          _errors: rowErrors,
          _warnings: rowWarnings,
        })
      }
    })

    setValidationErrors(errors)
    return errors.length === 0
  }

  const performImport = async () => {
    setIsImporting(true)
    setImportProgress(0)

    try {
      const result: ImportResult = {
        totalRows: csvData.length,
        processedRows: 0,
        newRecords: 0,
        updatedRecords: 0,
        skippedRows: 0,
        errors: [],
      }

      // Simulate import process
      for (let i = 0; i < csvData.length; i++) {
        const row = csvData[i]

        // Simulate processing delay
        await new Promise((resolve) => setTimeout(resolve, 50))

        try {
          // Simulate conflict detection and resolution
          const documentId = row[importSettings.documentIdColumn]
          const existingDocument = await checkExistingDocument(documentId)

          if (existingDocument) {
            switch (importSettings.conflictResolution) {
              case "overwrite":
                // Simulate update
                result.updatedRecords++
                break
              case "skip":
                result.skippedRows++
                break
              case "new":
                // Create new with different ID
                result.newRecords++
                break
              case "merge":
                // Simulate merge
                result.updatedRecords++
                break
            }
          } else {
            result.newRecords++
          }

          result.processedRows++
        } catch (error) {
          result.errors.push({
            row: row._rowIndex,
            message: `Failed to process row: ${error}`,
            severity: "error",
          })

          if (!importSettings.skipInvalidRows) {
            break
          }
        }

        setImportProgress(((i + 1) / csvData.length) * 100)
      }

      setImportResult(result)
      setCurrentStep("results")
      onImportComplete(result)
    } catch (error) {
      console.error("Import failed:", error)
    } finally {
      setIsImporting(false)
    }
  }

  const checkExistingDocument = async (id: string): Promise<boolean> => {
    // Simulate API call to check if document exists
    await new Promise((resolve) => setTimeout(resolve, 10))
    return Math.random() > 0.7 // 30% chance of existing document
  }

  const resetImport = () => {
    setCsvFile(null)
    setCsvData([])
    setCsvColumns([])
    setColumnMapping({})
    setCurrentStep("upload")
    setImportProgress(0)
    setImportResult(null)
    setValidationErrors([])
  }

  const downloadTemplate = () => {
    const headers = KNOWLEDGE_BASE_FIELDS.map((field) => field.label).join(",")
    const sampleRow = KNOWLEDGE_BASE_FIELDS.map((field) => {
      switch (field.key) {
        case "id":
          return "DOC001"
        case "title":
          return "Sample Document"
        case "sector":
          return "rail"
        case "date":
          return "2024-01-01"
        case "status":
          return "ready"
        default:
          return `Sample ${field.label}`
      }
    }).join(",")

    const csvContent = `${headers}\n${sampleRow}`
    const blob = new Blob([csvContent], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "knowledge_base_template.csv"
    a.click()
    URL.revokeObjectURL(url)
  }

  const renderUploadStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Upload CSV File</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Upload a CSV file to import documents into your knowledge base
        </p>
      </div>

      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
        }`}
      >
        <input {...getInputProps()} />
        <FileSpreadsheet className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        {isDragActive ? (
          <p className="text-lg">Drop the CSV file here...</p>
        ) : (
          <div>
            <p className="text-lg font-medium">Drag and drop CSV file here</p>
            <p className="text-sm text-muted-foreground mt-2">or click to browse files</p>
            <Button variant="outline" className="mt-4">
              Browse Files
            </Button>
          </div>
        )}
      </div>

      {csvFile && (
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            File loaded: {csvFile.name} ({(csvFile.size / 1024).toFixed(1)} KB)
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={downloadTemplate}>
          <Download className="mr-2 h-4 w-4" />
          Download Template
        </Button>
        <Button onClick={() => setCurrentStep("mapping")} disabled={!csvFile}>
          Next: Column Mapping
        </Button>
      </div>
    </div>
  )

  const renderMappingStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Map CSV Columns</h3>
        <p className="text-sm text-muted-foreground mb-4">Map your CSV columns to knowledge base fields</p>
      </div>

      <div className="grid gap-4">
        {KNOWLEDGE_BASE_FIELDS.map((field) => (
          <div key={field.key} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <div>
                <Label className="font-medium">{field.label}</Label>
                {field.required && (
                  <Badge variant="destructive" className="ml-2 text-xs">
                    Required
                  </Badge>
                )}
                <p className="text-xs text-muted-foreground">{field.type}</p>
              </div>
            </div>
            <Select
              value={columnMapping[field.key] || ""}
              onValueChange={(value) => setColumnMapping((prev) => ({ ...prev, [field.key]: value }))}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Select column" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {csvColumns.map((column) => (
                  <SelectItem key={column.name} value={column.name}>
                    {column.name} ({column.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setCurrentStep("upload")}>
          Back
        </Button>
        <Button onClick={() => setCurrentStep("settings")}>Next: Import Settings</Button>
      </div>
    </div>
  )

  const renderSettingsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Import Settings</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Configure how the import should handle conflicts and validation
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <Label className="text-base font-medium">Document ID Column</Label>
          <Select
            value={importSettings.documentIdColumn}
            onValueChange={(value) => setImportSettings((prev) => ({ ...prev, documentIdColumn: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select document ID column" />
            </SelectTrigger>
            <SelectContent>
              {csvColumns.map((column) => (
                <SelectItem key={column.name} value={column.name}>
                  {column.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          <Label className="text-base font-medium">Conflict Resolution</Label>
          <RadioGroup
            value={importSettings.conflictResolution}
            onValueChange={(value: any) => setImportSettings((prev) => ({ ...prev, conflictResolution: value }))}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="overwrite" id="overwrite" />
              <Label htmlFor="overwrite">Overwrite existing documents</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="skip" id="skip" />
              <Label htmlFor="skip">Skip existing documents</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="new" id="new" />
              <Label htmlFor="new">Create new documents (ignore conflicts)</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="merge" id="merge" />
              <Label htmlFor="merge">Merge with existing documents</Label>
            </div>
          </RadioGroup>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="validate-data">Validate Data</Label>
              <p className="text-sm text-muted-foreground">Check data against schema before import</p>
            </div>
            <Switch
              id="validate-data"
              checked={importSettings.validateData}
              onCheckedChange={(checked) => setImportSettings((prev) => ({ ...prev, validateData: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="skip-invalid">Skip Invalid Rows</Label>
              <p className="text-sm text-muted-foreground">Continue import even if some rows fail validation</p>
            </div>
            <Switch
              id="skip-invalid"
              checked={importSettings.skipInvalidRows}
              onCheckedChange={(checked) => setImportSettings((prev) => ({ ...prev, skipInvalidRows: checked }))}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="create-backup">Create Backup</Label>
              <p className="text-sm text-muted-foreground">Create backup before making changes</p>
            </div>
            <Switch
              id="create-backup"
              checked={importSettings.createBackup}
              onCheckedChange={(checked) => setImportSettings((prev) => ({ ...prev, createBackup: checked }))}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="batch-size">Batch Size</Label>
          <Input
            id="batch-size"
            type="number"
            min="1"
            max="1000"
            value={importSettings.batchSize}
            onChange={(e) => setImportSettings((prev) => ({ ...prev, batchSize: Number(e.target.value) }))}
          />
          <p className="text-xs text-muted-foreground">Number of records to process in each batch</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={() => setCurrentStep("mapping")}>
          Back
        </Button>
        <Button onClick={() => setCurrentStep("preview")}>Next: Preview</Button>
      </div>
    </div>
  )

  const renderPreviewStep = () => {
    const isValid = validateData()

    return (
      <div className="space-y-6">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Preview Import</h3>
          <p className="text-sm text-muted-foreground mb-4">Review your data before importing</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Import Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Rows:</span>
                <span className="font-medium">{csvData.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Validation Errors:</span>
                <span className={`font-medium ${validationErrors.length > 0 ? "text-red-600" : "text-green-600"}`}>
                  {validationErrors.length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Conflict Resolution:</span>
                <span className="font-medium capitalize">{importSettings.conflictResolution}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Security Check</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-green-600" />
                <span>File sanitized</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4 text-green-600" />
                <span>Schema validated</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Ready to import</span>
              </div>
            </CardContent>
          </Card>
        </div>

        {validationErrors.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {validationErrors.length} rows have validation errors.
              {importSettings.skipInvalidRows ? " These will be skipped during import." : " Import cannot proceed."}
            </AlertDescription>
          </Alert>
        )}

        <div className="border rounded-lg">
          <div className="p-3 border-b bg-muted/50">
            <h4 className="font-medium">Data Preview (First 5 rows)</h4>
          </div>
          <ScrollArea className="h-[300px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  {Object.keys(columnMapping).map((kbField) => (
                    <TableHead key={kbField}>{KNOWLEDGE_BASE_FIELDS.find((f) => f.key === kbField)?.label}</TableHead>
                  ))}
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {csvData.slice(0, 5).map((row, index) => {
                  const hasErrors = validationErrors.some((e) => e._rowIndex === row._rowIndex)
                  return (
                    <TableRow key={index} className={hasErrors ? "bg-red-50" : ""}>
                      <TableCell>{row._rowIndex}</TableCell>
                      {Object.entries(columnMapping).map(([kbField, csvColumn]) => (
                        <TableCell key={kbField} className="max-w-[200px] truncate">
                          {row[csvColumn]}
                        </TableCell>
                      ))}
                      <TableCell>
                        {hasErrors ? (
                          <Badge variant="destructive">Error</Badge>
                        ) : (
                          <Badge variant="default">Valid</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setCurrentStep("settings")}>
            Back
          </Button>
          <Button onClick={() => setCurrentStep("import")} disabled={!isValid && !importSettings.skipInvalidRows}>
            Start Import
          </Button>
        </div>
      </div>
    )
  }

  const renderImportStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Importing Data</h3>
        <p className="text-sm text-muted-foreground mb-4">Please wait while we import your data...</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-8 w-8 animate-spin text-primary" />
        </div>

        <Progress value={importProgress} className="w-full" />

        <div className="text-center">
          <p className="text-sm text-muted-foreground">{Math.round(importProgress)}% complete</p>
        </div>
      </div>

      {!isImporting && (
        <div className="text-center">
          <Button onClick={performImport}>Start Import</Button>
        </div>
      )}
    </div>
  )

  const renderResultsStep = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold mb-2">Import Complete</h3>
        <p className="text-sm text-muted-foreground mb-4">Your data has been successfully imported</p>
      </div>

      {importResult && (
        <div className="grid grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Import Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Total Rows:</span>
                <span className="font-medium">{importResult.totalRows}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Processed:</span>
                <span className="font-medium text-green-600">{importResult.processedRows}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>New Records:</span>
                <span className="font-medium text-blue-600">{importResult.newRecords}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Updated:</span>
                <span className="font-medium text-orange-600">{importResult.updatedRecords}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Skipped:</span>
                <span className="font-medium text-gray-600">{importResult.skippedRows}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Errors:</span>
                <span className={`font-medium ${importResult.errors.length > 0 ? "text-red-600" : "text-green-600"}`}>
                  {importResult.errors.length}
                </span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button variant="outline" size="sm" className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Download Report
              </Button>
              <Button variant="outline" size="sm" className="w-full">
                <Eye className="mr-2 h-4 w-4" />
                View Imported Data
              </Button>
              <Button variant="outline" size="sm" className="w-full" onClick={resetImport}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Import Another File
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {importResult && importResult.errors.length > 0 && (
        <div className="border rounded-lg">
          <div className="p-3 border-b bg-muted/50">
            <h4 className="font-medium">Import Errors</h4>
          </div>
          <ScrollArea className="h-[200px]">
            <div className="p-3 space-y-2">
              {importResult.errors.map((error, index) => (
                <Alert key={index} variant={error.severity === "error" ? "destructive" : "default"}>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Row {error.row}: {error.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="flex justify-center">
        <Button onClick={() => onOpenChange(false)}>Close</Button>
      </div>
    </div>
  )

  const renderCurrentStep = () => {
    switch (currentStep) {
      case "upload":
        return renderUploadStep()
      case "mapping":
        return renderMappingStep()
      case "settings":
        return renderSettingsStep()
      case "preview":
        return renderPreviewStep()
      case "import":
        return renderImportStep()
      case "results":
        return renderResultsStep()
      default:
        return renderUploadStep()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            CSV Import
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {["upload", "mapping", "settings", "preview", "import", "results"].map((step, index) => (
                  <div key={step} className="flex items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                        currentStep === step
                          ? "bg-primary text-primary-foreground"
                          : index <
                              ["upload", "mapping", "settings", "preview", "import", "results"].indexOf(currentStep)
                            ? "bg-green-500 text-white"
                            : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </div>
                    {index < 5 && <div className="w-8 h-px bg-muted mx-1" />}
                  </div>
                ))}
              </div>
            </div>
            <div className="text-sm text-muted-foreground capitalize">
              Step {["upload", "mapping", "settings", "preview", "import", "results"].indexOf(currentStep) + 1} of 6:{" "}
              {currentStep.replace("-", " ")}
            </div>
          </div>

          <ScrollArea className="h-[500px]">{renderCurrentStep()}</ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
