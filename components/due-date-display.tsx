import { cn } from "@/lib/utils"
import { getDueDateStatus } from "@/lib/types"
import { AlertTriangle, Clock } from "lucide-react"

interface DueDateDisplayProps {
  dueDate: string
  className?: string
  size?: "sm" | "lg"
}

export function DueDateDisplay({ dueDate, className, size = "sm" }: DueDateDisplayProps) {
  const status = getDueDateStatus(dueDate)
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString("ja-JP", {
      month: "short",
      day: "numeric",
    })
  }

  const getDisplayText = () => {
    switch (status) {
      case "overdue":
        return "期限超過"
      case "today":
        return "今日期限"
      case "tomorrow":
        return "明日期限"
      default:
        return formatDate(dueDate)
    }
  }

  const getStatusStyles = () => {
    const baseSize = size === "lg" ? "px-3 py-1.5 text-base" : "px-2 py-1 text-sm"
    switch (status) {
      case "overdue":
        return cn("text-destructive font-bold bg-destructive/10 rounded-md", baseSize)
      case "today":
        return cn("text-warning-foreground font-semibold bg-warning/20 rounded-md", baseSize)
      case "tomorrow":
        return "text-primary font-medium"
      default:
        return "text-muted-foreground"
    }
  }

  const iconSize = size === "lg" ? "w-5 h-5" : "w-4 h-4"

  return (
    <span className={cn("inline-flex items-center gap-1", getStatusStyles(), className)}>
      {status === "overdue" && <AlertTriangle className={iconSize} />}
      {status === "today" && <Clock className={iconSize} />}
      {getDisplayText()}
    </span>
  )
}
