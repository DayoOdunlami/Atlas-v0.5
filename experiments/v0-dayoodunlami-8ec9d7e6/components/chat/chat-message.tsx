"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, ThumbsDown, ThumbsUp } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { Message } from "@/components/chat/chat-interface"

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const [showSources, setShowSources] = useState(false)
  const [feedback, setFeedback] = useState<"positive" | "negative" | null>(null)

  const isUser = message.type === "user"

  return (
    <div className={cn("flex w-full", isUser ? "justify-end" : "justify-start")}>
      <div className={cn("flex max-w-3xl gap-3", isUser ? "flex-row-reverse" : "flex-row")}>
        <Avatar className="h-8 w-8">
          {isUser ? (
            <>
              <AvatarImage src="/placeholder.svg?height=32&width=32" alt="User" />
              <AvatarFallback>U</AvatarFallback>
            </>
          ) : (
            <>
              <AvatarImage src="/placeholder.svg?height=32&width=32" alt="AI" />
              <AvatarFallback>AI</AvatarFallback>
            </>
          )}
        </Avatar>
        <div className="flex flex-col gap-2">
          <div className={cn("rounded-xl px-4 py-2", isUser ? "bg-primary text-primary-foreground" : "bg-muted")}>
            <p className="whitespace-pre-wrap">{message.content}</p>
          </div>

          {!isUser && message.sources && message.sources.length > 0 && (
            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex w-fit items-center gap-1 text-xs text-muted-foreground"
                onClick={() => setShowSources(!showSources)}
              >
                {showSources ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Hide sources
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Show sources ({message.sources.length})
                  </>
                )}
              </Button>

              {showSources && (
                <div className="flex flex-col gap-2">
                  {message.sources.map((source) => (
                    <Card key={source.id} className="overflow-hidden">
                      <CardContent className="p-3 text-sm">
                        <h4 className="font-medium">{source.title}</h4>
                        <p className="mt-1 text-muted-foreground">{source.excerpt}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}

          {!isUser && message.confidence && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>Confidence:</span>
                <span className="font-medium">{(message.confidence * 100).toFixed(0)}%</span>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-6 w-6", feedback === "positive" && "text-green-500")}
                  onClick={() => setFeedback("positive")}
                >
                  <ThumbsUp className="h-3 w-3" />
                  <span className="sr-only">Helpful</span>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className={cn("h-6 w-6", feedback === "negative" && "text-red-500")}
                  onClick={() => setFeedback("negative")}
                >
                  <ThumbsDown className="h-3 w-3" />
                  <span className="sr-only">Not helpful</span>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
