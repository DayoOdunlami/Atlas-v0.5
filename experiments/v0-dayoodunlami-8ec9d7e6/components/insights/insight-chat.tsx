"use client"
import { MessageSquare, BarChart3, TrendingUp, Map, PieChart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart as RechartsPieChart,
  Cell,
} from "recharts"
import type { GeneratedInsight } from "@/components/insights/insight-explorer"

interface InsightChatProps {
  insights: GeneratedInsight[]
  selectedInsight: GeneratedInsight | null
  onSelectInsight: (insight: GeneratedInsight) => void
}

export function InsightChat({ insights, selectedInsight, onSelectInsight }: InsightChatProps) {
  const getChartIcon = (chartType: string) => {
    switch (chartType) {
      case "bar":
        return <BarChart3 className="h-4 w-4" />
      case "line":
        return <TrendingUp className="h-4 w-4" />
      case "pie":
        return <PieChart className="h-4 w-4" />
      case "map":
        return <Map className="h-4 w-4" />
      default:
        return <BarChart3 className="h-4 w-4" />
    }
  }

  const renderChart = (insight: GeneratedInsight) => {
    const colors = ["#006E51", "#CCE2DC", "#2E2D2B", "#f59e0b", "#ef4444"]

    switch (insight.chartType) {
      case "bar":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={insight.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#006E51" />
            </BarChart>
          </ResponsiveContainer>
        )

      case "line":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={insight.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="value" stroke="#006E51" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )

      case "pie":
        return (
          <ResponsiveContainer width="100%" height={300}>
            <RechartsPieChart>
              <RechartsPieChart
                data={insight.data}
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {insight.data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                ))}
              </RechartsPieChart>
              <Tooltip />
            </RechartsPieChart>
          </ResponsiveContainer>
        )

      default:
        return (
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <div className="text-center">
              <Map className="h-12 w-12 mx-auto mb-2" />
              <p>Interactive visualization would appear here</p>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="space-y-4">
      {/* Chat History */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {insights.map((insight) => (
          <div key={insight.id} className="space-y-2">
            {/* User Question */}
            <div className="flex justify-end">
              <div className="bg-primary text-primary-foreground rounded-lg px-4 py-2 max-w-[80%]">
                <p className="text-sm">{insight.question}</p>
              </div>
            </div>

            {/* AI Response */}
            <div className="flex justify-start">
              <Card
                className="max-w-[90%] cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => onSelectInsight(insight)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {getChartIcon(insight.chartType)}
                    <span className="font-medium text-sm">{insight.title}</span>
                    <Badge variant="outline" className="text-xs">
                      {insight.chartType}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mb-3">{insight.description}</p>

                  {/* Mini Chart Preview */}
                  <div className="h-32 w-full">{renderChart(insight)}</div>

                  <div className="flex justify-between items-center mt-2">
                    <span className="text-xs text-muted-foreground">{insight.timestamp.toLocaleTimeString()}</span>
                    <Button size="sm" variant="outline">
                      View Full Chart
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ))}
      </div>

      {/* Selected Insight Detail */}
      {selectedInsight && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">{selectedInsight.title}</h3>
              <Badge className="bg-primary/10 text-primary">{selectedInsight.chartType}</Badge>
            </div>

            <p className="text-sm text-muted-foreground mb-4">{selectedInsight.description}</p>

            {/* Full Chart */}
            <div className="h-96 w-full">{renderChart(selectedInsight)}</div>

            {/* Data Summary */}
            <div className="mt-4 p-3 bg-background rounded-lg">
              <h4 className="font-medium text-sm mb-2">Data Summary</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Items:</span>
                  <span className="ml-2 font-medium">{selectedInsight.data.length}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Max Value:</span>
                  <span className="ml-2 font-medium">{Math.max(...selectedInsight.data.map((d) => d.value))}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Min Value:</span>
                  <span className="ml-2 font-medium">{Math.min(...selectedInsight.data.map((d) => d.value))}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Generated:</span>
                  <span className="ml-2 font-medium">{selectedInsight.timestamp.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
