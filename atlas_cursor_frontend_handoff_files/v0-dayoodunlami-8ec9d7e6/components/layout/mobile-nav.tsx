"use client"

import { useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar } from "@/components/layout/sidebar"

interface MobileNavProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname()

  // Close the mobile nav when the route changes
  useEffect(() => {
    onOpenChange(false)
  }, [pathname, onOpenChange])

  // Prevent scrolling when the mobile nav is open
  useEffect(() => {
    if (open) {
      document.body.classList.add("overflow-hidden")
    } else {
      document.body.classList.remove("overflow-hidden")
    }
    return () => {
      document.body.classList.remove("overflow-hidden")
    }
  }, [open])

  if (!open) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div className="flex h-16 items-center justify-between border-b px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">Strategy AI</span>
        </Link>
        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
          <X className="h-6 w-6" />
          <span className="sr-only">Close</span>
        </Button>
      </div>
      <div className="pt-4">
        <Sidebar />
      </div>
    </div>
  )
}
