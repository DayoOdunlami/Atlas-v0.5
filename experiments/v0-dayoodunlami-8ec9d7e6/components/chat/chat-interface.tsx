"use client"

import type React from "react"

import { useState } from "react"
import { SendHorizontal } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChatMessage } from "@/components/chat/chat-message"
import { ChatSuggestions } from "@/components/chat/chat-suggestions"
import { NewChatButton } from "@/components/chat/new-chat-button"
import { useDemoMode, DEMO_DATA } from "@/lib/demo-mode"

export type Sector = "rail" | "maritime" | "highways" | "general"
export type UseCase =
  | "quick-playbook"
  | "lessons-learned"
  | "project-review"
  | "trl-mapping"
  | "project-similarity"
  | "change-management"
  | "product-acceptance"

export type MessageType = "user" | "assistant"

export interface Message {
  id: string
  type: MessageType
  content: string
  timestamp: Date
  sources?: Source[]
  confidence?: number
}

export interface Source {
  id: string
  title: string
  excerpt: string
  url?: string
}

export function ChatInterface() {
  const [sector, setSector] = useState<Sector | "">("")
  const [useCase, setUseCase] = useState<UseCase | "">("")
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { useSampleData } = useDemoMode()

  const [reportProgress, setReportProgress] = useState(0)
  const [reportStatus, setReportStatus] = useState<"idle" | "generating" | "completed" | "error">("idle")
  const [reportTemplate, setReportTemplate] = useState("executive-summary")
  const [reportFormat, setReportFormat] = useState("pdf")
  const [generatedReportUrl, setGeneratedReportUrl] = useState<string | null>(null)

  const useCaseOptions: Record<Sector, { value: UseCase; label: string }[]> = {
    rail: [
      { value: "quick-playbook", label: "Quick Playbook Answers" },
      { value: "lessons-learned", label: "Lessons Learned" },
      { value: "project-review", label: "Project Review / MOT" },
      { value: "trl-mapping", label: "TRL / RIRL Mapping" },
      { value: "project-similarity", label: "Project Similarity" },
      { value: "change-management", label: "Change Management" },
      { value: "product-acceptance", label: "Product Acceptance" },
    ],
    maritime: [
      { value: "quick-playbook", label: "Quick Playbook Answers" },
      { value: "lessons-learned", label: "Lessons Learned" },
      { value: "project-review", label: "Project Review / MOT" },
    ],
    highways: [
      { value: "quick-playbook", label: "Quick Playbook Answers" },
      { value: "lessons-learned", label: "Lessons Learned" },
      { value: "project-review", label: "Project Review / MOT" },
      { value: "project-similarity", label: "Project Similarity" },
    ],
    general: [
      { value: "quick-playbook", label: "Quick Playbook Answers" },
      { value: "lessons-learned", label: "Lessons Learned" },
    ],
  }

  const handleSendMessage = async () => {
    if (!input.trim()) return

    // Create a new user message
    const userMessage: Message = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    }

    // Add user message to the chat
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      if (useSampleData) {
        // Use demo responses when in demo mode
        setTimeout(() => {
          const demoResponses = [
            "Based on the Railway Infrastructure Strategy 2024, key sustainability requirements include:\n\n1. **Carbon Neutrality**: Achieve net-zero emissions by 2050\n2. **Energy Efficiency**: 30% reduction in energy consumption\n3. **Biodiversity Protection**: Minimize environmental impact on ecosystems\n4. **Circular Economy**: 80% material reuse and recycling targets\n\nWould you like me to elaborate on any of these areas?",
            "According to the Smart Cities Implementation Guide, transportation solutions typically involve:\n\n• **IoT Integration**: Real-time traffic monitoring\n• **Electric Infrastructure**: EV charging networks\n• **Data Analytics**: Predictive maintenance systems\n• **Multimodal Hubs**: Integrated transport centers\n\nThese create more efficient urban mobility systems.",
            "The Sustainability Framework 2024 emphasizes:\n\n• **Environmental Impact Assessment**: Comprehensive lifecycle analysis\n• **Community Engagement**: Stakeholder consultation processes\n• **Technology Integration**: Smart monitoring systems\n• **Performance Metrics**: Regular sustainability reporting\n\nThis ensures projects meet environmental objectives while delivering value."
          ]
          
          const randomResponse = demoResponses[Math.floor(Math.random() * demoResponses.length)]
          
          const aiResponse: Message = {
            id: (Date.now() + 1).toString(),
            type: "assistant",
            content: randomResponse,
            timestamp: new Date(),
            confidence: 0.85 + Math.random() * 0.1, // Random confidence between 0.85-0.95
            sources: [
              {
                id: "demo-source-1",
                title: "Railway Infrastructure Strategy 2024",
                excerpt: "Comprehensive strategy for UK railway infrastructure development",
              },
              {
                id: "demo-source-2", 
                title: "Smart Cities Implementation Guide",
                excerpt: "Best practices for implementing smart city technologies",
              }
            ],
          }

          setMessages((prev) => [...prev, aiResponse])
          setIsLoading(false)
        }, 1000 + Math.random() * 1000) // Random delay 1-2 seconds
      } else {
        // Import API client dynamically to avoid SSR issues
        const { default: apiClient } = await import('@/lib/api-client')
        
        // Call real backend API
        const response = await apiClient.chat.sendMessage({
          message: input,
          sector: sector as any,
          use_case: useCase as any,
          user_type: "public"
        })

        // Create AI response from backend
        const aiResponse: Message = {
          id: (Date.now() + 1).toString(),
          type: "assistant",
          content: response.response,
          timestamp: new Date(response.timestamp),
          confidence: response.confidence,
          sources: response.sources?.map((source, index) => ({
            id: `source-${index}`,
            title: source.document_title,
            excerpt: source.chunk_preview,
            url: source.source
          })) || [],
        }

        // Add AI response to the chat
        setMessages((prev) => [...prev, aiResponse])
      }
    } catch (error) {
      console.error('Chat API error:', error)
      
      // Fallback response on error
      const errorResponse: Message = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: "I apologize, but I'm having trouble connecting to the AI system right now. Please try again in a moment.",
        timestamp: new Date(),
        confidence: 0.0,
        sources: [],
      }
      
      setMessages((prev) => [...prev, errorResponse])
    } finally {
      if (!useSampleData) {
        setIsLoading(false)
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const startNewChat = () => {
    setMessages([])
    setSector("")
    setUseCase("")
    setInput("")
  }

  return (
    <div className="space-y-4">
      {/* Demo Mode Indicator */}
      {useSampleData && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-sm text-blue-800">
            💬 <strong>Demo Mode:</strong> Using sample responses and demo data
          </p>
        </div>
      )}
      
      <div className="grid h-[calc(100vh-5rem)] grid-cols-1 gap-4 lg:grid-cols-4">
        <div className="hidden lg:col-span-1 lg:block">
          <Card className="h-full">
            <CardHeader>
              <CardTitle>Conversations</CardTitle>
            </CardHeader>
            <CardContent>
              <NewChatButton onClick={startNewChat} />
              <div className="mt-4">
                {/* Conversation history would go here */}
                <p className="text-sm text-muted-foreground">No previous conversations</p>
              </div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-1 flex flex-col lg:col-span-3">
          <Card className="flex flex-1 flex-col">
            <CardHeader className="border-b">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle>Strategy AI Assistant - Report Mode</CardTitle>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <Select
                      value={sector}
                      onValueChange={(value) => {
                        setSector(value as Sector)
                        setUseCase("")
                      }}
                    >
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Select Sector" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="rail">Rail</SelectItem>
                        <SelectItem value="maritime">Maritime</SelectItem>
                        <SelectItem value="highways">Highways</SelectItem>
                        <SelectItem value="general">General</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={useCase} onValueChange={(value) => setUseCase(value as UseCase)} disabled={!sector}>
                      <SelectTrigger className="w-full sm:w-[180px]">
                        <SelectValue placeholder="Select Use Case" />
                      </SelectTrigger>
                      <SelectContent>
                        {sector &&
                          useCaseOptions[sector as Sector]?.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Report Generation Controls */}
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Report Template</label>
                    <Select defaultValue="executive-summary">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="executive-summary">Executive Summary</SelectItem>
                        <SelectItem value="detailed-analysis">Detailed Analysis</SelectItem>
                        <SelectItem value="project-overview">Project Overview</SelectItem>
                        <SelectItem value="lessons-learned">Lessons Learned</SelectItem>
                        <SelectItem value="risk-assessment">Risk Assessment</SelectItem>
                        <SelectItem value="performance-metrics">Performance Metrics</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Output Format</label>
                    <Select defaultValue="pdf">
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pdf">PDF Document</SelectItem>
                        <SelectItem value="docx">Word Document</SelectItem>
                        <SelectItem value="csv">CSV Data</SelectItem>
                        <SelectItem value="xlsx">Excel Spreadsheet</SelectItem>
                        <SelectItem value="html">HTML Report</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">Actions</label>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" disabled={!sector || !useCase}>
                        Generate Report
                      </Button>
                      <Button size="sm" variant="outline" disabled={true}>
                        Download
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Progress Display */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Generation Progress</span>
                    <span className="font-medium">0%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-muted">
                    <div className="h-2 rounded-full bg-primary transition-all duration-300" style={{ width: "0%" }} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Ready to generate report. Select sector and use case to begin.
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto p-4">
              <div className="flex flex-col gap-4">
                {messages.length === 0 ? (
                  <ChatSuggestions onSuggestionClick={(suggestion) => setInput(suggestion)} />
                ) : (
                  messages.map((message) => <ChatMessage key={message.id} message={message} />)
                )}
                {isLoading && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="h-2 w-2 animate-pulse rounded-full bg-primary"></div>
                    <div className="h-2 w-2 animate-pulse rounded-full bg-primary animation-delay-200"></div>
                    <div className="h-2 w-2 animate-pulse rounded-full bg-primary animation-delay-400"></div>
                    <span className="text-sm">AI is thinking...</span>
                  </div>
                )}
              </div>
            </CardContent>
            <div className="border-t p-4">
              <div className="flex items-end gap-2">
                <Textarea
                  placeholder="Ask a question about transportation strategy..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="min-h-[60px] resize-none"
                />
                <Button size="icon" onClick={handleSendMessage} disabled={!input.trim() || isLoading}>
                  <SendHorizontal className="h-5 w-5" />
                  <span className="sr-only">Send message</span>
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
