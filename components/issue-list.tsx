"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { IssueCard } from "@/components/issue-card"
import { IssueFilters, type DueDateFilter, type SortMode } from "@/components/issue-filters"
import { useIssueStore } from "@/lib/issue-store"
import { useViewerStore } from "@/lib/viewer-store"
import { useRoleStore } from "@/lib/role-store"
import { getDueDateStatus, matchesElementId, type IssueStatus } from "@/lib/types"
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle, EmptyDescription } from "@/components/ui/empty"
import { cn } from "@/lib/utils"
import {
  AlertTriangle, Clock, FileQuestion, ChevronDown, ChevronUp,
  User, Eye, MapPin, Link2, Unlink, MousePointerClick, Filter, FilterX,
  HardHat, Wrench,
} from "lucide-react"
import { StatusBadge } from "@/components/status-badge"

// objectId末尾8文字だけ表示
function shortId(id?: string) {
  if (!id) return "—"
  return id.length > 8 ? `…${id.slice(-8)}` : id
}

export function IssueList() {
  const router = useRouter()
  const { issues, linkElement, unlinkElement } = useIssueStore()
  const {
    selectedElementId,
    setSelectedElementId,
    setFocusedIssueId,
    setPendingSelectObjectId,
  } = useViewerStore()
  const { currentRole, contractorName } = useRoleStore()

  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>("all")
  const [statusFilter, setStatusFilter] = useState<IssueStatus | "all">("all")
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all")
  const [sortMode, setSortMode] = useState<SortMode>("dueDate")
  const [showAllIssues, setShowAllIssues] = useState(false)
  const [elementFilterActive, setElementFilterActive] = useState(true)

  // ─── ロール切替時: 業者は自動で担当フィルタON ─────────────
  useEffect(() => {
    if (currentRole === "業者") {
      setAssigneeFilter(contractorName)
      setShowAllIssues(true)
    } else {
      // 監督に戻したら担当フィルタをリセット
      setAssigneeFilter("all")
    }
  }, [currentRole, contractorName])

  // 要素選択時: 自動でフィルタON・リスト展開
  useEffect(() => {
    if (selectedElementId) {
      setElementFilterActive(true)
      setShowAllIssues(true)
    }
  }, [selectedElementId])

  // ─── 選択要素に紐付いた指摘 ─────────────────────────────
  const elementMatchedIssues = useMemo(
    () =>
      !selectedElementId
        ? []
        : issues.filter(
            (i) =>
              i.elementId === selectedElementId ||
              matchesElementId(i.location, selectedElementId)
          ),
    [issues, selectedElementId]
  )

  // ─── 今日やるべき指摘（ロール考慮） ────────────────────────
  const todayTasks = useMemo(() => {
    return issues
      .filter((issue) => {
        if (issue.status === "完了") return false
        const s = getDueDateStatus(issue.dueDate)
        if (s !== "overdue" && s !== "today") return false
        // 業者は自分の担当のみ
        if (currentRole === "業者" && issue.assignee !== contractorName) return false
        return true
      })
      .sort((a, b) => {
        const aS = getDueDateStatus(a.dueDate)
        const bS = getDueDateStatus(b.dueDate)
        if (aS === "overdue" && bS !== "overdue") return -1
        if (aS !== "overdue" && bS === "overdue") return 1
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      })
  }, [issues, currentRole, contractorName])

  const overdueCount = todayTasks.filter((i) => getDueDateStatus(i.dueDate) === "overdue").length
  const todayCount = todayTasks.filter((i) => getDueDateStatus(i.dueDate) === "today").length

  // ─── フィルタ済み指摘 ────────────────────────────────────
  const filteredIssues = useMemo(() => {
    const base =
      selectedElementId && elementFilterActive ? elementMatchedIssues : issues

    return base.filter((issue) => {
      if (dueDateFilter !== "all") {
        const s = getDueDateStatus(issue.dueDate)
        if (dueDateFilter === "overdue" && s !== "overdue") return false
        if (dueDateFilter === "today" && s !== "today") return false
        if (dueDateFilter === "tomorrow" && s !== "tomorrow") return false
      }
      if (statusFilter !== "all" && issue.status !== statusFilter) return false
      if (assigneeFilter !== "all" && issue.assignee !== assigneeFilter) return false
      return true
    })
  }, [issues, dueDateFilter, statusFilter, assigneeFilter, selectedElementId, elementFilterActive, elementMatchedIssues])

  // ─── ソート ─────────────────────────────────────────────
  const sortedIssues = useMemo(() => {
    return [...filteredIssues].sort((a, b) => {
      if (sortMode === "objectId") {
        // objectId順（未紐付きは末尾）
        const aId = a.elementId ?? ""
        const bId = b.elementId ?? ""
        if (aId !== bId) return aId.localeCompare(bId)
        // 同じobjectId内は期限順
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      }
      // デフォルト: 期限優先度順
      const aStatus = getDueDateStatus(a.dueDate)
      const bStatus = getDueDateStatus(b.dueDate)
      const priority = { overdue: 0, today: 1, tomorrow: 2, normal: 3 }
      const aPriority = a.status === "完了" ? 4 : priority[aStatus]
      const bPriority = b.status === "完了" ? 4 : priority[bStatus]
      if (aPriority !== bPriority) return aPriority - bPriority
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    })
  }, [filteredIssues, sortMode])

  const handleIssueClick = (issueId: string) => {
    // 指摘クリック時: selectedObjectId を更新 → Viewer と一覧を同期
    const issue = issues.find(i => i.id === issueId)
    if (issue?.elementId) {
      setSelectedElementId(issue.elementId)
      setFocusedIssueId(issueId)
      setPendingSelectObjectId(issue.elementId)
    }
    router.push(`/issues/${issueId}`)
  }

  const getBeforePhoto = (photos: typeof issues[0]["photos"]) =>
    photos.find((p) => p.stage === "是正前")?.url

  return (
    <div className="flex flex-col gap-4">

      {/* ─── ロールバナー ─────────────────────────────────── */}
      <div className={cn(
        "flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium",
        currentRole === "監督"
          ? "bg-blue-50 border-blue-200 text-blue-800"
          : "bg-orange-50 border-orange-200 text-orange-800"
      )}>
        {currentRole === "監督"
          ? <HardHat className="w-4 h-4 shrink-0" />
          : <Wrench className="w-4 h-4 shrink-0" />
        }
        <span>
          {currentRole === "監督"
            ? "監督モード — 全指摘を閲覧・管理できます"
            : `業者モード（${contractorName}）— 担当指摘のみ表示中`
          }
        </span>
        {currentRole === "業者" && (
          <span className="ml-auto text-xs font-normal text-orange-500">
            {issues.filter(i => i.assignee === contractorName && i.status !== "完了").length}件対応中
          </span>
        )}
      </div>

      {/* ─── 要素選択フィルタバナー ──────────────────────────── */}
      {selectedElementId && (
        <div className={cn(
          "flex items-center gap-2 px-3 py-2 border rounded-xl text-sm transition-colors",
          elementFilterActive
            ? "bg-blue-50 border-blue-300"
            : "bg-slate-50 border-slate-200"
        )}>
          <MapPin className={cn("w-4 h-4 shrink-0", elementFilterActive ? "text-blue-500" : "text-slate-400")} />
          <span className={cn("font-mono text-xs truncate", elementFilterActive ? "text-blue-700" : "text-slate-500")}
            title={selectedElementId}>
            {shortId(selectedElementId)}
          </span>
          <span className={cn("text-xs shrink-0", elementFilterActive ? "text-blue-500" : "text-slate-400")}>
            ({elementMatchedIssues.length}件)
          </span>
          <button
            onClick={() => setElementFilterActive(!elementFilterActive)}
            className={cn(
              "ml-auto flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-semibold transition-colors shrink-0",
              elementFilterActive
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-white text-slate-600 border border-slate-300 hover:bg-slate-100"
            )}
          >
            {elementFilterActive
              ? <><Filter className="w-3 h-3" />この要素のみ</>
              : <><FilterX className="w-3 h-3" />全指摘表示中</>
            }
          </button>
        </div>
      )}

      {/* ─── 今日やるべき指摘 ────────────────────────────────── */}
      {todayTasks.length > 0 && (
        <section className="bg-card rounded-xl border-2 border-destructive/30 overflow-hidden">
          <div className="bg-destructive/10 px-4 py-4 border-b border-destructive/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-destructive/20 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    {currentRole === "業者" ? "本日の担当指摘" : "今日やるべき指摘"}
                  </h2>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {overdueCount > 0 && (
                      <span className="text-destructive font-semibold">
                        {overdueCount}件の期限超過
                      </span>
                    )}
                    {overdueCount > 0 && todayCount > 0 && " / "}
                    {todayCount > 0 && (
                      <span className="text-warning-foreground font-semibold">
                        {todayCount}件の今日期限
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <div className="text-3xl font-bold text-destructive">{todayTasks.length}</div>
            </div>
          </div>

          <div className="divide-y divide-border">
            {todayTasks.map((issue) => {
              const isOverdue = getDueDateStatus(issue.dueDate) === "overdue"
              const beforePhoto = getBeforePhoto(issue.photos)
              return (
                <button
                  key={issue.id}
                  onClick={() => handleIssueClick(issue.id)}
                  className="w-full text-left p-4 hover:bg-muted/50 active:bg-muted transition-colors"
                >
                  <div className="flex items-start gap-4">
                    {beforePhoto && (
                      <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted relative">
                        <Image src={beforePhoto} alt="" fill className="object-cover" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-lg text-foreground truncate">
                            {issue.title}
                          </h3>
                          <div className="flex items-center gap-3 mt-1 flex-wrap">
                            <StatusBadge status={issue.status} size="sm" />
                            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                              <User className="w-3 h-3" />{issue.assignee}
                            </span>
                            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                              <Eye className="w-3 h-3" />{issue.inspector}
                            </span>
                          </div>
                          {issue.elementId && (
                            <div className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-mono">
                              <MapPin className="w-2.5 h-2.5" />
                              {shortId(issue.elementId)}
                            </div>
                          )}
                        </div>
                        <div className={cn(
                          "shrink-0 px-3 py-2 rounded-lg text-center min-w-[80px]",
                          isOverdue
                            ? "bg-destructive text-destructive-foreground"
                            : "bg-warning text-warning-foreground"
                        )}>
                          <div className="flex items-center justify-center gap-1">
                            {isOverdue
                              ? <AlertTriangle className="w-4 h-4" />
                              : <Clock className="w-4 h-4" />}
                            <span className="font-bold text-sm">
                              {isOverdue ? "超過" : "今日"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </section>
      )}

      {/* ─── すべての指摘 ────────────────────────────────────── */}
      <section>
        <button
          onClick={() => setShowAllIssues(!showAllIssues)}
          className="w-full flex items-center justify-between p-4 bg-card rounded-xl border hover:bg-muted/50 active:bg-muted transition-colors"
        >
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-foreground">
              {selectedElementId && elementFilterActive
                ? "この要素の指摘"
                : currentRole === "業者"
                  ? "担当指摘一覧"
                  : "すべての指摘"
              }
            </span>
            <span className="text-sm text-muted-foreground">
              ({selectedElementId && elementFilterActive
                ? `${sortedIssues.length}件 / 全${issues.length}件`
                : currentRole === "業者"
                  ? `${sortedIssues.length}件`
                  : `${issues.length}件`
              })
            </span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="text-sm">{showAllIssues ? "閉じる" : "表示"}</span>
            {showAllIssues
              ? <ChevronUp className="w-5 h-5" />
              : <ChevronDown className="w-5 h-5" />}
          </div>
        </button>

        {showAllIssues && (
          <div className="mt-4 flex flex-col gap-4">
            <IssueFilters
              dueDateFilter={dueDateFilter}
              statusFilter={statusFilter}
              assigneeFilter={assigneeFilter}
              sortMode={sortMode}
              onDueDateFilterChange={setDueDateFilter}
              onStatusFilterChange={setStatusFilter}
              onAssigneeFilterChange={setAssigneeFilter}
              onSortModeChange={setSortMode}
              lockedAssignee={currentRole === "業者" ? contractorName : undefined}
            />

            {sortedIssues.length === 0 ? (
              <Empty className="border">
                <EmptyHeader>
                  <EmptyMedia variant="icon"><FileQuestion /></EmptyMedia>
                  <EmptyTitle>指摘が見つかりません</EmptyTitle>
                  <EmptyDescription>フィルター条件を変更してください</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <div className="flex flex-col gap-2">
                {sortedIssues.map((issue) => {
                  const isLinkedToSelected =
                    selectedElementId &&
                    (issue.elementId === selectedElementId ||
                      matchesElementId(issue.location, selectedElementId))
                  const hasElement = !!issue.elementId

                  return (
                    <div
                      key={issue.id}
                      className={cn(
                        "flex flex-col rounded-xl overflow-hidden transition-shadow",
                        isLinkedToSelected && "ring-2 ring-blue-500 shadow-md"
                      )}
                    >
                      <IssueCard
                        issue={issue}
                        onClick={() => handleIssueClick(issue.id)}
                      />

                      {/* 要素紐付けバー */}
                      <div
                        className={cn(
                          "flex items-center gap-2 px-3 py-1.5 text-xs border border-t-0 rounded-b-xl",
                          hasElement
                            ? isLinkedToSelected
                              ? "bg-blue-100 border-blue-200"
                              : "bg-blue-50/60 border-blue-100"
                            : selectedElementId
                              ? "bg-slate-50 border-slate-200"
                              : "hidden"
                        )}
                      >
                        {hasElement ? (
                          <>
                            <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                            <span className="font-mono text-blue-700 truncate" title={issue.elementId}>
                              {shortId(issue.elementId)}
                            </span>
                            {isLinkedToSelected && (
                              <span className="text-blue-500 font-medium shrink-0">← 選択中</span>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setFocusedIssueId(issue.id)
                              }}
                              className="flex items-center gap-1 text-slate-500 hover:text-blue-600 transition-colors ml-2"
                              title="ビューアで位置を表示"
                            >
                              <MousePointerClick className="w-3 h-3" />
                              <span className="hidden sm:inline">ビューアで表示</span>
                            </button>
                            {currentRole === "監督" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  unlinkElement(issue.id)
                                }}
                                className="ml-auto flex items-center gap-1 text-slate-400 hover:text-destructive transition-colors"
                                title="紐付けを解除"
                              >
                                <Unlink className="w-3 h-3" />
                                <span className="hidden sm:inline">解除</span>
                              </button>
                            )}
                          </>
                        ) : selectedElementId ? (
                          currentRole === "監督" ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                linkElement(issue.id, selectedElementId)
                              }}
                              className="flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-medium transition-colors"
                            >
                              <Link2 className="w-3 h-3" />
                              <span className="font-mono truncate">{shortId(selectedElementId)}</span>
                              <span className="shrink-0">に紐付け</span>
                            </button>
                          ) : null
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
