"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PhotoUpload } from "@/components/photo-upload"
import { useIssueStore } from "@/lib/issue-store"
import { useViewerStore, type SelectedObject } from "@/lib/viewer-store"
import { getElementMetadata, CATEGORY_COLOR } from "@/lib/element-metadata"
import { generateDraft } from "@/lib/draft-generator"
import {
  CATEGORY_OPTIONS, ASSIGNEE_OPTIONS, INSPECTOR_OPTIONS,
  DUE_DATE_PRESETS, type IssueCategory, type Photo, type IssueLocation,
} from "@/lib/types"
import {
  ArrowLeft, Save, ShieldAlert, FileText, User, Eye,
  MapPin, X, Link2, Tag, RotateCcw, CheckCircle2, XCircle, Sparkles,
} from "lucide-react"
import { cn } from "@/lib/utils"

// ─── バリデーションルール ─────────────────────────────────
interface ValidationRule {
  id: string
  label: string
  hint: string
  step: number   // どのカードに赤枠を付けるか
  met: boolean
}

function buildValidationRules(vals: {
  photo?: string
  title: string
  assignee: string
}): ValidationRule[] {
  return [
    {
      id: "photo",
      label: "是正前写真が未添付です",
      hint: "ステップ1 で写真を1枚以上添付してください",
      step: 1,
      met: !!vals.photo,
    },
    {
      id: "title",
      label: "指摘内容が未入力です",
      hint: "ステップ2 で指摘内容を入力してください",
      step: 2,
      met: vals.title.trim().length > 0,
    },
    {
      id: "assignee",
      label: "担当者（業者）が未選択です",
      hint: "ステップ3 で担当者を選択してください",
      step: 3,
      met: vals.assignee.length > 0,
    },
  ]
}

function shortId(id: string) {
  return id.length > 12 ? `…${id.slice(-12)}` : id
}

export function IssueCreateForm() {
  const router = useRouter()
  const { addIssue, currentUser } = useIssueStore()
  const { selectedElementId, selectedObject, pinLocation } = useViewerStore()

  // ─── 紐付け位置（起票時点スナップショット） ───────────────
  // selectedObject があればそちらを優先（名前・カテゴリ・worldPos を含む）
  const [linkedObject, setLinkedObject] = useState<SelectedObject | null>(
    selectedObject ?? null
  )
  const [linkedPin] = useState(pinLocation)

  // 後方互換: linkedElementId は linkedObject.objectId にフォールバック
  const linkedElementId = linkedObject?.objectId ?? null

  const buildLocation = (): IssueLocation | undefined => {
    if (linkedElementId) return { type: "aps", elementId: linkedElementId }
    if (linkedPin) return { type: "2d", floorId: linkedPin.floorId, x: linkedPin.x, y: linkedPin.y }
    return undefined
  }

  // ─── フォームフィールド ───────────────────────────────────
  const [photo, setPhoto]         = useState<string | undefined>()
  const [title, setTitle]         = useState("")
  const [draftGenerated, setDraftGenerated] = useState(false)
  const [category, setCategory]   = useState<IssueCategory>("通常")
  const [assignee, setAssignee]   = useState("")
  const [inspector, setInspector] = useState(INSPECTOR_OPTIONS[0])
  const [dueDays, setDueDays]     = useState<number>(3) // デフォルト +3日

  const getDueDateFromDays = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days)
    return d.toISOString().split("T")[0]
  }
  const dueDate = getDueDateFromDays(dueDays)

  // ─── 自動下書き生成 ──────────────────────────────────────
  // 写真が追加され、タイトルが空の場合に自動生成
  useEffect(() => {
    if (photo && !draftGenerated && !title) {
      const draft = generateDraft(linkedElementId, category)
      setTitle(draft)
      setDraftGenerated(true)
    }
  }, [photo]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRegenerate = () => {
    const draft = generateDraft(linkedElementId, category)
    setTitle(draft)
    setDraftGenerated(true)
  }

  // ─── バリデーション ───────────────────────────────────────
  const validationRules = buildValidationRules({ photo, title, assignee })
  const unmetRules = validationRules.filter(r => !r.met)
  const isValid    = unmetRules.length === 0
  const unmetSteps = new Set(unmetRules.map(r => r.step))

  // ─── 送信 ────────────────────────────────────────────────
  const handleSubmit = () => {
    if (!isValid) return
    const photos: Photo[] = photo ? [{
      id: `photo-new-${Date.now()}`,
      url: photo,
      stage: "是正前",
      addedAt: new Date().toISOString(),
      addedBy: currentUser,
    }] : []

    addIssue({
      title, category, assignee, inspector, dueDate,
      status: "未着手", photos, relatedIssues: [],
      elementId: linkedElementId ?? undefined,
      location: buildLocation(),
      worldPos: linkedObject?.worldPos,
    })
    router.push("/")
  }

  // ─── 要素メタデータ ───────────────────────────────────────
  // linkedObject（selectedObject スナップショット）から直接取得するのが最優先。
  // フォールバックとして APS デモデータを参照する。
  const elementMeta = linkedObject
    ? {
        name: linkedObject.name,
        category: linkedObject.category,
        detail: undefined as string | undefined,
        level: linkedObject.worldPos?.floorId,
      }
    : linkedElementId
      ? getElementMetadata(linkedElementId)
      : null

  return (
    <div className="flex flex-col gap-4 pb-8">

      {/* ─── ヘッダー ─────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-14 w-14 shrink-0" onClick={() => router.back()}>
          <ArrowLeft className="h-7 w-7" />
        </Button>
        <h1 className="text-xl font-bold">新規指摘</h1>
      </div>

      {/* ─── 対象要素（常に固定表示） ─────────────────────────
           ユーザーが「どの要素に対して起票しているか」を
           常に画面上部で確認できるようにする
      ─────────────────────────────────────────────────────── */}
      <Card className={cn(
        "border-2 overflow-hidden",
        linkedElementId || linkedPin ? "border-blue-300" : "border-dashed border-slate-300"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            対象要素
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {linkedElementId && elementMeta ? (
            <>
              <div className="flex items-start gap-3 p-3 bg-blue-50 rounded-xl border border-blue-200">
                <div className="p-2 bg-blue-100 rounded-lg shrink-0">
                  <Tag className="w-4 h-4 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-slate-800">{elementMeta.name}</span>
                    <span className={cn(
                      "text-[11px] font-bold px-2 py-0.5 rounded border",
                      CATEGORY_COLOR[elementMeta.category as keyof typeof CATEGORY_COLOR]
                        ?? "bg-slate-100 text-slate-600 border-slate-200"
                    )}>
                      {elementMeta.category}
                    </span>
                  </div>
                  {elementMeta.detail && <p className="text-xs text-slate-500 mt-0.5">{elementMeta.detail}</p>}
                  {elementMeta.level && <p className="text-xs text-slate-400 mt-0.5">📍 {elementMeta.level}</p>}
                  <p className="text-[10px] font-mono text-blue-400 mt-1 truncate" title={linkedElementId}>
                    objectId: {linkedElementId}
                  </p>
                </div>
                <button onClick={() => setLinkedObject(null)}
                  className="p-1 text-slate-400 hover:text-destructive transition-colors shrink-0 mt-0.5">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <button onClick={() => router.back()}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-slate-500 hover:text-blue-600 border border-dashed border-slate-300 hover:border-blue-300 rounded-xl transition-colors">
                <RotateCcw className="w-4 h-4" />
                ビューアに戻って選び直す
              </button>
            </>
          ) : linkedPin ? (
            <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl border border-violet-200">
              <MapPin className="w-5 h-5 text-violet-600 shrink-0" />
              <div>
                <p className="text-xs text-violet-500 font-medium">2Dピン位置</p>
                <p className="font-mono text-sm text-violet-800 mt-0.5">
                  {linkedPin.floorId}　({Math.round(linkedPin.x)}, {Math.round(linkedPin.y)})
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <MapPin className="w-8 h-8 text-slate-300" />
              <p className="text-sm text-slate-400 text-center">対象要素が未選択です</p>
              <button onClick={() => router.back()}
                className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 font-medium">
                <RotateCcw className="w-4 h-4" />
                ビューアで要素を選択する
              </button>
            </div>
          )}
          {/* ビューアの現在選択と異なる場合 → 追従ボタン */}
          {selectedElementId && selectedElementId !== linkedElementId && (
            <button
              onClick={() => setLinkedObject(
                selectedObject ?? { objectId: selectedElementId, name: selectedElementId, category: "その他" }
              )}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-blue-200 bg-white text-xs text-blue-700 hover:bg-blue-50 transition-colors">
              <MapPin className="w-3.5 h-3.5 text-blue-500 shrink-0" />
              <span className="font-mono truncate">
                {selectedObject?.name ?? shortId(selectedElementId)}
              </span>
              <span className="text-blue-400 ml-auto shrink-0">← ビューアの選択を使う</span>
            </button>
          )}
        </CardContent>
      </Card>

      {/* ─── Step 1: 写真（必須） ─────────────────────────── */}
      <Card className={cn("border-2 transition-colors",
        unmetSteps.has(1) ? "border-destructive/50" : photo ? "border-green-200" : "border-transparent"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-muted-foreground flex items-center justify-between">
            <span>1. 是正前写真 <span className="text-destructive text-sm">*</span></span>
            {photo
              ? <CheckCircle2 className="w-4 h-4 text-green-500" />
              : <XCircle className="w-4 h-4 text-destructive/40" />
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          <PhotoUpload value={photo} onChange={setPhoto} label="是正前の写真" />
          {photo && !draftGenerated && (
            <p className="text-xs text-muted-foreground mt-2 text-center animate-pulse">
              指摘内容を自動生成しています…
            </p>
          )}
        </CardContent>
      </Card>

      {/* ─── Step 2: 指摘内容（自動下書き対応）（必須） ──────── */}
      <Card className={cn("border-2 transition-colors",
        unmetSteps.has(2) ? "border-destructive/50" : title ? "border-green-200" : "border-transparent"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-muted-foreground flex items-center justify-between">
            <span>2. 指摘内容 <span className="text-destructive text-sm">*</span></span>
            {title
              ? <CheckCircle2 className="w-4 h-4 text-green-500" />
              : <XCircle className="w-4 h-4 text-destructive/40" />
            }
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="指摘内容を入力してください"
            className="h-14 text-base"
          />
          {/* 自動生成ボタン */}
          <button
            onClick={handleRegenerate}
            className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {draftGenerated ? "再生成する" : "対象要素から自動生成"}
          </button>

          {/* 分類トグル（このステップに統合） */}
          <div className="pt-2 border-t border-muted/50">
            <p className="text-xs text-muted-foreground mb-2">分類</p>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORY_OPTIONS.map(cat => (
                <Button key={cat} type="button"
                  variant={category === cat ? "default" : "outline"}
                  className={cn("h-12 text-base font-semibold",
                    cat === "安全" && category !== cat && "border-destructive text-destructive",
                    cat === "安全" && category === cat && "bg-destructive hover:bg-destructive/90"
                  )}
                  onClick={() => setCategory(cat)}
                >
                  {cat === "安全" && <ShieldAlert className="mr-2 h-4 w-4" />}
                  {cat === "通常" && <FileText className="mr-2 h-4 w-4" />}
                  {cat}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Step 3: 担当者（必須） ───────────────────────── */}
      <Card className={cn("border-2 transition-colors",
        unmetSteps.has(3) ? "border-destructive/50" : assignee ? "border-green-200" : "border-transparent"
      )}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-muted-foreground flex items-center justify-between">
            <span className="flex items-center gap-2">
              <User className="w-4 h-4" />3. 担当（業者）<span className="text-destructive text-sm">*</span>
            </span>
            {assignee
              ? <CheckCircle2 className="w-4 h-4 text-green-500" />
              : <XCircle className="w-4 h-4 text-destructive/40" />
            }
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {ASSIGNEE_OPTIONS.map(name => (
              <Button key={name} type="button"
                variant={assignee === name ? "default" : "outline"}
                className="h-14 text-base"
                onClick={() => setAssignee(name)}>
                {name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── Step 4: 期限（デフォルト+3日） ──────────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-muted-foreground">
            4. 期限（デフォルト: +3日）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {DUE_DATE_PRESETS.map(preset => (
              <Button key={preset.days} type="button"
                variant={dueDays === preset.days ? "default" : "outline"}
                className={cn("h-14 text-base flex-col gap-0.5 px-2",
                  preset.days === 0 && dueDays !== preset.days && "border-warning text-warning-foreground"
                )}
                onClick={() => setDueDays(preset.days)}>
                <span className="font-semibold">{preset.label}</span>
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-center">
            期限: {dueDate}
          </p>
        </CardContent>
      </Card>

      {/* ─── Step 5: 確認者（任意・折りたたみ気味） ──────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-muted-foreground flex items-center gap-2">
            <Eye className="w-4 h-4" />5. 確認者（監督）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-2">
            {INSPECTOR_OPTIONS.map(name => (
              <Button key={name} type="button"
                variant={inspector === name ? "default" : "outline"}
                className="h-14 text-base"
                onClick={() => setInspector(name)}>
                {name}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* ─── バリデーションサマリー + 送信ボタン ──────────── */}
      <div className="sticky bottom-4 pt-2 flex flex-col gap-2">
        {unmetRules.length > 0 && (
          <div className="px-4 py-3 bg-destructive/5 border border-destructive/20 rounded-xl flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-destructive/80 mb-0.5">
              起票するには以下を入力してください
            </p>
            {unmetRules.map(rule => (
              <div key={rule.id} className="flex items-start gap-2 text-sm">
                <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                <div>
                  <span className="font-medium text-destructive">{rule.label}</span>
                  <p className="text-xs text-muted-foreground">{rule.hint}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {isValid && (
          <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="font-medium">準備完了 — 起票できます</span>
            {linkedElementId && (
              <span className="ml-auto text-xs text-green-500 font-mono truncate">
                {shortId(linkedElementId)} に紐付け
              </span>
            )}
          </div>
        )}

        <Button type="button" size="lg"
          className="w-full h-16 text-xl font-bold shadow-lg"
          disabled={!isValid}
          onClick={handleSubmit}>
          <Save className="mr-2 h-6 w-6" />
          起票する
        </Button>
      </div>
    </div>
  )
}
