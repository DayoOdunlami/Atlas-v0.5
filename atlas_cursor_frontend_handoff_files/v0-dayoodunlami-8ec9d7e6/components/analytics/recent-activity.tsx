"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, MessageSquare, Upload, User, Clock } from "lucide-react"

interface RecentActivityProps {
  activity?: any[]
}

export function RecentActivity({ activity }: RecentActivityProps) {
  // Default fallback activity data
  const defaultActivities = [
    {
      id: 1,
      type: "query",
      user: "Admin User",
      action: "Asked about rail electrification strategies",
      sector: "Rail",
      timestamp: "2 minutes ago",
      icon: MessageSquare,
    },
    {
      id: 2,
      type: "upload",
      user: "Analyst",
      action: "Uploaded 'Maritime Safety Guidelines 2024.pdf'",
      sector: "Maritime",
      timestamp: "15 minutes ago",
      icon: Upload,
    },
    {
      id: 3,
      type: "document",
      user: "System",
      action: "Processed document chunks for TRL mapping",
      sector: "Rail",
      timestamp: "32 minutes ago",
      icon: FileText,
    },
    {
      id: 4,
      type: "query",
      user: "Public User",
      action: "Searched for highway maintenance best practices",
      sector: "Highways",
      timestamp: "1 hour ago",
      icon: MessageSquare,
    },
    {
      id: 5,
      type: "upload",
      user: "Admin User",
      action: "Bulk uploaded 12 project documents",
      sector: "General",
      timestamp: "2 hours ago",
      icon: Upload,
    },
    {
      id: 6,
      type: "user",
      user: "New User",
      action: "Registered and completed onboarding",
      sector: "General",
      timestamp: "3 hours ago",
      icon: User,
    },
  ]

  // Use provided activity or default
  const activities = activity && activity.length > 0 ? activity.map((item, index) => ({
    id: index + 1,
    type: item.type === "document_upload" ? "upload" : 
          item.type === "document_processed" ? "document" : 
          item.type === "query" ? "query" : "user",
    user: item.user || "System",
    action: item.message,
    sector: "General", // Could be extracted from message or added to demo data
    timestamp: new Date(item.timestamp).toLocaleString(),
    icon: item.type === "document_upload" ? Upload :
          item.type === "document_processed" ? FileText :
          item.type === "query" ? MessageSquare : User,
  })) : defaultActivities

  const getSectorColor = (sector: string) => {
    switch (sector) {
      case "Rail":
        return "bg-blue-100 text-blue-800"
      case "Maritime":
        return "bg-cyan-100 text-cyan-800"
      case "Highways":
        return "bg-orange-100 text-orange-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case "query":
        return "text-green-600"
      case "upload":
        return "text-blue-600"
      case "document":
        return "text-purple-600"
      case "user":
        return "text-orange-600"
      default:
        return "text-gray-600"
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-start gap-3 p-3 border rounded-lg">
              <div className={`p-2 rounded-full bg-muted ${getTypeColor(activity.type)}`}>
                <activity.icon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{activity.user}</span>
                  <Badge variant="outline" className={`text-xs ${getSectorColor(activity.sector)}`}>
                    {activity.sector}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{activity.action}</p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="h-3 w-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{activity.timestamp}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
