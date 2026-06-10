"use client"

import { useState } from "react"
import { Save, FileText, Upload, Database, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"

export function DocumentSettings() {
  const { toast } = useToast()
  const [settings, setSettings] = useState({
    maxFileSize: "200",
    allowedFileTypes: ["pdf", "docx", "txt", "csv", "md"],
    autoProcessing: true,
    chunkSize: "1000",
    chunkOverlap: "200",
    enableOCR: true,
    ocrLanguage: "en",
    retentionPeriod: "365",
    enableVersioning: true,
    maxVersions: "5",
    enableAutoTagging: true,
    enableDuplicateDetection: true,
    duplicateThreshold: "0.85",
    enableWebScraping: true,
    scrapingTimeout: "30",
    enableBulkOperations: true,
    enableCSVImport: true,
  })

  const fileTypes = [
    { id: "pdf", label: "PDF Documents" },
    { id: "docx", label: "Word Documents" },
    { id: "txt", label: "Text Files" },
    { id: "csv", label: "CSV Files" },
    { id: "md", label: "Markdown Files" },
    { id: "html", label: "HTML Files" },
    { id: "xlsx", label: "Excel Files" },
  ]

  const handleSave = () => {
    toast({
      title: "Document settings saved",
      description: "Document processing settings have been updated successfully.",
    })
  }

  const handleInputChange = (key: string, value: string | boolean | string[]) => {
    setSettings((prev) => ({ ...prev, [key]: value }))
  }

  const handleFileTypeChange = (fileType: string, checked: boolean) => {
    const newTypes = checked
      ? [...settings.allowedFileTypes, fileType]
      : settings.allowedFileTypes.filter((type) => type !== fileType)
    handleInputChange("allowedFileTypes", newTypes)
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="max-file-size">Maximum File Size (MB)</Label>
              <Input
                id="max-file-size"
                type="number"
                value={settings.maxFileSize}
                onChange={(e) => handleInputChange("maxFileSize", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retention-period">Document Retention (days)</Label>
              <Input
                id="retention-period"
                type="number"
                value={settings.retentionPeriod}
                onChange={(e) => handleInputChange("retentionPeriod", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Allowed File Types</Label>
            <div className="grid gap-2 md:grid-cols-2">
              {fileTypes.map((fileType) => (
                <div key={fileType.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={fileType.id}
                    checked={settings.allowedFileTypes.includes(fileType.id)}
                    onCheckedChange={(checked) => handleFileTypeChange(fileType.id, checked as boolean)}
                  />
                  <Label htmlFor={fileType.id} className="text-sm font-normal">
                    {fileType.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto Processing</Label>
              <p className="text-sm text-muted-foreground">Automatically process uploaded documents</p>
            </div>
            <Switch
              checked={settings.autoProcessing}
              onCheckedChange={(checked) => handleInputChange("autoProcessing", checked)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Processing Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="chunk-size">Chunk Size (characters)</Label>
              <Input
                id="chunk-size"
                type="number"
                value={settings.chunkSize}
                onChange={(e) => handleInputChange("chunkSize", e.target.value)}
                min="500"
                max="2000"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chunk-overlap">Chunk Overlap (characters)</Label>
              <Input
                id="chunk-overlap"
                type="number"
                value={settings.chunkOverlap}
                onChange={(e) => handleInputChange("chunkOverlap", e.target.value)}
                min="0"
                max="500"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable OCR</Label>
                <p className="text-sm text-muted-foreground">Extract text from images and scanned documents</p>
              </div>
              <Switch
                checked={settings.enableOCR}
                onCheckedChange={(checked) => handleInputChange("enableOCR", checked)}
              />
            </div>

            {settings.enableOCR && (
              <div className="space-y-2">
                <Label htmlFor="ocr-language">OCR Language</Label>
                <Select value={settings.ocrLanguage} onValueChange={(value) => handleInputChange("ocrLanguage", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="fr">French</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Auto Tagging</Label>
                <p className="text-sm text-muted-foreground">Automatically extract and assign tags to documents</p>
              </div>
              <Switch
                checked={settings.enableAutoTagging}
                onCheckedChange={(checked) => handleInputChange("enableAutoTagging", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Versioning</Label>
                <p className="text-sm text-muted-foreground">Keep track of document versions</p>
              </div>
              <Switch
                checked={settings.enableVersioning}
                onCheckedChange={(checked) => handleInputChange("enableVersioning", checked)}
              />
            </div>

            {settings.enableVersioning && (
              <div className="space-y-2">
                <Label htmlFor="max-versions">Maximum Versions to Keep</Label>
                <Input
                  id="max-versions"
                  type="number"
                  value={settings.maxVersions}
                  onChange={(e) => handleInputChange("maxVersions", e.target.value)}
                  min="1"
                  max="10"
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Duplicate Detection</Label>
                <p className="text-sm text-muted-foreground">Detect and prevent duplicate document uploads</p>
              </div>
              <Switch
                checked={settings.enableDuplicateDetection}
                onCheckedChange={(checked) => handleInputChange("enableDuplicateDetection", checked)}
              />
            </div>

            {settings.enableDuplicateDetection && (
              <div className="space-y-2">
                <Label htmlFor="duplicate-threshold">Duplicate Detection Threshold</Label>
                <Select
                  value={settings.duplicateThreshold}
                  onValueChange={(value) => handleInputChange("duplicateThreshold", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.95">Very Strict (95%)</SelectItem>
                    <SelectItem value="0.85">Strict (85%)</SelectItem>
                    <SelectItem value="0.75">Moderate (75%)</SelectItem>
                    <SelectItem value="0.65">Lenient (65%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            Advanced Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Web Scraping</Label>
                <p className="text-sm text-muted-foreground">Allow importing content from web URLs</p>
              </div>
              <Switch
                checked={settings.enableWebScraping}
                onCheckedChange={(checked) => handleInputChange("enableWebScraping", checked)}
              />
            </div>

            {settings.enableWebScraping && (
              <div className="space-y-2">
                <Label htmlFor="scraping-timeout">Web Scraping Timeout (seconds)</Label>
                <Input
                  id="scraping-timeout"
                  type="number"
                  value={settings.scrapingTimeout}
                  onChange={(e) => handleInputChange("scrapingTimeout", e.target.value)}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Bulk Operations</Label>
                <p className="text-sm text-muted-foreground">Allow bulk editing and operations on documents</p>
              </div>
              <Switch
                checked={settings.enableBulkOperations}
                onCheckedChange={(checked) => handleInputChange("enableBulkOperations", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable CSV Import</Label>
                <p className="text-sm text-muted-foreground">Allow importing document metadata via CSV</p>
              </div>
              <Switch
                checked={settings.enableCSVImport}
                onCheckedChange={(checked) => handleInputChange("enableCSVImport", checked)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Document Settings
        </Button>
      </div>
    </div>
  )
}
