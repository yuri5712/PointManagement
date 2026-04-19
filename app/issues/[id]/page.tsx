"use client"

import { use, useEffect } from "react"
import { notFound } from "next/navigation"
import { AppHeader } from "@/components/app-header"
import { IssueDetail } from "@/components/issue-detail"
import { APSViewer } from "@/components/aps-viewer"
import { useIssueStore } from "@/lib/issue-store"
import { useViewerStore } from "@/lib/viewer-store"

interface IssueDetailPageProps {
  params: Promise<{ id: string }>
}

export default function IssueDetailPage({ params }: IssueDetailPageProps) {
  const { id } = use(params)
  const { getIssueById } = useIssueStore()
  const issue = getIssueById(id)

  const { setSelectedElementId, setFocusedIssueId, setPendingSelectObjectId } = useViewerStore()

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

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <AppHeader />

      {/* スプリットレイアウト: 左 Viewer / 右 詳細 */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">

        {/* ─── ビューアパネル（モバイル: 上部 40vh / デスクトップ: 左 45%）── */}
        <div className="h-[40vh] lg:h-full lg:w-[45%] border-b lg:border-b-0 lg:border-r shrink-0 overflow-hidden">
          <APSViewer />
        </div>

        {/* ─── 詳細パネル ─────────────────────────────────────── */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 py-6">
            <IssueDetail issue={issue} />
          </div>
        </div>

      </div>
    </div>
  )
}
