"use client"

import { useState } from "react"
import { Save, Brain, Zap, Target, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

export function AIConfiguration() {
  const { toast } = useToast()
  const [config, setConfig] = useState({
    model: "gpt-4",
    temperature: [0.7],
    maxTokens: "2000",
    confidenceThreshold: [0.8],
    enableCitations: true,
    enableConfidenceScores: true,
    enableUseCaseSuggestion: true,
    systemPrompt: `You are Strategy AI, an expert assistant for transportation sector strategic planning. 
You help users analyze documents, provide insights, and answer questions about rail, maritime, and highway infrastructure projects.
Always provide accurate, well-sourced information and cite your sources when possible.`,
    fallbackResponse:
      "I apologize, but I don't have enough information to provide a confident answer to your question. Please try rephrasing your query or check if relevant documents have been uploaded to the system.",
    maxConcurrentQueries: "10",
    queryTimeout: "30",
    enableAutoRetry: true,
    retryAttempts: "3",
  })

  const handleSave = () => {
    toast({
      title: "AI Configuration saved",
      description: "AI model settings have been updated successfully.",
    })
  }

  const handleInputChange = (key: string, value: string | boolean | number[]) => {
    setConfig((prev) => ({ ...prev, [key]: value }))
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            AI Model Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="model">AI Model</Label>
              <Select value={config.model} onValueChange={(value) => handleInputChange("model", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gpt-4">GPT-4 (Recommended)</SelectItem>
                  <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  <SelectItem value="claude-3">Claude 3</SelectItem>
                  <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="max-tokens">Max Tokens</Label>
              <Input
                id="max-tokens"
                type="number"
                value={config.maxTokens}
                onChange={(e) => handleInputChange("maxTokens", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Temperature: {config.temperature[0]}</Label>
              <Slider
                value={config.temperature}
                onValueChange={(value) => handleInputChange("temperature", value)}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                Controls randomness. Lower values make responses more focused and deterministic.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Confidence Threshold: {config.confidenceThreshold[0]}</Label>
              <Slider
                value={config.confidenceThreshold}
                onValueChange={(value) => handleInputChange("confidenceThreshold", value)}
                max={1}
                min={0}
                step={0.05}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                Minimum confidence score required to display AI responses.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="system-prompt">System Prompt</Label>
            <Textarea
              id="system-prompt"
              value={config.systemPrompt}
              onChange={(e) => handleInputChange("systemPrompt", e.target.value)}
              rows={6}
              placeholder="Enter the system prompt that defines the AI's behavior and expertise..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Response Features
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Citations</Label>
                <p className="text-sm text-muted-foreground">Show source documents in AI responses</p>
              </div>
              <Switch
                checked={config.enableCitations}
                onCheckedChange={(checked) => handleInputChange("enableCitations", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Confidence Scores</Label>
                <p className="text-sm text-muted-foreground">Display confidence ratings for AI responses</p>
              </div>
              <Switch
                checked={config.enableConfidenceScores}
                onCheckedChange={(checked) => handleInputChange("enableConfidenceScores", checked)}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Use Case Suggestion</Label>
                <p className="text-sm text-muted-foreground">Automatically suggest relevant use cases</p>
              </div>
              <Switch
                checked={config.enableUseCaseSuggestion}
                onCheckedChange={(checked) => handleInputChange("enableUseCaseSuggestion", checked)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fallback-response">Fallback Response</Label>
            <Textarea
              id="fallback-response"
              value={config.fallbackResponse}
              onChange={(e) => handleInputChange("fallbackResponse", e.target.value)}
              rows={3}
              placeholder="Response when AI cannot provide a confident answer..."
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Performance Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="max-concurrent">Max Concurrent Queries</Label>
              <Input
                id="max-concurrent"
                type="number"
                value={config.maxConcurrentQueries}
                onChange={(e) => handleInputChange("maxConcurrentQueries", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="query-timeout">Query Timeout (seconds)</Label>
              <Input
                id="query-timeout"
                type="number"
                value={config.queryTimeout}
                onChange={(e) => handleInputChange("queryTimeout", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Enable Auto Retry</Label>
                <p className="text-sm text-muted-foreground">Automatically retry failed queries</p>
              </div>
              <Switch
                checked={config.enableAutoRetry}
                onCheckedChange={(checked) => handleInputChange("enableAutoRetry", checked)}
              />
            </div>

            {config.enableAutoRetry && (
              <div className="space-y-2">
                <Label htmlFor="retry-attempts">Retry Attempts</Label>
                <Input
                  id="retry-attempts"
                  type="number"
                  value={config.retryAttempts}
                  onChange={(e) => handleInputChange("retryAttempts", e.target.value)}
                  min="1"
                  max="5"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-yellow-200 bg-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="h-5 w-5" />
            Important Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="text-yellow-800">
          <ul className="space-y-1 text-sm">
            <li>• Changes to AI model settings may affect response quality and cost</li>
            <li>• Lower temperature values provide more consistent but less creative responses</li>
            <li>• Higher confidence thresholds may result in more "I don't know" responses</li>
            <li>• Test configuration changes with sample queries before deploying to production</li>
          </ul>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save AI Configuration
        </Button>
      </div>
    </div>
  )
}
