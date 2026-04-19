import { AppHeader } from "@/components/app-header"
import { APSViewer } from "@/components/aps-viewer"
import { IssueList } from "@/components/issue-list"

export default function HomePage() {
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-background">
      <AppHeader />
      {/* メインコンテンツ：左にビューア、右に指摘リスト */}
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* ビューアパネル（モバイル: 上部 45vh / デスクトップ: 左 55%） */}
        <div className="h-[45vh] lg:h-full lg:w-[55%] border-b lg:border-b-0 lg:border-r shrink-0 overflow-hidden">
          <APSViewer mode="list" />
        </div>
        {/* 指摘リストパネル */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-4">
            <IssueList />
          </div>
        </div>
      </div>
    </div>
  )
}
