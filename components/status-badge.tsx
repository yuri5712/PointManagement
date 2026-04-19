import { cn } from "@/lib/utils"
import { getStatusColor, type IssueStatus } from "@/lib/types"

interface StatusBadgeProps {
  status: IssueStatus
  size?: "sm" | "md" | "lg"
}

export function StatusBadge({ status, size = "md" }: StatusBadgeProps) {
  const sizeClasses = {
    sm: "px-2 py-0.5 text-xs",
    md: "px-3 py-1 text-sm",
    lg: "px-4 py-1.5 text-base",
  }

  return (
    <span
      className={cn(
        "inline-flex items-center font-medium rounded-md whitespace-nowrap",
        getStatusColor(status),
        sizeClasses[size]
      )}
    >
      {status}
    </span>
  )
}
