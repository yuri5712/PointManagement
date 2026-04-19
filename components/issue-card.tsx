"use client"

import { Card, CardContent } from "@/components/ui/card"
import { StatusBadge } from "@/components/status-badge"
import { DueDateDisplay } from "@/components/due-date-display"
import type { Issue } from "@/lib/types"
import { getDueDateStatus } from "@/lib/types"
import { User, Eye, ShieldAlert, ChevronRight, Camera } from "lucide-react"
import { cn } from "@/lib/utils"

interface IssueCardProps {
  issue: Issue
  onClick: () => void
}

export function IssueCard({ issue, onClick }: IssueCardProps) {
  const dueDateStatus = getDueDateStatus(issue.dueDate)
  const isUrgent = dueDateStatus === "overdue" || dueDateStatus === "today"
  const photoCount = issue.photos.length
  const hasAfterPhoto = issue.photos.some(p => p.stage === "是正後")
  const isComplete = issue.status === "完了"

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all active:scale-[0.98] active:bg-muted/50",
        "min-h-[88px]",
        isUrgent && !isComplete && "border-l-4 border-l-destructive",
        isComplete && "opacity-60 bg-muted/30"
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex-1 min-w-0">
            {/* Top Row: Category + ID + Photo Count */}
            <div className="flex items-center gap-2 mb-1">
              {issue.category === "安全" && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-destructive/10 text-destructive text-xs font-medium rounded">
                  <ShieldAlert className="w-3 h-3" />
                  安全
                </span>
              )}
              <span className="text-xs text-muted-foreground font-mono">
                {issue.id}
              </span>
              {photoCount > 0 && (
                <span className={cn(
                  "inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded",
                  hasAfterPhoto ? "bg-status-complete/20 text-status-complete" : "bg-muted text-muted-foreground"
                )}>
                  <Camera className="w-3 h-3" />
                  {photoCount}
                </span>
              )}
            </div>
            
            {/* Title */}
            <h3 className="font-semibold text-foreground mb-2 line-clamp-1 text-base">
              {issue.title}
            </h3>
            
            {/* Bottom Row: Assignee + Inspector + Due Date */}
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <User className="w-4 h-4" />
                <span className="truncate max-w-[80px]">{issue.assignee}</span>
              </span>
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Eye className="w-4 h-4" />
                <span className="truncate max-w-[80px]">{issue.inspector}</span>
              </span>
              {!isComplete && (
                <DueDateDisplay dueDate={issue.dueDate} />
              )}
            </div>
          </div>
          
          {/* Right Side: Status + Arrow */}
          <div className="flex items-center gap-2 shrink-0">
            <StatusBadge status={issue.status} size="sm" />
            <ChevronRight className="w-6 h-6 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
