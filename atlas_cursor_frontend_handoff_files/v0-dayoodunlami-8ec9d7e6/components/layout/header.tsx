"use client"

import Link from "next/link"
import { Menu, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ModeToggle } from "@/components/mode-toggle"
import { UserNav } from "@/components/layout/user-nav"
import { useDemoMode } from "@/lib/demo-mode"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface HeaderProps {
  setSidebarOpen: (open: boolean) => void
}

export function Header({ setSidebarOpen }: HeaderProps) {
  const { isDemo, toggleDemoMode } = useDemoMode()
  
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-background px-4 md:px-6">
      <div className="flex items-center gap-2 md:gap-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold text-primary">Strategy AI</span>
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon"
                onClick={toggleDemoMode}
                className={isDemo ? "bg-blue-100 hover:bg-blue-200 text-blue-600 dark:bg-blue-900 dark:hover:bg-blue-800 dark:text-blue-400" : ""}
              >
                {isDemo ? (
                  <Eye className="h-[1.2rem] w-[1.2rem]" />
                ) : (
                  <EyeOff className="h-[1.2rem] w-[1.2rem]" />
                )}
                <span className="sr-only">Toggle Demo Mode</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isDemo ? "Demo Mode ON" : "Demo Mode OFF"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <ModeToggle />
        <UserNav />
      </div>
    </header>
  )
}
