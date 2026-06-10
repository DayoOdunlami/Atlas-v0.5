"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, FileText, Home, Map, Settings, Upload, Lightbulb, Users, Shield } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useState } from "react"

interface NavItem {
  title: string
  href: string
  icon: React.ReactNode
}

interface NavSection {
  title: string
  icon: React.ReactNode
  items: NavItem[]
}

export function SidebarOption1() {
  const pathname = usePathname()
  const [isExpanded, setIsExpanded] = useState(false)

  const navSections: NavSection[] = [
    {
      title: "User Pages",
      icon: <Users className="h-5 w-5" />,
      items: [
        {
          title: "Dashboard",
          href: "/",
          icon: <Home className="h-5 w-5" />,
        },
        {
          title: "Railway Map",
          href: "/map",
          icon: <Map className="h-5 w-5" />,
        },
        {
          title: "Insight Explorer",
          href: "/insights",
          icon: <Lightbulb className="h-5 w-5" />,
        },
      ],
    },
    {
      title: "Admin Pages",
      icon: <Shield className="h-5 w-5" />,
      items: [
        {
          title: "Documents",
          href: "/documents",
          icon: <FileText className="h-5 w-5" />,
        },
        {
          title: "Upload",
          href: "/upload",
          icon: <Upload className="h-5 w-5" />,
        },
        {
          title: "Domain Management",
          href: "/domains",
          icon: <Settings className="h-5 w-5" />,
        },
        {
          title: "Analytics",
          href: "/analytics",
          icon: <BarChart3 className="h-5 w-5" />,
        },
        {
          title: "Settings",
          href: "/settings",
          icon: <Settings className="h-5 w-5" />,
        },
      ],
    },
  ]

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r bg-background transition-all duration-300 ease-in-out relative z-50",
        isExpanded ? "w-64" : "w-16",
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      <div className="flex flex-col gap-1 p-2">
        {navSections.map((section, sectionIndex) => (
          <div key={section.title} className="space-y-1">
            {sectionIndex > 0 && <Separator className="my-2" />}

            {/* Section Header */}
            <div
              className={cn(
                "flex items-center gap-3 px-2 py-2 text-xs font-medium text-muted-foreground",
                !isExpanded && "justify-center",
              )}
            >
              {section.icon}
              <span
                className={cn(
                  "transition-all duration-300",
                  isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden",
                )}
              >
                {section.title}
              </span>
            </div>

            {/* Section Items */}
            <div className="space-y-1">
              {section.items.map((item) => (
                <Button
                  key={item.href}
                  variant={pathname === item.href ? "secondary" : "ghost"}
                  className={cn(
                    "w-full justify-start gap-3 h-10 transition-all duration-300",
                    pathname === item.href && "bg-secondary text-secondary-foreground",
                    !isExpanded && "px-2 justify-center",
                  )}
                  asChild
                >
                  <Link href={item.href}>
                    {item.icon}
                    <span
                      className={cn(
                        "transition-all duration-300",
                        isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden",
                      )}
                    >
                      {item.title}
                    </span>
                  </Link>
                </Button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Expansion Indicator */}
      {!isExpanded && (
        <div className="absolute right-0 top-1/2 transform -translate-y-1/2 w-1 h-8 bg-primary/20 rounded-l-full opacity-50" />
      )}
    </aside>
  )
}
