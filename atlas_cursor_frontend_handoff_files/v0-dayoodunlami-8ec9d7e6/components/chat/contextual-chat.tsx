"use client"

import type React from "react"

import { useState, useRef, useEffect } from "react"
import { MessageCircle, X, Send, Minimize2, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

export type ChatContext = "documents" | "upload" | "domains" | "map" | "insights" | "analytics" | "settings"

interface ContextualChatProps {
  context: ChatContext
  className?: string
}

interface ChatMessage {
  id: string
  type: "user" | "assistant"
  content: string
  timestamp: Date
  actions?: ChatAction[]
}

interface ChatAction {
  id: string
  label: string
  action: () => void
}

const contextConfig = {
  documents: {
    title: "Document Assistant",
    description: "I can help you manage documents, apply filters, and perform bulk operations.",
    placeholder: "Ask me to filter documents, update metadata, or perform bulk actions...",
    suggestions: [
      "Show me all documents from the Rail sector",
      "Filter documents by upload date",
      "Help me organize documents by tags",
    ],
  },
  upload: {
    title: "Upload Assistant",
    description: "I can help you configure upload settings and optimize document processing.",
    placeholder: "Ask me to adjust chunking settings, configure AI processing, or optimize uploads...",
    suggestions: [
      "Set chunking to manual mode",
      "Optimize settings for technical documents",
      "Configure AI supplements for better extraction",
    ],
  },
  domains: {
    title: "Domain Assistant",
    description: "I can help you manage domains, use cases, and prompt templates.",
    placeholder: "Ask me to create domains, configure use cases, or manage templates...",
    suggestions: [
      "Create a new domain for Maritime projects",
      "Add use cases for the Rail domain",
      "Help me organize prompt templates",
    ],
  },
  map: {
    title: "Map Assistant",
    description: "I can help you navigate the railway map and analyze regional data.",
    placeholder: "Ask me to find stations, analyze regions, or show project data...",
    suggestions: [
      "Show me all stations in the London region",
      "Find projects with high TRL ratings",
      "Analyze connectivity between regions",
    ],
  },
  insights: {
    title: "Insights Assistant",
    description: "I can help you explore data insights and generate custom analyses.",
    placeholder: "Ask me to analyze trends, generate reports, or explore data patterns...",
    suggestions: [
      "Show me document trends by sector",
      "Analyze project success rates",
      "Generate a regional activity report",
    ],
  },
  analytics: {
    title: "Analytics Assistant",
    description: "I can help you interpret metrics and create custom dashboards.",
    placeholder: "Ask me to explain metrics, create charts, or analyze performance...",
    suggestions: [
      "Explain the query success rate trend",
      "Show me user engagement metrics",
      "Create a custom performance dashboard",
    ],
  },
  settings: {
    title: "Settings Assistant",
    description: "I can help you configure system settings and optimize performance.",
    placeholder: "Ask me to adjust settings, configure integrations, or optimize performance...",
    suggestions: ["Optimize AI model settings", "Configure user permissions", "Set up backup schedules"],
  },
}

export function ContextualChat({ context, className }: ContextualChatProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isMinimized, setIsMinimized] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const config = contextConfig[context]

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!input.trim()) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      type: "user",
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    const userInput = input
    setInput("")
    setIsLoading(true)

    try {
      // Call real backend API for contextual chat
      const response = await fetch('https://web-production-6045b.up.railway.app/api/chat/contextual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userInput,
          context: context
        })
      })

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`)
      }

      const data = await response.json()

      // Create AI response from backend
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: data.response,
        timestamp: new Date(data.timestamp),
        actions: data.actions?.map((action: any, index: number) => ({
          id: action.id,
          label: action.label,
          action: () => {
            console.log(`Executing ${action.type} action:`, action.label)
            // You can add specific action handlers here based on action.type
          }
        })) || [],
      }

      setMessages((prev) => [...prev, aiMessage])
    } catch (error) {
      console.error('Error calling contextual chat API:', error)
      
      // Fallback to demo response if API fails
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        type: "assistant",
        content: generateContextualResponse(userInput, context),
        timestamp: new Date(),
        actions: generateContextualActions(userInput, context),
      }

      setMessages((prev) => [...prev, aiMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    setInput(suggestion)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!isOpen) {
    return (
      <Button
        onClick={() => setIsOpen(true)}
        size="icon"
        className={`fixed bottom-6 right-6 h-12 w-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-200 z-50 ${className}`}
      >
        <MessageCircle className="h-6 w-6" />
        <span className="sr-only">Open {config.title}</span>
      </Button>
    )
  }

  return (
    <Card
      className={`fixed bottom-6 right-6 w-96 shadow-xl z-50 transition-all duration-300 ${
        isMinimized ? "h-14" : "h-[600px]"
      }`}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 border-b">
        <div className="flex items-center gap-2">
          <MessageCircle className="h-4 w-4" />
          <CardTitle className="text-sm">{config.title}</CardTitle>
          <Badge variant="secondary" className="text-xs">
            {context.charAt(0).toUpperCase() + context.slice(1)}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsMinimized(!isMinimized)}>
            {isMinimized ? <Maximize2 className="h-3 w-3" /> : <Minimize2 className="h-3 w-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setIsOpen(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="flex flex-col h-[calc(100%-4rem)] p-0">
          <div className="p-3 border-b bg-muted/30">
            <p className="text-xs text-muted-foreground">{config.description}</p>
          </div>

          <ScrollArea className="flex-1 p-3">
            {messages.length === 0 ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Hi! I'm your {context} assistant. Here are some things I can help you with:
                </p>
                <div className="space-y-2">
                  {config.suggestions.map((suggestion, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="w-full text-left justify-start h-auto p-2 text-xs"
                      onClick={() => handleSuggestionClick(suggestion)}
                    >
                      {suggestion}
                    </Button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.type === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-lg p-2 text-sm ${
                        message.type === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                      }`}
                    >
                      <p>{message.content}</p>
                      {message.actions && (
                        <div className="mt-2 space-y-1">
                          {message.actions.map((action) => (
                            <Button
                              key={action.id}
                              variant="secondary"
                              size="sm"
                              className="w-full text-xs"
                              onClick={action.action}
                            >
                              {action.label}
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg p-2 text-sm">
                      <div className="flex items-center gap-1">
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse animation-delay-200"></div>
                        <div className="w-2 h-2 bg-muted-foreground rounded-full animate-pulse animation-delay-400"></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </ScrollArea>

          <div className="p-3 border-t">
            <div className="flex gap-2">
              <Textarea
                placeholder={config.placeholder}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                className="min-h-[40px] max-h-[100px] resize-none text-sm"
              />
              <Button
                size="icon"
                onClick={handleSendMessage}
                disabled={!input.trim() || isLoading}
                className="h-10 w-10"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}

function generateContextualResponse(input: string, context: ChatContext): string {
  const responses = {
    documents:
      "I can help you manage your documents. Based on your request, I'll assist with filtering, organizing, or performing bulk operations on your document collection.",
    upload:
      "I'll help you optimize your upload configuration. Let me adjust the settings to better suit your document processing needs.",
    domains:
      "I can assist with domain management tasks. Whether you need to create new domains, configure use cases, or manage templates, I'm here to help.",
    map: "I'll help you navigate and analyze the railway map data. Let me find the information you're looking for and provide insights about the network.",
    insights:
      "I can help you explore and analyze your data insights. Let me generate the analysis or reports you need based on your requirements.",
    analytics:
      "I'll assist with interpreting your analytics data and creating visualizations. Let me help you understand the metrics and trends.",
    settings:
      "I can help you configure and optimize your system settings. Let me assist with adjusting configurations to improve performance.",
  }

  return responses[context] || "I'm here to help you with this section of the application."
}

function generateContextualActions(input: string, context: ChatContext): ChatAction[] {
  const actions = {
    documents: [
      { id: "filter", label: "Apply Smart Filter", action: () => console.log("Applying filter") },
      { id: "organize", label: "Auto-Organize", action: () => console.log("Organizing documents") },
    ],
    upload: [
      { id: "optimize", label: "Optimize Settings", action: () => console.log("Optimizing settings") },
      { id: "configure", label: "Configure AI", action: () => console.log("Configuring AI") },
    ],
    domains: [
      { id: "create", label: "Create Domain", action: () => console.log("Creating domain") },
      { id: "template", label: "Add Template", action: () => console.log("Adding template") },
    ],
    map: [
      { id: "navigate", label: "Navigate to Location", action: () => console.log("Navigating") },
      { id: "analyze", label: "Analyze Region", action: () => console.log("Analyzing region") },
    ],
    insights: [
      { id: "generate", label: "Generate Report", action: () => console.log("Generating report") },
      { id: "export", label: "Export Data", action: () => console.log("Exporting data") },
    ],
    analytics: [
      { id: "dashboard", label: "Create Dashboard", action: () => console.log("Creating dashboard") },
      { id: "chart", label: "Generate Chart", action: () => console.log("Generating chart") },
    ],
    settings: [
      { id: "apply", label: "Apply Changes", action: () => console.log("Applying changes") },
      { id: "reset", label: "Reset to Default", action: () => console.log("Resetting") },
    ],
  }

  return actions[context] || []
}
