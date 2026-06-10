"use client"

import { X, Download, Edit, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Sector, UseCase } from "@/lib/api-client"

interface Document {
  id: string
  title: string
  sector: Sector
  useCases: UseCase[]
  source: string
  date: string
  status: "processing" | "ready" | "error"
  fileType: string
  fileSize: string
}

interface DocumentPreviewProps {
  document: Document
  onClose: () => void
}

export function DocumentPreview({ document, onClose }: DocumentPreviewProps) {
  const getSectorBadge = (sector: Sector) => {
    const colors = {
      rail: "bg-blue-100 text-blue-800",
      maritime: "bg-cyan-100 text-cyan-800",
      highways: "bg-orange-100 text-orange-800",
      general: "bg-gray-100 text-gray-800",
    }

    return (
      <Badge variant="outline" className={colors[sector]}>
        {sector.charAt(0).toUpperCase() + sector.slice(1)}
      </Badge>
    )
  }

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>{document.title}</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Edit className="mr-2 h-4 w-4" />
                Edit
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
              <Button variant="ghost" size="icon" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Document Preview</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-[3/4] bg-muted rounded-lg flex items-center justify-center">
                  <div className="text-center text-muted-foreground">
                    <div className="text-6xl mb-4">📄</div>
                    <p className="text-lg font-medium">{document.fileType} Document</p>
                    <p className="text-sm">Preview not available</p>
                    <Button variant="outline" className="mt-4">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open in New Tab
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Document Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Sector</label>
                  <div className="mt-1">{getSectorBadge(document.sector)}</div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Use Cases</label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {document.useCases.map((useCase) => (
                      <Badge key={useCase} variant="outline" className="text-xs">
                        {useCase.replace("-", " ")}
                      </Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Source</label>
                  <p className="mt-1 text-sm">{document.source}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Upload Date</label>
                  <p className="mt-1 text-sm">{new Date(document.date).toLocaleDateString()}</p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">File Info</label>
                  <div className="mt-1 text-sm">
                    <p>{document.fileType}</p>
                    <p className="text-muted-foreground">{document.fileSize}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Status</label>
                  <div className="mt-1">
                    <Badge
                      variant={document.status === "ready" ? "default" : "secondary"}
                      className={
                        document.status === "ready"
                          ? "bg-green-100 text-green-800"
                          : document.status === "error"
                            ? "bg-red-100 text-red-800"
                            : ""
                      }
                    >
                      {document.status.charAt(0).toUpperCase() + document.status.slice(1)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>AI Analysis</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Key Topics</label>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Badge variant="outline">Infrastructure</Badge>
                    <Badge variant="outline">Modernization</Badge>
                    <Badge variant="outline">Strategy</Badge>
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Summary</label>
                  <p className="mt-1 text-sm text-muted-foreground">
                    This document outlines the strategic approach to railway infrastructure modernization, focusing on
                    digital transformation and sustainable development practices.
                  </p>
                </div>

                <div>
                  <label className="text-sm font-medium text-muted-foreground">Confidence Score</label>
                  <div className="mt-1">
                    <Badge variant="outline">92%</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
