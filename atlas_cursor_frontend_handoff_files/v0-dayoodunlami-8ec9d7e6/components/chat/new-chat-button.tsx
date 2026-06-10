"use client"

import { PlusCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

interface NewChatButtonProps {
  onClick: () => void
}

export function NewChatButton({ onClick }: NewChatButtonProps) {
  return (
    <Button variant="outline" className="w-full justify-start gap-2" onClick={onClick}>
      <PlusCircle className="h-4 w-4" />
      New Chat
    </Button>
  )
}
