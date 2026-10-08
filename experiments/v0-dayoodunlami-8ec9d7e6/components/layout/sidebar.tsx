"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, FileText, Home, Map, Settings, Upload, Lightbulb, Users, Shield, ChevronRight, Search } from "lucide-react"
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

export function Sidebar() {
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
          title: "Geo Analytics",
          href: "/geo-insights",
          icon: <BarChart3 className="h-5 w-5" />,
        },
        {
          title: "Railway Map",
          href: "/map",
          icon: <Map className="h-4 w-4" />,
        },
        {
          title: "Insight Explorer",
          href: "/insights",
          icon: <Lightbulb className="h-4 w-4" />,
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
          title: "Document Discovery",
          href: "/documents/discover",
          icon: <Search className="h-4 w-4" />,
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
    <>
      {/* Overlay for expanded state on mobile */}
      {isExpanded && <div className="fixed inset-0 bg-black/20 z-40 md:hidden" onClick={() => setIsExpanded(false)} />}

      <aside
        className={cn(
          "hidden md:flex flex-col border-r bg-background/95 backdrop-blur-sm transition-all duration-500 ease-out relative z-50 shadow-lg",
          isExpanded ? "w-72" : "w-14",
        )}
        onMouseEnter={() => setIsExpanded(true)}
        onMouseLeave={() => setIsExpanded(false)}
      >
        {/* Logo/Brand Area */}
        <div className={cn("flex items-center gap-3 p-4 border-b", !isExpanded && "justify-center px-2")}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">SA</span>
          </div>
          <span
            className={cn(
              "font-semibold text-lg transition-all duration-500",
              isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden",
            )}
          >
            Strategy AI
          </span>
        </div>

        <div className="flex flex-col gap-2 p-3 flex-1">
          {navSections.map((section, sectionIndex) => (
            <div key={section.title} className="space-y-2">
              {sectionIndex > 0 && <Separator className="my-3" />}

              {/* Section Header with Animation */}
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/50",
                  !isExpanded && "justify-center px-2",
                )}
              >
                <div className="relative">
                  {section.icon}
                  {!isExpanded && (
                    <div className="absolute -right-1 -top-1 w-2 h-2 bg-primary rounded-full animate-pulse" />
                  )}
                </div>
                <span
                  className={cn(
                    "text-sm font-medium transition-all duration-500",
                    isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden",
                  )}
                >
                  {section.title}
                </span>
              </div>

              {/* Section Items with Staggered Animation */}
              <div className="space-y-1">
                {section.items.map((item, itemIndex) => {
                  // Check if this is a Geo Analytics sub-item for visual grouping
                  const isGeoSubItem = (item.title === "Railway Map" || item.title === "Insight Explorer")
                  
                  return (
                    <Button
                      key={item.href}
                      variant={pathname === item.href ? "secondary" : "ghost"}
                      className={cn(
                        "w-full justify-start gap-3 h-11 transition-all duration-300 group relative",
                        pathname === item.href && "bg-secondary text-secondary-foreground shadow-sm",
                        !isExpanded && "px-2 justify-center",
                        isExpanded && `animate-in slide-in-from-left-2 duration-300 delay-${itemIndex * 50}`,
                        // Visual grouping for Geo Analytics sub-items
                        isGeoSubItem && isExpanded && "ml-4 h-9 text-sm bg-muted/20 hover:bg-muted/40 text-muted-foreground opacity-75",
                        isGeoSubItem && !isExpanded && "ml-1 opacity-75"
                      )}
                      asChild
                    >
                      <Link href={item.href}>
                        <div className="relative">
                          {/* Add connecting line for visual grouping */}
                          {isGeoSubItem && isExpanded && (
                            <div className="absolute -left-4 top-1/2 w-3 h-px bg-border" />
                          )}
                          {item.icon}
                          {pathname === item.href && !isExpanded && (
                            <div className="absolute -right-1 -top-1 w-2 h-2 bg-secondary-foreground rounded-full" />
                          )}
                        </div>
                        <span
                          className={cn(
                            "transition-all duration-500",
                            isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden",
                          )}
                        >
                          {item.title}
                        </span>
                        {isExpanded && (
                          <ChevronRight className="ml-auto h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                        )}
                      </Link>
                    </Button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Expansion Hint */}
        {!isExpanded && (
          <div className="absolute right-0 top-1/2 transform -translate-y-1/2">
            <div className="w-1 h-12 bg-gradient-to-b from-primary/0 via-primary/50 to-primary/0 rounded-l-full" />
          </div>
        )}
      </aside>
    </>
  )
}
