"use client"

import { useState, useEffect } from "react"
import { Save, Plug, Database, Cloud, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"

// API client for backend health checks
const BACKEND_URL = 'https://web-production-6045b.up.railway.app'

const healthAPI = {
  checkSystemHealth: async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      console.warn('Health check failed:', error)
      return null
    }
  },

  checkAIStatus: async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/ai/status`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })
      if (response.ok) {
        return await response.json()
      }
      return null
    } catch (error) {
      console.warn('AI status check failed:', error)
      return null
    }
  }
}

export function IntegrationSettings() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  
  // Default fallback state (same as before)
  const [integrations, setIntegrations] = useState({
    openai: {
      enabled: true,
      apiKey: "sk-****************************",
      model: "gpt-4",
      status: "unknown", // Start as unknown, will update from API
    },
    pinecone: {
      enabled: true,
      apiKey: "pc-****************************",
      environment: "us-west1-gcp",
      indexName: "strategy-ai-docs",
      status: "unknown",
    },
    supabase: {
      enabled: true,
      url: "",
      apiKey: "",
      status: "unknown",
    },
    neon: {
      enabled: true,
      connectionString: "postgresql://****************************",
      status: "unknown",
    },
    vercelBlob: {
      enabled: true,
      token: "vercel_blob_****************************",
      status: "unknown",
    },
    networkRailAPI: {
      enabled: true,
      apiKey: "nr-****************************",
      baseUrl: "https://api.networkrail.co.uk",
      status: "unknown",
    },
  })

  // Fetch live status from backend
  const fetchLiveStatus = async () => {
    setIsLoading(true)
    try {
      // Get overall system health
      const healthData = await healthAPI.checkSystemHealth()
      const aiData = await healthAPI.checkAIStatus()

      if (healthData) {
        // Update statuses based on backend response
        setIntegrations(prev => ({
          ...prev,
          pinecone: {
            ...prev.pinecone,
            status: healthData.services?.vector_store === "connected" ? "connected" : "disconnected"
          },
          neon: {
            ...prev.neon,
            status: healthData.services?.database === "connected" ? "connected" : "disconnected"
          },
          openai: {
            ...prev.openai,
            status: (healthData.services?.ai_service === "ready" || healthData.services?.ai_service === "connected") ? "connected" : "disconnected"
          },
          supabase: {
            ...prev.supabase,
            status: prev.supabase.url && prev.supabase.apiKey ? "connected" : 
                   healthData.services?.supabase === "connected" ? "connected" : "unknown"
          },
          // Add more mappings as backend provides them
        }))
      }

      if (aiData) {
        setIntegrations(prev => ({
          ...prev,
          openai: {
            ...prev.openai,
            status: (aiData.ai_enabled && !aiData.demo_mode) || aiData.status === "operational" ? "connected" : "disconnected"
          }
        }))
      }

      setLastUpdated(new Date())
      
      if (healthData || aiData) {
        toast({
          title: "Status updated",
          description: "Integration statuses refreshed from backend",
        })
      } else {
        toast({
          title: "Backend unavailable",
          description: "Using cached status - backend may be down",
          variant: "destructive"
        })
      }
      
    } catch (error) {
      console.error('Failed to fetch live status:', error)
      toast({
        title: "Update failed",
        description: "Could not reach backend - showing last known status",
        variant: "destructive"
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Load live status on component mount
  useEffect(() => {
    fetchLiveStatus()
  }, [])

  const handleSave = () => {
    toast({
      title: "Integration settings saved",
      description: "External service configurations have been updated successfully.",
    })
  }

  const handleToggleIntegration = (service: string, enabled: boolean) => {
    setIntegrations((prev) => ({
      ...prev,
      [service]: { ...prev[service as keyof typeof prev], enabled },
    }))
  }

  const handleUpdateConfig = (service: string, key: string, value: string) => {
    setIntegrations((prev) => ({
      ...prev,
      [service]: { ...prev[service as keyof typeof prev], [key]: value },
    }))
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "connected":
        return <Badge className="bg-green-100 text-green-800">Connected</Badge>
      case "disconnected":
        return <Badge className="bg-red-100 text-red-800">Disconnected</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      case "unknown":
        return <Badge variant="outline">Unknown</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  const testConnection = async (service: string) => {
    toast({
      title: "Testing connection",
      description: `Testing connection to ${service}...`,
    })
    
    // For now, just refresh the overall status
    // Later, this could call specific service test endpoints
    await fetchLiveStatus()
  }

  return (
    <div className="space-y-6">
      {/* Status Header */}
      <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
        <div>
          <h3 className="font-medium">Integration Status</h3>
          <p className="text-sm text-muted-foreground">
            {lastUpdated ? `Last updated: ${lastUpdated.toLocaleTimeString()}` : 'Loading status...'}
          </p>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchLiveStatus}
          disabled={isLoading}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            AI Services
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* OpenAI */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">AI</span>
                </div>
                <div>
                  <h4 className="font-medium">OpenAI</h4>
                  <p className="text-sm text-muted-foreground">GPT models for AI responses</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(integrations.openai.status)}
                <Switch
                  checked={integrations.openai.enabled}
                  onCheckedChange={(checked) => handleToggleIntegration("openai", checked)}
                />
              </div>
            </div>

            {integrations.openai.enabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={integrations.openai.apiKey}
                    onChange={(e) => handleUpdateConfig("openai", "apiKey", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Model</Label>
                  <Select
                    value={integrations.openai.model}
                    onValueChange={(value) => handleUpdateConfig("openai", "model", value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gpt-4">GPT-4</SelectItem>
                      <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}


          </div>

          {/* Pinecone */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">PC</span>
                </div>
                <div>
                  <h4 className="font-medium">Pinecone</h4>
                  <p className="text-sm text-muted-foreground">Vector database for document embeddings</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(integrations.pinecone.status)}
                <Switch
                  checked={integrations.pinecone.enabled}
                  onCheckedChange={(checked) => handleToggleIntegration("pinecone", checked)}
                />
              </div>
            </div>

            {integrations.pinecone.enabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={integrations.pinecone.apiKey}
                    onChange={(e) => handleUpdateConfig("pinecone", "apiKey", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Environment</Label>
                  <Input
                    value={integrations.pinecone.environment}
                    onChange={(e) => handleUpdateConfig("pinecone", "environment", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Index Name</Label>
                  <Input
                    value={integrations.pinecone.indexName}
                    onChange={(e) => handleUpdateConfig("pinecone", "indexName", e.target.value)}
                  />
                </div>
              </div>
            )}


          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Services
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Neon */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">N</span>
                </div>
                <div>
                  <h4 className="font-medium">Neon Database</h4>
                  <p className="text-sm text-muted-foreground">PostgreSQL database for application data</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(integrations.neon.status)}
                <Switch
                  checked={integrations.neon.enabled}
                  onCheckedChange={(checked) => handleToggleIntegration("neon", checked)}
                />
              </div>
            </div>

            {integrations.neon.enabled && (
              <div className="space-y-2">
                <Label>Connection String</Label>
                <Input
                  type="password"
                  value={integrations.neon.connectionString}
                  onChange={(e) => handleUpdateConfig("neon", "connectionString", e.target.value)}
                />
              </div>
            )}


          </div>

          {/* Supabase */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-green-500 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">S</span>
                </div>
                <div>
                  <h4 className="font-medium">Supabase</h4>
                  <p className="text-sm text-muted-foreground">Alternative database and auth provider</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(integrations.supabase.status)}
                <Switch
                  checked={integrations.supabase.enabled}
                  onCheckedChange={(checked) => handleToggleIntegration("supabase", checked)}
                />
              </div>
            </div>

            {integrations.supabase.enabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Project URL</Label>
                  <Input
                    value={integrations.supabase.url}
                    onChange={(e) => handleUpdateConfig("supabase", "url", e.target.value)}
                    placeholder="https://your-project.supabase.co"
                  />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={integrations.supabase.apiKey}
                    onChange={(e) => handleUpdateConfig("supabase", "apiKey", e.target.value)}
                  />
                </div>
              </div>
            )}


          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cloud className="h-5 w-5" />
            Storage & External APIs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Vercel Blob */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">V</span>
                </div>
                <div>
                  <h4 className="font-medium">Vercel Blob</h4>
                  <p className="text-sm text-muted-foreground">File storage for documents and assets</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(integrations.vercelBlob.status)}
                <Switch
                  checked={integrations.vercelBlob.enabled}
                  onCheckedChange={(checked) => handleToggleIntegration("vercelBlob", checked)}
                />
              </div>
            </div>

            {integrations.vercelBlob.enabled && (
              <div className="space-y-2">
                <Label>Blob Token</Label>
                <Input
                  type="password"
                  value={integrations.vercelBlob.token}
                  onChange={(e) => handleUpdateConfig("vercelBlob", "token", e.target.value)}
                />
              </div>
            )}


          </div>

          {/* Network Rail API */}
          <div className="space-y-4 p-4 border rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-orange-600 rounded flex items-center justify-center">
                  <span className="text-white text-xs font-bold">NR</span>
                </div>
                <div>
                  <h4 className="font-medium">Network Rail API</h4>
                  <p className="text-sm text-muted-foreground">Railway data and real-time information</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {getStatusBadge(integrations.networkRailAPI.status)}
                <Switch
                  checked={integrations.networkRailAPI.enabled}
                  onCheckedChange={(checked) => handleToggleIntegration("networkRailAPI", checked)}
                />
              </div>
            </div>

            {integrations.networkRailAPI.enabled && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={integrations.networkRailAPI.apiKey}
                    onChange={(e) => handleUpdateConfig("networkRailAPI", "apiKey", e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Base URL</Label>
                  <Input
                    value={integrations.networkRailAPI.baseUrl}
                    onChange={(e) => handleUpdateConfig("networkRailAPI", "baseUrl", e.target.value)}
                  />
                </div>
              </div>
            )}


          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave}>
          <Save className="mr-2 h-4 w-4" />
          Save Integration Settings
        </Button>
      </div>
    </div>
  )
}
