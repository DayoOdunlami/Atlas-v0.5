"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Star, ThumbsUp, ThumbsDown, MessageCircle } from "lucide-react"
import { Badge } from "@/components/ui/badge"

interface FeedbackAnalyticsProps {
  analytics: any
}

export function FeedbackAnalytics({ analytics }: FeedbackAnalyticsProps) {
  // Mock feedback data
  const feedbackData = {
    averageRating: 4.2,
    totalRatings: 1247,
    ratingDistribution: [
      { stars: 5, count: 623, percentage: 50 },
      { stars: 4, count: 374, percentage: 30 },
      { stars: 3, count: 125, percentage: 10 },
      { stars: 2, count: 75, percentage: 6 },
      { stars: 1, count: 50, percentage: 4 },
    ],
    thumbsUp: 892,
    thumbsDown: 156,
    recentComments: [
      {
        id: 1,
        rating: 5,
        comment: "Very helpful for understanding rail modernization strategies",
        sector: "Rail",
        useCase: "Quick Playbook",
        date: "2024-01-15",
      },
      {
        id: 2,
        rating: 4,
        comment: "Good information but could be more detailed on maritime regulations",
        sector: "Maritime",
        useCase: "Lessons Learned",
        date: "2024-01-14",
      },
      {
        id: 3,
        rating: 5,
        comment: "Excellent project similarity analysis for highway infrastructure",
        sector: "Highways",
        useCase: "Project Similarity",
        date: "2024-01-13",
      },
    ],
  }

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star key={i} className={`h-4 w-4 ${i < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
    ))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Star className="h-5 w-5" />
          User Feedback Analytics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Rating */}
        <div className="text-center">
          <div className="text-3xl font-bold">{feedbackData.averageRating}</div>
          <div className="flex justify-center gap-1 mt-1">{renderStars(Math.round(feedbackData.averageRating))}</div>
          <div className="text-sm text-muted-foreground mt-1">Based on {feedbackData.totalRatings} ratings</div>
        </div>

        {/* Rating Distribution */}
        <div className="space-y-2">
          <h4 className="font-medium text-sm">Rating Distribution</h4>
          {feedbackData.ratingDistribution.map((item) => (
            <div key={item.stars} className="flex items-center gap-2">
              <div className="flex items-center gap-1 w-12">
                <span className="text-xs">{item.stars}</span>
                <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              </div>
              <div className="flex-1 bg-muted rounded-full h-2">
                <div className="bg-yellow-400 h-2 rounded-full" style={{ width: `${item.percentage}%` }} />
              </div>
              <div className="text-xs text-muted-foreground w-8">{item.count}</div>
            </div>
          ))}
        </div>

        {/* Thumbs Up/Down */}
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-2">
            <ThumbsUp className="h-4 w-4 text-green-500" />
            <div>
              <div className="font-medium">{feedbackData.thumbsUp}</div>
              <div className="text-xs text-muted-foreground">Helpful</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ThumbsDown className="h-4 w-4 text-red-500" />
            <div>
              <div className="font-medium">{feedbackData.thumbsDown}</div>
              <div className="text-xs text-muted-foreground">Not Helpful</div>
            </div>
          </div>
        </div>

        {/* Recent Comments */}
        <div className="space-y-3">
          <h4 className="font-medium text-sm flex items-center gap-2">
            <MessageCircle className="h-4 w-4" />
            Recent Comments
          </h4>
          {feedbackData.recentComments.map((comment) => (
            <div key={comment.id} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex gap-1">{renderStars(comment.rating)}</div>
                <div className="text-xs text-muted-foreground">{comment.date}</div>
              </div>
              <p className="text-sm">{comment.comment}</p>
              <div className="flex gap-2">
                <Badge variant="outline" className="text-xs">
                  {comment.sector}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {comment.useCase}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
