"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Plus,
  Globe,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
  Download,
  Brain,
  Clock,
  Target,
  Minus,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import apiClient, { type DocumentMetadata, type UseCase } from "@/lib/api-client"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface UploadFile {
  file: File
  id: string
  progress: number
  status: "pending" | "analyzing" | "chunking" | "uploading" | "processing" | "complete" | "error"
  metadata: Partial<DocumentMetadata>
  chunkingProgress?: number
  analysisResults?: {
    contentType: string
    complexity: "low" | "medium" | "high"
    recommendedChunking: ChunkingMethod
    estimatedChunks: number
  }
}

interface ChunkingMethod {
  type: "ai-decide" | "fixed-size" | "semantic" | "paragraph" | "sentence" | "custom"
  size?: number
  overlap?: number
  strategy?: string
}

interface ProcessingOptions {
  chunkingMode: "ai-managed" | "manual"
  chunkingMethod: ChunkingMethod
  automaticTopicExtraction: boolean
  aiSupplement: boolean
  metadataMode: "ai-managed" | "manual"
}

interface ScrapingOptions {
  mode: "single" | "crawl"
  maxDepth: number
  maxPages: number
  extractLinks: boolean
  extractData: boolean
  followExternalLinks: boolean
  respectRobots: boolean
  chunkingMode: "ai-managed" | "manual"
  chunkingMethod: ChunkingMethod
}

interface ScrapingProgress {
  phase: "connecting" | "analyzing" | "scraping" | "chunking" | "processing" | "complete" | "error"
  progress: number
  currentUrl?: string
  pagesScraped?: number
  totalPages?: number
  chunkingProgress?: number
}

interface MetadataState {
  title: string
  domain: string
  useCase: string
  topics: string[]
  tags: string[]
  description: string
}

interface Domain {
  id: string
  name: string
  topics: string[]
}

export function DocumentUpload() {
  const [uploadFiles, setUploadFiles] = useState<UploadFile[]>([])
  const [activeTab, setActiveTab] = useState<"upload" | "scrape">("upload")
  const [processingOptions, setProcessingOptions] = useState<ProcessingOptions>({
    chunkingMode: "ai-managed",
    chunkingMethod: { type: "ai-decide" },
    automaticTopicExtraction: true,
    aiSupplement: true,
    metadataMode: "ai-managed",
  })

  const [metadata, setMetadata] = useState<MetadataState>({
    title: "",
    domain: "general",
    useCase: "",
    topics: [],
    tags: [],
    description: "",
  })

  const [scrapingOptions, setScrapingOptions] = useState<ScrapingOptions>({
    mode: "single",
    maxDepth: 2,
    maxPages: 10,
    extractLinks: true,
    extractData: true,
    followExternalLinks: false,
    respectRobots: true,
    chunkingMode: "ai-managed",
    chunkingMethod: { type: "ai-decide" },
  })

  const [scrapingProgress, setScrapingProgress] = useState<ScrapingProgress | null>(null)
  const [urlToScrape, setUrlToScrape] = useState("")
  const [newTopic, setNewTopic] = useState("")
  const [newTag, setNewTag] = useState("")
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [isScrapingAdvancedOpen, setIsScrapingAdvancedOpen] = useState(false)
  const [isChunkingOpen, setIsChunkingOpen] = useState(false)
  const [isMetadataOpen, setIsMetadataOpen] = useState(false)

  const [domains] = useState<Domain[]>([
    {
      id: "rail",
      name: "Rail",
      topics: ["Rail Infrastructure", "Station Management", "Railway Safety", "Electrification"],
    },
    {
      id: "maritime",
      name: "Maritime",
      topics: ["Maritime Infrastructure", "Ports", "Shipping Systems", "Maritime Safety"],
    },
    {
      id: "highways",
      name: "Highways",
      topics: ["Road Infrastructure", "Traffic Management", "Highway Safety", "Smart Roads"],
    },
    {
      id: "general",
      name: "General",
      topics: ["Funding Opportunities", "Innovation Strategy", "Research Ethics", "Policy Development"],
    },
  ])

  const useCaseOptions: { value: UseCase; label: string; category: string }[] = [
    { value: "strategy", label: "Strategy", category: "Strategic" },
    { value: "general", label: "General", category: "General" },
    { value: "Quick Playbook Answers", label: "Quick Playbook Answers", category: "Operational" },
    { value: "Lessons Learned", label: "Lessons Learned", category: "Knowledge" },
    { value: "Project Review / MOT", label: "Project Review / MOT", category: "Assessment" },
    { value: "TRL / RIRL Mapping", label: "TRL / RIRL Mapping", category: "Analysis" },
    { value: "Project Similarity", label: "Project Similarity", category: "Analysis" },
    { value: "Change Management", label: "Change Management", category: "Strategic" },
    { value: "Product Acceptance", label: "Product Acceptance", category: "Assessment" },
  ]

  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [queueStats, setQueueStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    processing: 0,
  })
  const [previewFile, setPreviewFile] = useState<UploadFile | null>(null)
  const [bulkMetadata, setBulkMetadata] = useState<Partial<DocumentMetadata>>({})
  const [showBulkEdit, setShowBulkEdit] = useState(false)

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const newFiles: UploadFile[] = acceptedFiles.map((file) => ({
        file,
        id: Math.random().toString(36).substr(2, 9),
        progress: 0,
        status: "pending",
        metadata: {
          title: metadata.title || file.name.replace(/\.[^/.]+$/, ""),
          sector: metadata.domain as any,
          useCase: metadata.useCase as UseCase,
        },
      }))

      setUploadFiles((prev) => [...prev, ...newFiles])

      // Start AI analysis for AI-managed chunking
      if (processingOptions.chunkingMode === "ai-managed") {
        newFiles.forEach((file) => analyzeFileForChunking(file))
      }
    },
    [metadata, processingOptions.chunkingMode],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "text/plain": [".txt"],
      "text/csv": [".csv"],
      "text/markdown": [".md"],
      "text/html": [".html"],
    },
    multiple: true,
  })

  const analyzeFileForChunking = async (file: UploadFile) => {
    setUploadFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, status: "analyzing", progress: 10 } : f)))

    // Simulate AI analysis
    await new Promise((resolve) => setTimeout(resolve, 2000))

    const analysisResults = {
      contentType: file.file.type.includes("pdf") ? "PDF Document" : "Text Document",
      complexity: (["low", "medium", "high"] as const)[Math.floor(Math.random() * 3)],
      recommendedChunking: {
        type: "semantic" as const,
        size: 800,
        overlap: 150,
        strategy: "Context-aware semantic boundaries",
      },
      estimatedChunks: Math.ceil(file.file.size / 1000),
    }

    setUploadFiles((prev) =>
      prev.map((f) => (f.id === file.id ? { ...f, status: "pending", progress: 0, analysisResults } : f)),
    )
  }

  const addTopic = () => {
    if (newTopic && !metadata.topics.includes(newTopic)) {
      setMetadata((prev) => ({ ...prev, topics: [...prev.topics, newTopic] }))
      setNewTopic("")
    }
  }

  const removeTopic = (topic: string) => {
    setMetadata((prev) => ({ ...prev, topics: prev.topics.filter((t) => t !== topic) }))
  }

  const addTag = () => {
    if (newTag && !metadata.tags.includes(newTag)) {
      setMetadata((prev) => ({ ...prev, tags: [...prev.tags, newTag] }))
      setNewTag("")
    }
  }

  const removeTag = (tag: string) => {
    setMetadata((prev) => ({ ...prev, tags: prev.tags.filter((t) => t !== tag) }))
  }

  const handleUrlScrape = async () => {
    if (!urlToScrape) return

    setScrapingProgress({
      phase: "connecting",
      progress: 0,
      currentUrl: urlToScrape,
    })

    // Simulate scraping phases
    const phases = [
      { phase: "connecting" as const, duration: 1000, progress: 15 },
      { phase: "analyzing" as const, duration: 1500, progress: 30 },
      { phase: "scraping" as const, duration: 3000, progress: 60 },
      { phase: "chunking" as const, duration: 2000, progress: 85 },
      { phase: "processing" as const, duration: 1000, progress: 95 },
      { phase: "complete" as const, duration: 500, progress: 100 },
    ]

    for (const phaseData of phases) {
      await new Promise((resolve) => setTimeout(resolve, phaseData.duration))
      setScrapingProgress((prev) => ({
        ...prev!,
        phase: phaseData.phase,
        progress: phaseData.progress,
        pagesScraped: phaseData.phase === "scraping" ? Math.floor(Math.random() * 5) + 1 : prev?.pagesScraped,
        totalPages: scrapingOptions.mode === "crawl" ? scrapingOptions.maxPages : 1,
        chunkingProgress: phaseData.phase === "chunking" ? phaseData.progress - 60 : undefined,
      }))
    }

    setTimeout(() => {
      setScrapingProgress(null)
      setUrlToScrape("")
    }, 2000)
  }

  const uploadAllFiles = async () => {
    const pendingFiles = uploadFiles.filter((file) => file.status === "pending")
    for (const file of pendingFiles) {
      await uploadFile(file)
    }
  }

  const uploadFile = async (uploadFile: UploadFile) => {
    // Chunking phase
    setUploadFiles((prev) =>
      prev.map((file) => (file.id === uploadFile.id ? { ...file, status: "chunking", progress: 0 } : file)),
    )

    // Simulate chunking progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise((resolve) => setTimeout(resolve, 100))
      setUploadFiles((prev) =>
        prev.map((file) => (file.id === uploadFile.id ? { ...file, chunkingProgress: i, progress: i * 0.3 } : file)),
      )
    }

    // Upload phase
    setUploadFiles((prev) =>
      prev.map((file) =>
        file.id === uploadFile.id ? { ...file, status: "uploading", chunkingProgress: undefined } : file,
      ),
    )

    const progressInterval = setInterval(() => {
      setUploadFiles((prev) =>
        prev.map((file) => {
          if (file.id === uploadFile.id && file.progress < 90) {
            return { ...file, progress: file.progress + 10 }
          }
          return file
        }),
      )
    }, 200)

    try {
      const response = await apiClient.documents.upload(uploadFile.file, uploadFile.metadata as DocumentMetadata)
      clearInterval(progressInterval)
      setUploadFiles((prev) =>
        prev.map((file) =>
          file.id === uploadFile.id
            ? { ...file, progress: 100, status: response.status === "processing" ? "processing" : "complete" }
            : file,
        ),
      )
    } catch (error) {
      clearInterval(progressInterval)
      setUploadFiles((prev) => prev.map((file) => (file.id === uploadFile.id ? { ...file, status: "error" } : file)))
    }
  }

  const removeFile = (fileId: string) => {
    setUploadFiles((prev) => prev.filter((file) => file.id !== fileId))
  }

  const getStatusIcon = (status: UploadFile["status"]) => {
    switch (status) {
      case "complete":
        return <CheckCircle className="h-5 w-5 text-green-500" />
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />
      case "analyzing":
        return <Brain className="h-5 w-5 text-blue-500 animate-pulse" />
      case "chunking":
        return <Settings className="h-5 w-5 text-orange-500 animate-spin" />
      case "processing":
      case "uploading":
        return <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      default:
        return <FileText className="h-5 w-5 text-muted-foreground" />
    }
  }

  const getStatusBadge = (status: UploadFile["status"]) => {
    switch (status) {
      case "complete":
        return <Badge className="bg-green-100 text-green-800">Complete</Badge>
      case "analyzing":
        return <Badge className="bg-blue-100 text-blue-800">Analyzing</Badge>
      case "chunking":
        return <Badge className="bg-orange-100 text-orange-800">Chunking</Badge>
      case "processing":
        return <Badge variant="secondary">Processing</Badge>
      case "uploading":
        return <Badge variant="secondary">Uploading</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="outline">Pending</Badge>
    }
  }

  const getScrapingPhaseLabel = (phase: ScrapingProgress["phase"]) => {
    switch (phase) {
      case "connecting":
        return "Connecting to website..."
      case "analyzing":
        return "Analyzing content structure..."
      case "scraping":
        return "Extracting content..."
      case "chunking":
        return "Processing content chunks..."
      case "processing":
        return "Finalizing..."
      case "complete":
        return "Complete!"
      default:
        return "Processing..."
    }
  }

  const selectedDomain = domains.find((d) => d.id === metadata.domain)

  const ChunkingConfiguration = ({
    chunkingMode,
    chunkingMethod,
    onChunkingModeChange,
    onChunkingMethodChange,
  }: {
    chunkingMode: "ai-managed" | "manual"
    chunkingMethod: ChunkingMethod
    onChunkingModeChange: (mode: "ai-managed" | "manual") => void
    onChunkingMethodChange: (method: ChunkingMethod) => void
  }) => (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <Target className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Chunking Configuration</span>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {chunkingMode === "ai-managed" ? "AI-Managed" : "Manual"}
          </Badge>
        </div>
        <Select value={chunkingMode} onValueChange={onChunkingModeChange}>
          <SelectTrigger className="w-[140px] border-0 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ai-managed">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                <span>AI-Managed</span>
              </div>
            </SelectItem>
            <SelectItem value="manual">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Manual</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {chunkingMode === "ai-managed" && (
        <div className="p-4 border rounded-lg bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="font-medium text-primary">AI-Managed Chunking</span>
          </div>
          <p className="text-sm text-muted-foreground">
            AI automatically analyzes your content and determines the optimal chunking strategy based on document type,
            complexity, and content structure. This ensures the best retrieval performance.
          </p>

          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="text-sm font-medium mb-2">AI will consider:</div>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-primary" />
                Document structure and formatting
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-primary" />
                Content complexity and density
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-primary" />
                Natural semantic boundaries
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="h-3 w-3 text-primary" />
                Optimal retrieval performance
              </li>
            </ul>
          </div>
        </div>
      )}

      {chunkingMode === "manual" && (
        <div className="p-4 border rounded-lg bg-muted/30">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Chunk Size</Label>
              <div className="flex items-center gap-1 bg-background border rounded-md">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none hover:bg-muted"
                  onClick={() =>
                    onChunkingMethodChange({
                      ...chunkingMethod,
                      size: Math.max(500, (chunkingMethod.size || 1000) - 100),
                    })
                  }
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1 text-center py-1 text-sm font-medium bg-muted/50">
                  {chunkingMethod.size || 1000}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none hover:bg-muted"
                  onClick={() =>
                    onChunkingMethodChange({
                      ...chunkingMethod,
                      size: Math.min(2000, (chunkingMethod.size || 1000) + 100),
                    })
                  }
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Chunk Overlap</Label>
              <div className="flex items-center gap-1 bg-background border rounded-md">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none hover:bg-muted"
                  onClick={() =>
                    onChunkingMethodChange({
                      ...chunkingMethod,
                      overlap: Math.max(0, (chunkingMethod.overlap || 200) - 50),
                    })
                  }
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <div className="flex-1 text-center py-1 text-sm font-medium bg-muted/50">
                  {chunkingMethod.overlap || 200}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-none hover:bg-muted"
                  onClick={() =>
                    onChunkingMethodChange({
                      ...chunkingMethod,
                      overlap: Math.min(500, (chunkingMethod.overlap || 200) + 50),
                    })
                  }
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">Strategy</Label>
              <Select
                value={chunkingMethod.type}
                onValueChange={(value) =>
                  onChunkingMethodChange({ ...chunkingMethod, type: value as ChunkingMethod["type"] })
                }
              >
                <SelectTrigger className="bg-muted/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed-size">Fixed Size</SelectItem>
                  <SelectItem value="semantic">Semantic</SelectItem>
                  <SelectItem value="paragraph">Paragraph</SelectItem>
                  <SelectItem value="sentence">Sentence</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mt-4 text-xs text-muted-foreground">
            Overlap: {Math.round(((chunkingMethod.overlap || 200) / (chunkingMethod.size || 1000)) * 100)}% • Estimated
            chunks: ~{Math.ceil(2000 / (chunkingMethod.size || 1000))} per 2KB
          </div>
        </div>
      )}
    </div>
  )

  const MetadataConfiguration = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 border rounded-lg bg-background hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <span className="font-medium">Topics, Tags & AI Supplement</span>
          <Badge variant="secondary" className="bg-primary/10 text-primary">
            {processingOptions.metadataMode === "ai-managed" ? "AI-Managed" : "Manual"}
          </Badge>
        </div>
        <Select
          value={processingOptions.metadataMode}
          onValueChange={(value: "ai-managed" | "manual") =>
            setProcessingOptions((prev) => ({ ...prev, metadataMode: value }))
          }
        >
          <SelectTrigger className="w-[140px] border-0 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ai-managed">
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                <span>AI-Managed</span>
              </div>
            </SelectItem>
            <SelectItem value="manual">
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                <span>Manual</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {processingOptions.metadataMode === "ai-managed" && (
        <div className="p-4 border rounded-lg bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="h-4 w-4 text-primary" />
            <span className="font-medium text-primary">AI-Managed Metadata</span>
          </div>
          <p className="text-sm text-muted-foreground">
            AI automatically extracts and generates relevant topics and tags from your content. This ensures
            comprehensive categorization and improved searchability without manual effort.
          </p>

          <div className="mt-4 pt-4 border-t border-border/50">
            <div className="text-sm font-medium mb-2">AI will extract:</div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <div className="text-sm font-medium">Topics</div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline" className="bg-primary/10">
                    Auto-detected
                  </Badge>
                  <Badge variant="outline" className="bg-primary/10">
                    Content-based
                  </Badge>
                  <Badge variant="outline" className="bg-primary/10">
                    Domain-specific
                  </Badge>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-sm font-medium">Tags</div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="outline">Keywords</Badge>
                  <Badge variant="outline">Entities</Badge>
                  <Badge variant="outline">Categories</Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {processingOptions.metadataMode === "manual" && (
        <div className="p-4 border rounded-lg bg-muted/30">
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Topics</Label>
                  <span className="text-xs text-muted-foreground">
                    {processingOptions.aiSupplement ? "AI enhanced" : "Manual only"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 border rounded-md p-2 min-h-[60px] bg-background">
                  {metadata.topics.map((topic) => (
                    <Badge key={topic} className="bg-primary/20 text-primary hover:bg-primary/30">
                      {topic}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 ml-1 p-0"
                        onClick={() => removeTopic(topic)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      placeholder="Add topic..."
                      value={newTopic}
                      onChange={(e) => setNewTopic(e.target.value)}
                      className="h-7 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTopic())}
                    />
                    <Button variant="outline" size="sm" onClick={addTopic} className="h-7">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">Tags</Label>
                  <span className="text-xs text-muted-foreground">
                    {processingOptions.aiSupplement ? "AI enhanced" : "Manual only"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 border rounded-md p-2 min-h-[60px] bg-background">
                  {metadata.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                      <Button variant="ghost" size="icon" className="h-4 w-4 ml-1 p-0" onClick={() => removeTag(tag)}>
                        <X className="h-3 w-3" />
                      </Button>
                    </Badge>
                  ))}
                  <div className="flex items-center gap-2 mt-1">
                    <Input
                      placeholder="Add tag..."
                      value={newTag}
                      onChange={(e) => setNewTag(e.target.value)}
                      className="h-7 text-sm"
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                    />
                    <Button variant="outline" size="sm" onClick={addTag} className="h-7">
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center space-x-2">
              <Switch
                id="ai-supplement"
                checked={processingOptions.aiSupplement}
                onCheckedChange={(checked) => setProcessingOptions((prev) => ({ ...prev, aiSupplement: checked }))}
              />
              <Label htmlFor="ai-supplement" className="text-sm">
                AI supplement manual entries
              </Label>
            </div>
            <div className="text-xs text-muted-foreground">
              {processingOptions.aiSupplement ? "AI will enhance your entries" : "Manual entries only"}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  const BasicMetadataSection = () => (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Domain</Label>
          <Select
            value={metadata.domain}
            onValueChange={(value) => setMetadata((prev) => ({ ...prev, domain: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select domain" />
            </SelectTrigger>
            <SelectContent>
              {domains.map((domain) => (
                <SelectItem key={domain.id} value={domain.id}>
                  {domain.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Use Case</Label>
          <Select
            value={metadata.useCase}
            onValueChange={(value) => setMetadata((prev) => ({ ...prev, useCase: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select use case" />
            </SelectTrigger>
            <SelectContent>
              {useCaseOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <span>{option.label}</span>
                    <Badge variant="outline" className="text-xs">
                      {option.category}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Title Override (Optional)</Label>
        <Input
          placeholder="Leave empty for auto-generated title"
          value={metadata.title}
          onChange={(e) => setMetadata((prev) => ({ ...prev, title: e.target.value }))}
        />
      </div>

      <div className="space-y-2">
        <Label>Description (Optional)</Label>
        <Textarea
          placeholder="Brief description of the content..."
          value={metadata.description}
          onChange={(e) => setMetadata((prev) => ({ ...prev, description: e.target.value }))}
          rows={2}
        />
      </div>
    </div>
  )

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) => (prev.includes(fileId) ? prev.filter((id) => id !== fileId) : [...prev, fileId]))
  }

  const getFilePreview = (file: UploadFile) => {
    const fileType = file.file.type
    if (fileType.startsWith("image/")) {
      return URL.createObjectURL(file.file)
    }
    return null
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const getEstimatedTime = (file: UploadFile) => {
    if (file.status === "pending") return "Waiting..."
    if (file.status === "complete") return "Completed"
    if (file.status === "error") return "Failed"

    const remainingProgress = 100 - file.progress
    const estimatedSeconds = (remainingProgress / 10) * 2 // Rough estimate
    return `~${estimatedSeconds}s remaining`
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header with Queue Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Content Management</h1>
          <p className="text-muted-foreground">Upload documents or scrape web content with intelligent processing</p>
        </div>
        {uploadFiles.length > 0 && (
          <Card className="p-4 min-w-[200px]">
            <div className="text-sm space-y-1">
              <div className="font-medium">Queue Status</div>
              <div className="flex justify-between">
                <span>Total:</span>
                <span>{uploadFiles.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Completed:</span>
                <span className="text-green-600">{uploadFiles.filter((f) => f.status === "complete").length}</span>
              </div>
              <div className="flex justify-between">
                <span>Processing:</span>
                <span className="text-blue-600">
                  {
                    uploadFiles.filter((f) => ["analyzing", "chunking", "uploading", "processing"].includes(f.status))
                      .length
                  }
                </span>
              </div>
              <div className="flex justify-between">
                <span>Failed:</span>
                <span className="text-red-600">{uploadFiles.filter((f) => f.status === "error").length}</span>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Bulk Operations Bar */}
      {selectedFiles.length > 0 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={selectedFiles.length === uploadFiles.length}
                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedFiles(uploadFiles.map((f) => f.id))
                      } else {
                        setSelectedFiles([])
                      }
                    }}
                  />
                  <span className="font-medium">{selectedFiles.length} files selected</span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const filesToRemove = uploadFiles.filter((f) => selectedFiles.includes(f.id))
                      setUploadFiles((prev) => prev.filter((f) => !selectedFiles.includes(f.id)))
                      setSelectedFiles([])
                    }}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove Selected
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowBulkEdit(true)}>
                    <Settings className="h-4 w-4 mr-1" />
                    Edit Metadata
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const pendingFiles = uploadFiles.filter(
                        (f) => selectedFiles.includes(f.id) && f.status === "pending",
                      )
                      pendingFiles.forEach((file) => uploadFile(file))
                    }}
                    disabled={!uploadFiles.some((f) => selectedFiles.includes(f.id) && f.status === "pending")}
                  >
                    <Upload className="h-4 w-4 mr-1" />
                    Upload Selected
                  </Button>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedFiles([])}>
                Clear Selection
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Content Input & Processing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "upload" | "scrape")}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="upload" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Document Upload
              </TabsTrigger>
              <TabsTrigger value="scrape" className="flex items-center gap-2">
                <Globe className="h-4 w-4" />
                Web Scraping
              </TabsTrigger>
            </TabsList>

            <TabsContent value="upload" className="space-y-6">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                {isDragActive ? (
                  <p className="text-lg">Drop the files here...</p>
                ) : (
                  <div>
                    <p className="text-lg font-medium">Drag and drop files here</p>
                    <p className="text-sm text-muted-foreground mt-2">
                      Limit 200MB per file • PDF, DOCX, TXT, CSV, HTML, MD
                    </p>
                    <Button variant="outline" className="mt-4">
                      Browse Files
                    </Button>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="scrape" className="space-y-6">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter website URL to scrape (https://...)"
                    value={urlToScrape}
                    onChange={(e) => setUrlToScrape(e.target.value)}
                    className="flex-1"
                  />
                  <Button onClick={handleUrlScrape} disabled={!urlToScrape || scrapingProgress !== null}>
                    <Globe className="mr-2 h-4 w-4" />
                    Start Scraping
                  </Button>
                </div>

                {scrapingProgress && (
                  <Card className="border-primary/20 bg-primary/5">
                    <CardContent className="pt-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Clock className="h-4 w-4 text-primary animate-pulse" />
                            <span className="font-medium">{getScrapingPhaseLabel(scrapingProgress.phase)}</span>
                          </div>
                          <Badge variant="outline">{scrapingProgress.progress}%</Badge>
                        </div>
                        <Progress value={scrapingProgress.progress} className="w-full" />
                        <div className="text-sm text-muted-foreground">
                          {scrapingProgress.currentUrl && <div>Processing: {scrapingProgress.currentUrl}</div>}
                          {scrapingProgress.pagesScraped && scrapingProgress.totalPages && (
                            <div>
                              Pages: {scrapingProgress.pagesScraped} / {scrapingProgress.totalPages}
                            </div>
                          )}
                          {scrapingProgress.chunkingProgress !== undefined && (
                            <div>Chunking progress: {scrapingProgress.chunkingProgress}%</div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Scraping Mode</Label>
                    <Select
                      value={scrapingOptions.mode}
                      onValueChange={(value: "single" | "crawl") =>
                        setScrapingOptions((prev) => ({ ...prev, mode: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="single">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4" />
                            <span>Single Page</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="crawl">
                          <div className="flex items-center gap-2">
                            <Search className="h-4 w-4" />
                            <span>Site Crawl</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {scrapingOptions.mode === "crawl" && (
                    <div className="space-y-2">
                      <Label>Max Pages</Label>
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        value={scrapingOptions.maxPages}
                        onChange={(e) =>
                          setScrapingOptions((prev) => ({ ...prev, maxPages: Number.parseInt(e.target.value) || 10 }))
                        }
                      />
                    </div>
                  )}
                </div>

                <Collapsible open={isScrapingAdvancedOpen} onOpenChange={setIsScrapingAdvancedOpen}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4" />
                        <span className="text-sm font-medium">Advanced Scraping Options</span>
                      </div>
                      {isScrapingAdvancedOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-4 mt-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="extract-links"
                            checked={scrapingOptions.extractLinks}
                            onCheckedChange={(checked) =>
                              setScrapingOptions((prev) => ({ ...prev, extractLinks: checked as boolean }))
                            }
                          />
                          <Label htmlFor="extract-links" className="text-sm">
                            Extract links
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="extract-data"
                            checked={scrapingOptions.extractData}
                            onCheckedChange={(checked) =>
                              setScrapingOptions((prev) => ({ ...prev, extractData: checked as boolean }))
                            }
                          />
                          <Label htmlFor="extract-data" className="text-sm">
                            Extract structured data
                          </Label>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="external-links"
                            checked={scrapingOptions.followExternalLinks}
                            onCheckedChange={(checked) =>
                              setScrapingOptions((prev) => ({ ...prev, followExternalLinks: checked as boolean }))
                            }
                          />
                          <Label htmlFor="external-links" className="text-sm">
                            Follow external links
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            id="respect-robots"
                            checked={scrapingOptions.respectRobots}
                            onCheckedChange={(checked) =>
                              setScrapingOptions((prev) => ({ ...prev, respectRobots: checked as boolean }))
                            }
                          />
                          <Label htmlFor="respect-robots" className="text-sm">
                            Respect robots.txt
                          </Label>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              </div>
            </TabsContent>
          </Tabs>

          <Separator />

          <ChunkingConfiguration
            chunkingMode={activeTab === "upload" ? processingOptions.chunkingMode : scrapingOptions.chunkingMode}
            chunkingMethod={activeTab === "upload" ? processingOptions.chunkingMethod : scrapingOptions.chunkingMethod}
            onChunkingModeChange={(mode) => {
              if (activeTab === "upload") {
                setProcessingOptions((prev) => ({ ...prev, chunkingMode: mode }))
              } else {
                setScrapingOptions((prev) => ({ ...prev, chunkingMode: mode }))
              }
            }}
            onChunkingMethodChange={(method) => {
              if (activeTab === "upload") {
                setProcessingOptions((prev) => ({ ...prev, chunkingMethod: method }))
              } else {
                setScrapingOptions((prev) => ({ ...prev, chunkingMethod: method }))
              }
            }}
          />

          <Separator />

          <BasicMetadataSection />

          <Separator />

          <MetadataConfiguration />

          <div className="flex gap-2 pt-4">
            <Button
              onClick={activeTab === "upload" ? uploadAllFiles : handleUrlScrape}
              disabled={activeTab === "upload" ? uploadFiles.length === 0 : !urlToScrape || scrapingProgress !== null}
              className="bg-primary"
            >
              {activeTab === "upload" ? (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Process Files ({uploadFiles.length})
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Start Scraping
                </>
              )}
            </Button>
            <Button variant="outline">
              <Settings className="mr-2 h-4 w-4" />
              Save as Template
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Upload Queue */}
      {uploadFiles.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Processing Queue ({uploadFiles.length})</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (selectedFiles.length === uploadFiles.length) {
                    setSelectedFiles([])
                  } else {
                    setSelectedFiles(uploadFiles.map((f) => f.id))
                  }
                }}
              >
                {selectedFiles.length === uploadFiles.length ? "Deselect All" : "Select All"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setUploadFiles([])}>
                Clear All
              </Button>
              <Button onClick={uploadAllFiles} disabled={uploadFiles.every((f) => f.status !== "pending")}>
                Process All
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {uploadFiles.map((uploadFile) => (
              <div key={uploadFile.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedFiles.includes(uploadFile.id)}
                      onCheckedChange={() => toggleFileSelection(uploadFile.id)}
                    />
                    {getStatusIcon(uploadFile.status)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{uploadFile.file.name}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPreviewFile(uploadFile)}
                          className="h-6 px-2 text-xs"
                        >
                          Preview
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>{formatFileSize(uploadFile.file.size)}</span>
                        <span>•</span>
                        <span>{getEstimatedTime(uploadFile)}</span>
                        {uploadFile.analysisResults && (
                          <>
                            <Badge variant="outline" className="text-xs">
                              {uploadFile.analysisResults.contentType}
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              {uploadFile.analysisResults.complexity} complexity
                            </Badge>
                            <Badge variant="outline" className="text-xs">
                              ~{uploadFile.analysisResults.estimatedChunks} chunks
                            </Badge>
                          </>
                        )}
                        {metadata.domain && (
                          <Badge variant="outline" className="text-xs">
                            {domains.find((d) => d.id === metadata.domain)?.name}
                          </Badge>
                        )}
                        {metadata.useCase && (
                          <Badge variant="outline" className="text-xs">
                            {useCaseOptions.find((u) => u.value === metadata.useCase)?.label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(uploadFile.status)}
                    <Button variant="ghost" size="icon" onClick={() => removeFile(uploadFile.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Enhanced Progress Display */}
                {uploadFile.status === "chunking" && uploadFile.chunkingProgress !== undefined && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Chunking content...</span>
                      <span>{uploadFile.chunkingProgress}%</span>
                    </div>
                    <Progress value={uploadFile.chunkingProgress} className="w-full" />
                  </div>
                )}

                {(uploadFile.status === "uploading" || uploadFile.status === "processing") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>{uploadFile.status === "uploading" ? "Uploading..." : "Processing..."}</span>
                      <span>{uploadFile.progress}%</span>
                    </div>
                    <Progress value={uploadFile.progress} className="w-full" />
                  </div>
                )}

                {uploadFile.analysisResults && uploadFile.status === "pending" && (
                  <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                    <div className="text-sm">
                      <div className="font-medium mb-1">AI Analysis Results:</div>
                      <div className="text-muted-foreground">
                        Recommended: {uploadFile.analysisResults.recommendedChunking.strategy}
                      </div>
                      <div className="text-muted-foreground">
                        Chunk size: {uploadFile.analysisResults.recommendedChunking.size} chars, Overlap:{" "}
                        {uploadFile.analysisResults.recommendedChunking.overlap} chars
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* File Preview Dialog */}
      {previewFile && (
        <Dialog open={!!previewFile} onOpenChange={() => setPreviewFile(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>Preview: {previewFile.file.name}</DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-auto">
              {previewFile.file.type.startsWith("image/") ? (
                <img
                  src={getFilePreview(previewFile) || ""}
                  alt={previewFile.file.name}
                  className="max-w-full h-auto rounded-lg"
                />
              ) : previewFile.file.type === "application/pdf" ? (
                <div className="text-center p-8 border-2 border-dashed rounded-lg">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">PDF Preview</p>
                  <p className="text-muted-foreground">PDF preview will be available after processing</p>
                </div>
              ) : (
                <div className="text-center p-8 border-2 border-dashed rounded-lg">
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <p className="text-lg font-medium">File Preview</p>
                  <p className="text-muted-foreground">Preview not available for this file type</p>
                  <div className="mt-4 text-sm">
                    <p>
                      <strong>Size:</strong> {formatFileSize(previewFile.file.size)}
                    </p>
                    <p>
                      <strong>Type:</strong> {previewFile.file.type}
                    </p>
                    <p>
                      <strong>Last Modified:</strong> {new Date(previewFile.file.lastModified).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Bulk Edit Dialog */}
      {showBulkEdit && (
        <Dialog open={showBulkEdit} onOpenChange={setShowBulkEdit}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Metadata for {selectedFiles.length} files</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Domain</Label>
                  <Select
                    value={bulkMetadata.sector || ""}
                    onValueChange={(value) => setBulkMetadata((prev) => ({ ...prev, sector: value as any }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select domain" />
                    </SelectTrigger>
                    <SelectContent>
                      {domains.map((domain) => (
                        <SelectItem key={domain.id} value={domain.id}>
                          {domain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Use Case</Label>
                  <Select
                    value={bulkMetadata.useCase || ""}
                    onValueChange={(value) => setBulkMetadata((prev) => ({ ...prev, useCase: value as UseCase }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select use case" />
                    </SelectTrigger>
                    <SelectContent>
                      {useCaseOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setShowBulkEdit(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    setUploadFiles((prev) =>
                      prev.map((file) =>
                        selectedFiles.includes(file.id)
                          ? { ...file, metadata: { ...file.metadata, ...bulkMetadata } }
                          : file,
                      ),
                    )
                    setShowBulkEdit(false)
                    setBulkMetadata({})
                  }}
                >
                  Apply Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
