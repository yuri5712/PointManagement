"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { StatusBadge } from "@/components/status-badge"
import { DueDateDisplay } from "@/components/due-date-display"
import { PhotoGallery } from "@/components/photo-gallery"
import { PhotoUpload } from "@/components/photo-upload"
import { IssueTimeline } from "@/components/issue-timeline"
import { useIssueStore } from "@/lib/issue-store"
import { useRoleStore, canTransitionTo, canCreateIssue, canChangeDueDate } from "@/lib/role-store"
import {
  STATUS_OPTIONS, getNextActionLabel, getLocationDisplayId,
  type Issue, type IssueStatus,
} from "@/lib/types"
import {
  ArrowLeft, User, Eye, ShieldAlert, Link2,
  Check, ChevronDown, ChevronUp, Clock, Plus,
  Lock, HardHat, ShieldCheck, MapPin, Camera, AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"

interface IssueDetailProps {
  issue: Issue
}

export function IssueDetail({ issue }: IssueDetailProps) {
  const router = useRouter()
  const { updateStatus, addPhoto, addRelatedIssue, issues } = useIssueStore()
  const { currentRole } = useRoleStore()

  // 是正報告用の写真（業者が是正後写真をアップして報告するフロー）
  const [correctionPhoto, setCorrectionPhoto] = useState<string | undefined>(undefined)

  const [showAllStatuses, setShowAllStatuses] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  const [showAddRelated, setShowAddRelated] = useState(false)
  const [relatedMemo, setRelatedMemo] = useState("")
  const [selectedRelatedId, setSelectedRelatedId] = useState("")

  const handleStatusChange = (newStatus: IssueStatus) => {
    updateStatus(issue.id, newStatus)
    setShowAllStatuses(false)
  }

  const handleAddRelated = () => {
    if (selectedRelatedId) {
      addRelatedIssue(issue.id, selectedRelatedId, relatedMemo || undefined)
      setSelectedRelatedId("")
      setRelatedMemo("")
      setShowAddRelated(false)
    }
  }

  const relatedIssues = issues.filter(
    (i) => issue.relatedIssues.some(r => r.id === i.id)
  )
  const relatedCandidates = issues.filter(
    (i) => i.id !== issue.id && !issue.relatedIssues.some(r => r.id === i.id)
  )
  const nextAction = getNextActionLabel(issue.status)

  // ロール別の権限
  const isSupervisor = currentRole === "監督"
  const isContractor = currentRole === "業者"

  // 是正報告ショートカット: 業者 + 対応中のときだけ表示
  const showCorrectionShortcut = isContractor && issue.status === "対応中"

  // クローズガード: 完了遷移は是正報告済 or 確認待ち からのみ許可
  const canClose = issue.status === "是正報告済" || issue.status === "確認待ち"
  const isCloseAction = nextAction?.nextStatus === "完了"

  const canDoNext =
    nextAction != null &&
    canTransitionTo(currentRole, nextAction.nextStatus) &&
    !(isCloseAction && !canClose)

  // 位置情報
  const locationId = getLocationDisplayId(issue.location) ?? issue.elementId

  return (
    <div className="flex flex-col gap-4 pb-8">
      {/* ─── ヘッダー ─── */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="h-14 w-14 shrink-0"
          onClick={() => router.push("/")}>
          <ArrowLeft className="h-7 w-7" />
        </Button>
        <div className="flex-1 min-w-0 pt-2">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm text-muted-foreground font-mono">{issue.id}</span>
            {issue.category === "安全" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-destructive/10 text-destructive text-xs font-medium rounded">
                <ShieldAlert className="w-3 h-3" />安全
              </span>
            )}
            {/* ロールバッジ */}
            <span className={cn(
              "inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold rounded-full",
              isSupervisor
                ? "bg-blue-100 text-blue-700"
                : "bg-orange-100 text-orange-700"
            )}>
              {isSupervisor
                ? <><ShieldCheck className="w-3 h-3" />監督モード</>
                : <><HardHat className="w-3 h-3" />業者モード</>}
            </span>
          </div>
          <h1 className="text-lg font-bold text-foreground text-balance">{issue.title}</h1>
          {/* 位置情報 */}
          {locationId && (
            <div className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 font-mono">
              <MapPin className="w-3 h-3" />{locationId}
            </div>
          )}
        </div>
      </div>

      {/* ─── ステータス・担当 ─── */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <StatusBadge status={issue.status} size="lg" />
              <DueDateDisplay dueDate={issue.dueDate} size="lg" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-muted rounded-lg"><User className="w-4 h-4 text-muted-foreground" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">担当（業者）</p>
                  <p className="text-sm font-medium">{issue.assignee}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="p-2 bg-muted rounded-lg"><Eye className="w-4 h-4 text-muted-foreground" /></div>
                <div>
                  <p className="text-xs text-muted-foreground">確認者（監督）</p>
                  <p className="text-sm font-medium">{issue.inspector}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── 業者：是正報告ショートカット ─── */}
      {showCorrectionShortcut && (
        <Card className="border-2 border-orange-300 bg-orange-50/60">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-base font-bold text-orange-700 flex items-center gap-2">
              <Camera className="w-5 h-5" />
              是正完了を報告する
            </CardTitle>
            <p className="text-xs text-orange-600 mt-0.5">
              是正後の写真を撮影し、監督に報告してください
            </p>
          </CardHeader>
          <CardContent className="pb-4 flex flex-col gap-3">
            <PhotoUpload
              value={correctionPhoto}
              onChange={setCorrectionPhoto}
              label="是正後の写真（必須）"
            />
            <Button
              size="lg"
              disabled={!correctionPhoto}
              className={cn(
                "h-16 text-xl font-bold",
                correctionPhoto
                  ? "bg-orange-500 hover:bg-orange-600 text-white"
                  : "opacity-40"
              )}
              onClick={() => {
                if (!correctionPhoto) return
                addPhoto(issue.id, { url: correctionPhoto, stage: "是正後" })
                updateStatus(issue.id, "是正報告済")
                setCorrectionPhoto(undefined)
              }}
            >
              <Check className="mr-2 h-6 w-6" />
              是正完了を報告する
            </Button>
            {!correctionPhoto && (
              <p className="text-xs text-muted-foreground text-center flex items-center justify-center gap-1">
                <Camera className="w-3 h-3" />写真を撮影すると報告ボタンが有効になります
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── クイックアクション ─── */}
      {nextAction && !showCorrectionShortcut && (
        canDoNext ? (
          <Button
            size="lg"
            className={cn(
              "h-16 text-xl font-bold",
              (issue.status === "是正報告済" || issue.status === "確認待ち")
                ? "bg-green-600 hover:bg-green-700"
                : ""
            )}
            onClick={() => handleStatusChange(nextAction.nextStatus)}
          >
            <Check className="mr-2 h-6 w-6" />
            {nextAction.label}
          </Button>
        ) : (
          /* 権限なし or クローズガード でボタンを無効表示 */
          <div className="flex flex-col gap-1.5">
            <div className="relative">
              <Button
                size="lg"
                disabled
                className="w-full h-16 text-xl font-bold opacity-40"
              >
                <Lock className="mr-2 h-5 w-5" />
                {nextAction.label}
              </Button>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="mt-8 text-xs text-muted-foreground bg-background/80 px-2 py-0.5 rounded">
                  {isCloseAction && !canClose ? "是正報告済になってからクローズできます" : "監督のみ操作可能"}
                </span>
              </div>
            </div>
            {isCloseAction && !canClose && (
              <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">
                  クローズするには先に「是正報告済」に変更する必要があります。
                  現在のステータス：<span className="font-semibold">{issue.status}</span>
                </p>
              </div>
            )}
          </div>
        )
      )}

      {/* ─── その他のステータス変更（監督のみ全表示 / 業者は対応中・是正報告済のみ） ─── */}
      {issue.status !== "完了" && (
        <Card>
          <CardHeader className="pb-2">
            <Button variant="ghost" className="w-full justify-between h-12 px-0"
              onClick={() => setShowAllStatuses(!showAllStatuses)}>
              <span className="text-base font-medium text-muted-foreground">その他のステータス変更</span>
              {showAllStatuses
                ? <ChevronUp className="w-5 h-5 text-muted-foreground" />
                : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
            </Button>
          </CardHeader>
          {showAllStatuses && (
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2">
                {STATUS_OPTIONS
                  .filter(s => s !== issue.status)
                  .map((status) => {
                    const allowed = canTransitionTo(currentRole, status)
                    return (
                      <Button
                        key={status}
                        variant="outline"
                        disabled={!allowed}
                        className={cn("h-14 text-base", !allowed && "opacity-40")}
                        onClick={() => allowed && handleStatusChange(status)}
                        title={!allowed ? "監督のみ操作可能" : undefined}
                      >
                        {!allowed && <Lock className="w-3 h-3 mr-1 text-muted-foreground" />}
                        {status}
                      </Button>
                    )
                  })}
              </div>
              {!isSupervisor && (
                <p className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
                  <Lock className="w-3 h-3" />「完了」「確認待ち」は監督のみ設定可能
                </p>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* ─── 写真（両ロール可） ─── */}
      <PhotoGallery
        issueId={issue.id}
        photos={issue.photos}
        allowAdd={issue.status !== "完了"}
      />

      {/* ─── 関連指摘（監督のみ追加可） ─── */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
              <Link2 className="w-4 h-4" />関連指摘
            </CardTitle>
            {isSupervisor && canCreateIssue(currentRole) && relatedCandidates.length > 0 && (
              <Button variant="outline" size="sm" className="h-10"
                onClick={() => setShowAddRelated(!showAddRelated)}>
                {showAddRelated
                  ? <><ChevronUp className="w-4 h-4 mr-1" />閉じる</>
                  : <><Plus className="w-4 h-4 mr-1" />追加</>}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {showAddRelated && (
            <div className="mb-4 p-4 bg-muted/50 rounded-lg flex flex-col gap-3">
              <p className="text-sm text-muted-foreground">指摘を選択</p>
              <div className="flex flex-col gap-2 max-h-40 overflow-y-auto">
                {relatedCandidates.map((c) => (
                  <Button key={c.id} variant={selectedRelatedId === c.id ? "default" : "outline"}
                    className="justify-start h-12 px-3"
                    onClick={() => setSelectedRelatedId(c.id)}>
                    <span className="text-xs font-mono mr-2">{c.id}</span>
                    <span className="text-sm truncate">{c.title}</span>
                  </Button>
                ))}
              </div>
              {selectedRelatedId && (
                <>
                  <Input value={relatedMemo} onChange={(e) => setRelatedMemo(e.target.value)}
                    placeholder="関連理由メモ（任意）" className="h-12" />
                  <Button className="h-14" onClick={handleAddRelated}>関連付ける</Button>
                </>
              )}
            </div>
          )}
          {relatedIssues.length > 0 ? (
            <div className="flex flex-col gap-2">
              {relatedIssues.map((related) => {
                const info = issue.relatedIssues.find(r => r.id === related.id)
                return (
                  <Button key={related.id} variant="outline"
                    className="justify-start h-auto py-3 px-4"
                    onClick={() => router.push(`/issues/${related.id}`)}>
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground font-mono">{related.id}</span>
                        <StatusBadge status={related.status} size="sm" />
                      </div>
                      <span className="text-sm font-medium block mt-1">{related.title}</span>
                      {info?.memo && (
                        <span className="text-xs text-muted-foreground block mt-1">{info.memo}</span>
                      )}
                    </div>
                  </Button>
                )
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">関連指摘はありません</p>
          )}
        </CardContent>
      </Card>

      {/* ─── 対応履歴 ─── */}
      <Card>
        <CardHeader className="pb-2">
          <Button variant="ghost" className="w-full justify-between h-12 px-0"
            onClick={() => setShowTimeline(!showTimeline)}>
            <span className="text-base font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" />対応履歴
              <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{issue.history.length}件</span>
            </span>
            {showTimeline
              ? <ChevronUp className="w-5 h-5 text-muted-foreground" />
              : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
          </Button>
        </CardHeader>
        {showTimeline && (
          <CardContent>
            <IssueTimeline history={issue.history} />
          </CardContent>
        )}
      </Card>
    </div>
  )
}
