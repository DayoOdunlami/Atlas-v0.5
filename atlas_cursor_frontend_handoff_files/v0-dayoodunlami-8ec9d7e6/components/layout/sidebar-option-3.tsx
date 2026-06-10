"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, FileText, Home, Map, Settings, Upload, Lightbulb, Users, Shield, Dot } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
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

export function SidebarOption3() {
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
        "hidden md:flex flex-col border-r bg-card transition-all duration-700 ease-in-out relative z-50 group",
        isExpanded ? "w-80" : "w-20",
      )}
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
    >
      {/* Floating Card Style Container */}
      <div
        className={cn(
          "m-2 rounded-xl bg-background border shadow-lg transition-all duration-700 flex-1 overflow-hidden",
          isExpanded ? "shadow-xl" : "shadow-md",
        )}
      >
        {/* Header */}
        <div className={cn("p-4 border-b bg-gradient-to-r from-primary/5 to-secondary/5", !isExpanded && "px-2")}>
          <div className={cn("flex items-center gap-3", !isExpanded && "justify-center")}>
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-md">
              <span className="text-primary-foreground font-bold">SA</span>
            </div>
            <div
              className={cn(
                "transition-all duration-700",
                isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden",
              )}
            >
              <h2 className="font-bold text-lg">Strategy AI</h2>
              <p className="text-xs text-muted-foreground">Knowledge Platform</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="p-4 space-y-6">
          {navSections.map((section, sectionIndex) => (
            <div key={section.title} className="space-y-3">
              {/* Section Title */}
              <div className={cn("flex items-center gap-3", !isExpanded && "justify-center")}>
                <div
                  className={cn(
                    "p-2 rounded-lg transition-all duration-300",
                    isExpanded ? "bg-muted" : "bg-primary/10",
                  )}
                >
                  {section.icon}
                </div>
                <div
                  className={cn(
                    "transition-all duration-700",
                    isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden",
                  )}
                >
                  <h3 className="font-semibold text-sm">{section.title}</h3>
                  <div className="flex items-center gap-1 mt-1">
                    {section.items.map((_, i) => (
                      <Dot key={i} className="h-3 w-3 text-muted-foreground" />
                    ))}
                  </div>
                </div>
              </div>

              {/* Section Items */}
              <div className="space-y-2">
                {section.items.map((item, itemIndex) => (
                  <Button
                    key={item.href}
                    variant={pathname === item.href ? "default" : "ghost"}
                    className={cn(
                      "w-full justify-start gap-4 h-12 transition-all duration-500 relative overflow-hidden",
                      pathname === item.href && "shadow-md",
                      !isExpanded && "px-3 justify-center",
                      isExpanded && `animate-in slide-in-from-left-4 duration-500 delay-${itemIndex * 100}`,
                    )}
                    asChild
                  >
                    <Link href={item.href}>
                      <div className="relative z-10">{item.icon}</div>
                      <span
                        className={cn(
                          "relative z-10 transition-all duration-700 font-medium",
                          isExpanded ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden",
                        )}
                      >
                        {item.title}
                      </span>

                      {/* Active indicator */}
                      {pathname === item.href && (
                        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 animate-pulse" />
                      )}
                    </Link>
                  </Button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Hover Indicator */}
      <div
        className={cn(
          "absolute right-0 top-1/2 transform -translate-y-1/2 transition-all duration-300",
          isExpanded ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="w-1 h-16 bg-gradient-to-b from-transparent via-primary to-transparent rounded-l-full group-hover:via-primary/80" />
      </div>
    </aside>
  )
}
