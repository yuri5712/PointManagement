export type IssueStatus =
  | "未着手"
  | "対応中"
  | "是正報告済"
  | "確認待ち"
  | "完了"

export type IssueCategory = "通常" | "安全"

export type PhotoStage = "是正前" | "是正中" | "是正後"

// ─── 位置情報 union 型（指示3: BIM逃げ道）──────────────────
/** APS 3Dビューアの要素に紐づく位置 */
export type APSLocation       = { type: "aps";       elementId: string }
/** 2D平面図上のピン位置（SVG座標系） */
export type PinLocation       = { type: "2d";        floorId: string; x: number; y: number }
/** 階層（フロア＋部屋）での位置 */
export type HierarchyLocation = { type: "hierarchy"; floorId: string; elementId: string }

export type IssueLocation = APSLocation | PinLocation | HierarchyLocation

/** 指摘の位置座標（ピン描画に使用）
 *  coordSystem: "svg" = モック平面図の SVG 座標系（viewBox 0 0 500 360）
 *               "bim" = APS BIM 世界座標系
 */
export interface IssueWorldPos {
  x: number
  y: number
  z?: number
  floorId?: string
  coordSystem: "bim" | "svg"
}

/** 位置情報から表示用IDを取得するヘルパー */
export function getLocationDisplayId(location?: IssueLocation): string | undefined {
  if (!location) return undefined
  if (location.type === "aps")       return location.elementId
  if (location.type === "hierarchy") return location.elementId
  if (location.type === "2d")
    return `${location.floorId}@(${Math.round(location.x)},${Math.round(location.y)})`
  return undefined
}

/** ビューアのselectedElementIdと一致するか判定するヘルパー */
export function matchesElementId(location: IssueLocation | undefined, elementId: string): boolean {
  if (!location) return false
  if (location.type === "aps")       return location.elementId === elementId
  if (location.type === "hierarchy") return location.elementId === elementId
  if (location.type === "2d")        return location.floorId === elementId
  return false
}

export type HistoryActionType = 
  | "created"
  | "status_changed"
  | "photo_added"
  | "assignee_changed"
  | "inspector_changed"
  | "due_date_changed"
  | "related_issue_added"

export interface HistoryEntry {
  id: string
  timestamp: string
  actionType: HistoryActionType
  actor: string
  details: {
    from?: string
    to?: string
    photoStage?: PhotoStage
    relatedIssueId?: string
    memo?: string
  }
}

export interface Photo {
  id: string
  url: string
  stage: PhotoStage
  addedAt: string
  addedBy: string
}

export interface RelatedIssue {
  id: string
  memo?: string
}

export interface Issue {
  id: string
  title: string
  category: IssueCategory
  assignee: string      // 担当（業者）
  inspector: string     // 確認者（監督）
  dueDate: string
  status: IssueStatus
  photos: Photo[]
  createdAt: string
  createdBy: string
  relatedIssues: RelatedIssue[]
  history: HistoryEntry[]
  /** @deprecated location を使用。後方互換のため残す */
  elementId?: string
  /** 位置情報（APS要素 / 2Dピン / 階層） */
  location?: IssueLocation
  /** 座標（ピン表示用 — SVG or BIM 座標系） */
  worldPos?: IssueWorldPos
}

export const STATUS_OPTIONS: IssueStatus[] = [
  "未着手",
  "対応中",
  "是正報告済",
  "確認待ち",
  "完了",
]

export const CATEGORY_OPTIONS: IssueCategory[] = ["通常", "安全"]

export const PHOTO_STAGE_OPTIONS: PhotoStage[] = ["是正前", "是正中", "是正後"]

// 担当（業者）
export const ASSIGNEE_OPTIONS = [
  "田中太郎",
  "鈴木一郎",
  "山田花子",
  "佐藤次郎",
  "高橋三郎",
]

// 確認者（監督）
export const INSPECTOR_OPTIONS = [
  "現場監督A",
  "現場監督B",
  "所長",
]

// よく使う指摘タイトルのプリセット
export const TITLE_PRESETS = [
  "手すり固定不良",
  "養生テープ剥がれ",
  "清掃不足",
  "傷・汚れ",
  "寸法不良",
  "配管接続不良",
  "塗装ムラ",
  "仕上げ不良",
]

// 期限のプリセット（日数）
export const DUE_DATE_PRESETS = [
  { label: "今日", days: 0 },
  { label: "明日", days: 1 },
  { label: "3日後", days: 3 },
  { label: "1週間", days: 7 },
]

export function getStatusColor(status: IssueStatus): string {
  switch (status) {
    case "未着手":
      return "bg-status-pending text-status-pending-foreground"
    case "対応中":
      return "bg-status-in-progress text-status-in-progress-foreground"
    case "是正報告済":
      return "bg-status-reported text-status-reported-foreground"
    case "確認待ち":
      return "bg-status-waiting text-status-waiting-foreground"
    case "完了":
      return "bg-status-complete text-status-complete-foreground"
    default:
      return "bg-muted text-muted-foreground"
  }
}

// ステータスに応じた次のアクションボタンの文言
export function getNextActionLabel(status: IssueStatus): { label: string; nextStatus: IssueStatus } | null {
  switch (status) {
    case "未着手":
      return { label: "着手する", nextStatus: "対応中" }
    case "対応中":
      return { label: "是正完了を報告", nextStatus: "是正報告済" }
    case "是正報告済":
      return { label: "確認して完了", nextStatus: "完了" }
    case "確認待ち":
      return { label: "確認して完了", nextStatus: "完了" }
    default:
      return null
  }
}

export function getDueDateStatus(dueDate: string): "overdue" | "today" | "tomorrow" | "normal" {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  
  const diffTime = due.getTime() - today.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  
  if (diffDays < 0) return "overdue"
  if (diffDays === 0) return "today"
  if (diffDays === 1) return "tomorrow"
  return "normal"
}

export function getHistoryActionLabel(actionType: HistoryActionType): string {
  switch (actionType) {
    case "created": return "起票"
    case "status_changed": return "ステータス変更"
    case "photo_added": return "写真追加"
    case "assignee_changed": return "担当者変更"
    case "inspector_changed": return "確認者変更"
    case "due_date_changed": return "期限変更"
    case "related_issue_added": return "関連指摘追加"
    default: return "更新"
  }
}

export function formatDateTime(isoString: string): string {
  const date = new Date(isoString)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hours = date.getHours().toString().padStart(2, "0")
  const minutes = date.getMinutes().toString().padStart(2, "0")
  return `${month}/${day} ${hours}:${minutes}`
}
