"use client"

import { use, useEffect } from "react"
import { notFound } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { IssueDetail } from "@/components/issue-detail"
import { APSViewer } from "@/components/aps-viewer"
import { useIssueStore } from "@/lib/issue-store"
import { useViewerStore } from "@/lib/viewer-store"
import { Box, Tag, CheckCircle2, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"

interface IssueDetailPageProps {
  params: Promise<{ id: string }>
}

export default function IssueDetailPage({ params }: IssueDetailPageProps) {
  const { id } = use(params)
  const { getIssueById } = useIssueStore()
  const issue = getIssueById(id)

  const {
    setSelectedElementId,
    setFocusedIssueId,
    setPendingSelectObjectId,
    selectedObject,
    selectedElementId,
  } = useViewerStore()

  // ─── 詳細ページマウント時: 対象要素をビューアで自動選択 ────
  // - selectedElementId → 一覧ハイライト・フィルタと連動
  // - focusedIssueId   → Mock 平面図のフロア切替と連動
  // - pendingSelectObjectId → 実 APS Viewer の select + fitToView をトリガー
  useEffect(() => {
    if (!issue?.elementId) return
    setSelectedElementId(issue.elementId)
    setFocusedIssueId(issue.id)
    setPendingSelectObjectId(issue.elementId)
  }, [issue?.id, issue?.elementId, setSelectedElementId, setFocusedIssueId, setPendingSelectObjectId])

  if (!issue) notFound()

  // 対象要素が Viewer でハイライト済みかどうか
  const isHighlighted =
    issue.elementId &&
    selectedElementId === issue.elementId &&
    selectedObject?.objectId === issue.elementId

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-slate-50">
      <AppHeader />

      {/* ─── 対象オブジェクト情報パネル ────────────────────────
           一覧ページとの視覚的差別化 + Viewer ハイライト状態表示
      ──────────────────────────────────────────────────── */}
      <div className="shrink-0 border-b bg-blue-600 text-white px-4 py-2.5">
        <div className="max-w-screen-xl mx-auto flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 shrink-0">
            <Box className="w-4 h-4 text-blue-200" />
            <span className="text-xs font-semibold text-blue-100 uppercase tracking-wide">
              指摘詳細
            </span>
          </div>

          <div className="w-px h-4 bg-blue-400 hidden sm:block" />

          {issue.elementId ? (
            <>
              {/* objectId */}
              <div className="flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-blue-300 shrink-0" />
                <span className="text-xs font-mono text-blue-100 truncate max-w-[200px]"
                  title={issue.elementId}>
                  {issue.elementId}
                </span>
              </div>

              {/* 要素名（selectedObject から取れた場合） */}
              {selectedObject?.name && selectedObject.objectId === issue.elementId && (
                <span className="text-xs font-semibold text-white truncate max-w-[200px]"
                  title={selectedObject.name}>
                  {selectedObject.name}
                </span>
              )}

              {/* ハイライト状態バッジ */}
              <div className={cn(
                "ml-auto flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full shrink-0",
                isHighlighted
                  ? "bg-green-500/20 text-green-200 border border-green-400/40"
                  : "bg-blue-500/30 text-blue-200 border border-blue-400/30"
              )}>
                {isHighlighted ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Viewerでハイライト中
                  </>
                ) : (
                  <>
                    <Box className="w-3.5 h-3.5 animate-pulse" />
                    Viewer読み込み中…
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-1.5 text-xs text-amber-200">
              <AlertTriangle className="w-3.5 h-3.5" />
              この指摘に対象要素が紐付いていません
            </div>
          )}
        </div>
      </div>

      {/* ─── スプリットレイアウト: 左 Viewer / 右 詳細 ──────── */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

        {/* ─── ビューアパネル（モバイル: 上部 45vh / デスクトップ: 左 55%）
             ring-2 で詳細ページ専用の青いアクセントボーダーを表示
        ──────────────────────────────────────────────────── */}
        <div className={cn(
          "h-[45vh] lg:h-full lg:w-[55%] shrink-0 overflow-hidden",
          "border-b lg:border-b-0 lg:border-r border-blue-200",
          "ring-inset",
          issue.elementId && "lg:ring-2 lg:ring-blue-400/60"
        )}>
          <APSViewer mode="detail" />
        </div>

        {/* ─── 詳細パネル ────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto bg-white">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <IssueDetail issue={issue} />
          </div>
        </div>

      </div>
    </div>
  )
}
