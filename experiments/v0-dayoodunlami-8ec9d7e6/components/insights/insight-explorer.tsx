"use client"

import type React from "react"

import { useState } from "react"
import { Search, Filter, BarChart3, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { InsightFilters as InsightFiltersComponent } from "@/components/insights/insight-filters"
import { InsightChat } from "@/components/insights/insight-chat"
import { DocumentsBySecorChart } from "@/components/insights/charts/documents-by-sector-chart"
import { ProjectDensityMap } from "@/components/insights/charts/project-density-map"
import { TrendAnalysisChart } from "@/components/insights/charts/trend-analysis-chart"
import { RegionalActivityChart } from "@/components/insights/charts/regional-activity-chart"
import { TagCloudWidget } from "@/components/insights/charts/tag-cloud-widget"
import { MetricsOverview } from "@/components/insights/metrics-overview"
import { useMobile } from "@/hooks/use-mobile"

export interface InsightFiltersType {
  sectors: string[]
  regions: string[]
  tags: string[]
  dateRange: {
    from: string
    to: string
  }
  projectTypes: string[]
}

export interface GeneratedInsight {
  id: string
  question: string
  chartType: "bar" | "line" | "pie" | "map" | "scatter" | "heatmap"
  data: any[]
  title: string
  description: string
  timestamp: Date
}

export function InsightExplorer() {
  const isMobile = useMobile()
  const [filtersOpen, setFiltersOpen] = useState(!isMobile)
  const [query, setQuery] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [filters, setFilters] = useState<InsightFiltersType>({
    sectors: [],
    regions: [],
    tags: [],
    dateRange: { from: "", to: "" },
    projectTypes: [],
  })
  const [generatedInsights, setGeneratedInsights] = useState<GeneratedInsight[]>([])
  const [selectedInsight, setSelectedInsight] = useState<GeneratedInsight | null>(null)

  // Sample questions for inspiration
  const sampleQuestions = [
    "Show regions with the most strategic documents on decarbonization",
    "Compare investment priorities across rail and highways",
    "Visualize all maritime projects tagged with 'AI'",
    "What are the trending topics in rail modernization?",
    "Show project timeline distribution by sector",
    "Which regions have the highest document upload activity?",
  ]

  const handleGenerateInsight = async () => {
    if (!query.trim()) return

    setIsGenerating(true)

    // Simulate AI processing
    setTimeout(() => {
      const newInsight: GeneratedInsight = {
        id: Date.now().toString(),
        question: query,
        chartType: "bar", // This would be determined by AI
        data: generateMockData(query),
        title: generateInsightTitle(query),
        description: generateInsightDescription(query),
        timestamp: new Date(),
      }

      setGeneratedInsights((prev) => [newInsight, ...prev])
      setSelectedInsight(newInsight)
      setQuery("")
      setIsGenerating(false)
    }, 2000)
  }

  const generateMockData = (question: string) => {
    // Mock data generation based on question type
    if (question.toLowerCase().includes("region")) {
      return [
        { name: "London & South East", value: 45, projects: 23 },
        { name: "North West", value: 32, projects: 18 },
        { name: "Scotland", value: 28, projects: 15 },
        { name: "Wales & Western", value: 22, projects: 12 },
        { name: "Eastern", value: 18, projects: 9 },
      ]
    }
    return [
      { name: "Rail", value: 120, documents: 89 },
      { name: "Maritime", value: 45, documents: 32 },
      { name: "Highways", value: 82, documents: 67 },
      { name: "General", value: 67, documents: 45 },
    ]
  }

  const generateInsightTitle = (question: string) => {
    if (question.toLowerCase().includes("region")) return "Regional Analysis"
    if (question.toLowerCase().includes("sector")) return "Sector Comparison"
    if (question.toLowerCase().includes("trend")) return "Trend Analysis"
    return "Knowledge Base Insights"
  }

  const generateInsightDescription = (question: string) => {
    return `AI-generated visualization based on your query: "${question}". This analysis includes data from ${Math.floor(Math.random() * 500 + 100)} documents across multiple sectors.`
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleGenerateInsight()
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Insight Explorer</h1>
          <p className="text-muted-foreground">
            Ask questions and get AI-powered visualizations of your knowledge base
          </p>
        </div>
        <Button variant="outline" onClick={() => setFiltersOpen(!filtersOpen)} className="sm:hidden">
          <Filter className="mr-2 h-4 w-4" />
          Filters
        </Button>
      </div>

      {/* AI Query Input */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Ask a question about the knowledge base</h3>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="e.g., Show regions with the most strategic documents on decarbonization..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-9"
                />
              </div>
              <Button
                onClick={handleGenerateInsight}
                disabled={!query.trim() || isGenerating}
                className="bg-primary hover:bg-primary/90"
              >
                {isGenerating ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Generating...
                  </div>
                ) : (
                  <>
                    <BarChart3 className="mr-2 h-4 w-4" />
                    Generate Insight
                  </>
                )}
              </Button>
            </div>

            {/* Sample Questions */}
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">Try asking:</p>
              <div className="flex flex-wrap gap-2">
                {sampleQuestions.slice(0, 3).map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => setQuery(question)}
                    className="text-xs"
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Filters Sidebar */}
        <div className={`space-y-4 ${filtersOpen ? "lg:col-span-1" : "hidden lg:block lg:col-span-1"}`}>
          <InsightFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            onClose={() => setFiltersOpen(false)}
          />
        </div>

        {/* Main Content */}
        <div className={`space-y-6 ${filtersOpen ? "lg:col-span-3" : "lg:col-span-4"}`}>
          {/* Metrics Overview */}
          <MetricsOverview filters={filters} />

          {/* Generated Insights */}
          {generatedInsights.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  AI-Generated Insights
                </CardTitle>
              </CardHeader>
              <CardContent>
                <InsightChat
                  insights={generatedInsights}
                  selectedInsight={selectedInsight}
                  onSelectInsight={setSelectedInsight}
                />
              </CardContent>
            </Card>
          )}

          {/* Default Widgets */}
          <div className="grid gap-6 lg:grid-cols-2">
            <DocumentsBySecorChart filters={filters} />
            <ProjectDensityMap filters={filters} />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <TrendAnalysisChart filters={filters} />
            <RegionalActivityChart filters={filters} />
            <TagCloudWidget filters={filters} />
          </div>
        </div>
      </div>
    </div>
  )
}
