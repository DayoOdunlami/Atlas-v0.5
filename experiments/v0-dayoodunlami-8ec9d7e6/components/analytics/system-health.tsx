"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Activity, Database, Server, Zap } from "lucide-react"

export function SystemHealth() {
  const healthMetrics = [
    {
      component: "API Server",
      status: "healthy",
      uptime: "99.8%",
      responseTime: "120ms",
      icon: Server,
    },
    {
      component: "Database",
      status: "healthy",
      uptime: "99.9%",
      responseTime: "45ms",
      icon: Database,
    },
    {
      component: "AI Service",
      status: "healthy",
      uptime: "99.5%",
      responseTime: "1.2s",
      icon: Zap,
    },
    {
      component: "Document Processing",
      status: "warning",
      uptime: "98.2%",
      responseTime: "3.4s",
      icon: Activity,
    },
  ]

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "healthy":
        return <Badge className="bg-green-100 text-green-800">Healthy</Badge>
      case "warning":
        return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>
      case "error":
        return <Badge variant="destructive">Error</Badge>
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" />
          System Health
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {healthMetrics.map((metric) => (
          <div key={metric.component} className="flex items-center justify-between p-3 border rounded-lg">
            <div className="flex items-center gap-3">
              <metric.icon className="h-5 w-5 text-muted-foreground" />
              <div>
                <div className="font-medium text-sm">{metric.component}</div>
                <div className="text-xs text-muted-foreground">
                  {metric.uptime} uptime • {metric.responseTime} avg
                </div>
              </div>
            </div>
            {getStatusBadge(metric.status)}
          </div>
        ))}

        <div className="pt-4 border-t">
          <div className="text-sm font-medium mb-2">Overall System Status</div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-sm">All systems operational</span>
          </div>
          <div className="text-xs text-muted-foreground mt-1">Last updated: {new Date().toLocaleTimeString()}</div>
        </div>
      </CardContent>
    </Card>
  )
}
