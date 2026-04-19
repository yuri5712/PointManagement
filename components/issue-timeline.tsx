"use client"

import { 
  type HistoryEntry, 
  getHistoryActionLabel, 
  formatDateTime 
} from "@/lib/types"
import { 
  CirclePlus, 
  ArrowRightLeft, 
  Camera, 
  UserCheck, 
  Eye,
  Calendar,
  Link2
} from "lucide-react"
import { cn } from "@/lib/utils"

interface IssueTimelineProps {
  history: HistoryEntry[]
}

function getActionIcon(actionType: HistoryEntry["actionType"]) {
  switch (actionType) {
    case "created":
      return <CirclePlus className="w-4 h-4" />
    case "status_changed":
      return <ArrowRightLeft className="w-4 h-4" />
    case "photo_added":
      return <Camera className="w-4 h-4" />
    case "assignee_changed":
      return <UserCheck className="w-4 h-4" />
    case "inspector_changed":
      return <Eye className="w-4 h-4" />
    case "due_date_changed":
      return <Calendar className="w-4 h-4" />
    case "related_issue_added":
      return <Link2 className="w-4 h-4" />
    default:
      return <CirclePlus className="w-4 h-4" />
  }
}

function getActionColor(actionType: HistoryEntry["actionType"]) {
  switch (actionType) {
    case "created":
      return "bg-primary text-primary-foreground"
    case "status_changed":
      return "bg-status-reported text-white"
    case "photo_added":
      return "bg-status-in-progress text-foreground"
    case "assignee_changed":
    case "inspector_changed":
      return "bg-status-waiting text-foreground"
    default:
      return "bg-muted text-muted-foreground"
  }
}

function getActionDescription(entry: HistoryEntry): string {
  const { actionType, details } = entry
  
  switch (actionType) {
    case "created":
      return "指摘を起票しました"
    case "status_changed":
      return `ステータスを「${details.from}」から「${details.to}」に変更しました`
    case "photo_added":
      return `${details.photoStage}の写真を追加しました`
    case "assignee_changed":
      return `担当を「${details.from}」から「${details.to}」に変更しました`
    case "inspector_changed":
      return `確認者を「${details.from}」から「${details.to}」に変更しました`
    case "due_date_changed":
      return `期限を「${details.from}」から「${details.to}」に変更しました`
    case "related_issue_added":
      return `関連指摘「${details.relatedIssueId}」を追加しました${details.memo ? `（${details.memo}）` : ""}`
    default:
      return "更新しました"
  }
}

export function IssueTimeline({ history }: IssueTimelineProps) {
  // 新しい順にソート
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )

  return (
    <div className="relative">
      {/* 縦線 */}
      <div className="absolute left-5 top-0 bottom-0 w-0.5 bg-border" />
      
      <div className="flex flex-col gap-4">
        {sortedHistory.map((entry, index) => (
          <div key={entry.id} className="relative flex gap-4">
            {/* アイコン */}
            <div
              className={cn(
                "relative z-10 flex items-center justify-center w-10 h-10 rounded-full shrink-0",
                getActionColor(entry.actionType)
              )}
            >
              {getActionIcon(entry.actionType)}
            </div>
            
            {/* コンテンツ */}
            <div className="flex-1 pt-1.5 pb-2">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-semibold text-foreground text-sm">
                  {entry.actor}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(entry.timestamp)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                {getActionDescription(entry)}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
