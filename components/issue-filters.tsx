"use client"

import { Button } from "@/components/ui/button"
import { STATUS_OPTIONS, ASSIGNEE_OPTIONS, type IssueStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { ChevronDown, ChevronUp, Filter, ArrowUpDown, Lock } from "lucide-react"

export type DueDateFilter = "all" | "today" | "tomorrow" | "overdue"
export type SortMode = "dueDate" | "objectId"

interface IssueFiltersProps {
  dueDateFilter: DueDateFilter
  statusFilter: IssueStatus | "all"
  assigneeFilter: string | "all"
  sortMode: SortMode
  onDueDateFilterChange: (filter: DueDateFilter) => void
  onStatusFilterChange: (filter: IssueStatus | "all") => void
  onAssigneeFilterChange: (filter: string | "all") => void
  onSortModeChange: (mode: SortMode) => void
  /** 業者ロール時: この担当者に固定（変更不可） */
  lockedAssignee?: string
}

export function IssueFilters({
  dueDateFilter,
  statusFilter,
  assigneeFilter,
  sortMode,
  onDueDateFilterChange,
  onStatusFilterChange,
  onAssigneeFilterChange,
  onSortModeChange,
  lockedAssignee,
}: IssueFiltersProps) {
  const [showMoreFilters, setShowMoreFilters] = useState(false)

  const dueDateOptions: { value: DueDateFilter; label: string }[] = [
    { value: "all", label: "すべて" },
    { value: "overdue", label: "期限超過" },
    { value: "today", label: "今日" },
    { value: "tomorrow", label: "明日" },
  ]

  const hasActiveFilters =
    statusFilter !== "all" || (!lockedAssignee && assigneeFilter !== "all")

  return (
    <div className="flex flex-col gap-3">
      {/* ─── ソートモード切替 ──────────────────────────────── */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5" />
          並び順
        </span>
        <div className="flex gap-2">
          <Button
            variant={sortMode === "dueDate" ? "default" : "outline"}
            size="sm"
            className="h-9 text-xs"
            onClick={() => onSortModeChange("dueDate")}
          >
            期限順
          </Button>
          <Button
            variant={sortMode === "objectId" ? "default" : "outline"}
            size="sm"
            className="h-9 text-xs font-mono"
            onClick={() => onSortModeChange("objectId")}
          >
            オブジェクトID順
          </Button>
        </div>
      </div>

      {/* ─── 期限クイックフィルタ ──────────────────────────── */}
      <div className="grid grid-cols-4 gap-2">
        {dueDateOptions.map((option) => (
          <Button
            key={option.value}
            variant={dueDateFilter === option.value ? "default" : "outline"}
            className={cn(
              "h-12 text-sm font-medium px-2",
              option.value === "overdue" &&
                dueDateFilter !== option.value &&
                "border-destructive text-destructive",
              option.value === "today" &&
                dueDateFilter !== option.value &&
                "border-warning text-warning-foreground"
            )}
            onClick={() => onDueDateFilterChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>

      {/* ─── 詳細フィルタ展開 ───────────────────────────────── */}
      <Button
        variant="ghost"
        className={cn(
          "h-12 justify-between",
          hasActiveFilters && "text-primary"
        )}
        onClick={() => setShowMoreFilters(!showMoreFilters)}
      >
        <span className="flex items-center gap-2">
          <Filter className="w-4 h-4" />
          絞り込み
          {hasActiveFilters && (
            <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
              ON
            </span>
          )}
        </span>
        {showMoreFilters ? (
          <ChevronUp className="w-5 h-5" />
        ) : (
          <ChevronDown className="w-5 h-5" />
        )}
      </Button>

      {showMoreFilters && (
        <div className="flex flex-col gap-4 p-4 bg-muted/50 rounded-lg">
          {/* ステータスフィルタ */}
          <div>
            <p className="text-sm text-muted-foreground mb-2">ステータス</p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={statusFilter === "all" ? "default" : "outline"}
                className="h-11 text-sm"
                onClick={() => onStatusFilterChange("all")}
              >
                すべて
              </Button>
              {STATUS_OPTIONS.map((status) => (
                <Button
                  key={status}
                  variant={statusFilter === status ? "default" : "outline"}
                  className="h-11 text-sm"
                  onClick={() => onStatusFilterChange(status)}
                >
                  {status}
                </Button>
              ))}
            </div>
          </div>

          {/* 担当者フィルタ（業者ロール時はロック表示） */}
          <div>
            <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1.5">
              担当者
              {lockedAssignee && (
                <span className="inline-flex items-center gap-1 text-xs text-orange-600 bg-orange-50 border border-orange-200 px-1.5 py-0.5 rounded-full font-medium">
                  <Lock className="w-2.5 h-2.5" />
                  業者モードで固定
                </span>
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              {lockedAssignee ? (
                // 業者モード: 自分の名前だけ表示（変更不可）
                <Button
                  variant="default"
                  className="h-11 text-sm cursor-default opacity-80"
                  disabled
                >
                  {lockedAssignee}
                </Button>
              ) : (
                <>
                  <Button
                    variant={assigneeFilter === "all" ? "default" : "outline"}
                    className="h-11 text-sm"
                    onClick={() => onAssigneeFilterChange("all")}
                  >
                    すべて
                  </Button>
                  {ASSIGNEE_OPTIONS.map((assignee) => (
                    <Button
                      key={assignee}
                      variant={assigneeFilter === assignee ? "default" : "outline"}
                      className="h-11 text-sm"
                      onClick={() => onAssigneeFilterChange(assignee)}
                    >
                      {assignee}
                    </Button>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* フィルタクリア */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              className="h-11 text-destructive"
              onClick={() => {
                onStatusFilterChange("all")
                if (!lockedAssignee) onAssigneeFilterChange("all")
              }}
            >
              フィルターをクリア
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
