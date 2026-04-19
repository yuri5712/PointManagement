import type { Issue, Photo, HistoryEntry, RelatedIssue, APSLocation } from "./types"

const apsLoc = (elementId: string): APSLocation => ({ type: "aps", elementId })

// ─── 実APSモデル（sample_mep.rvt）のオブジェクトID ──────────
// ID_A: 構造系（手すり・安全柵など） → ISS-001, ISS-004  (2件)
// ID_B: 設備系（配管・電気・空調など）→ ISS-002, ISS-005, ISS-007 (3件)
// ID_C: 仕上げ系（床・ドアなど）    → ISS-003, ISS-006  (2件)
export const APS_ID_A = "135f118f-6d78-43a3-a9ec-260c6f0a10ae-02114a2c"
export const APS_ID_B = "b73caf82-eec6-4e70-afe9-dc7619e8ca6d-0215e121"
export const APS_ID_C = "f041fe24-3752-4e08-9e91-d07d1823de73-02201b0b"

// Get today's date and calculate relative dates
const today = new Date()
const formatDate = (date: Date) => date.toISOString().split("T")[0]

const yesterday = new Date(today)
yesterday.setDate(yesterday.getDate() - 1)

const twoDaysAgo = new Date(today)
twoDaysAgo.setDate(twoDaysAgo.getDate() - 2)

const tomorrow = new Date(today)
tomorrow.setDate(tomorrow.getDate() + 1)

const inTwoDays = new Date(today)
inTwoDays.setDate(inTwoDays.getDate() + 2)

const nextWeek = new Date(today)
nextWeek.setDate(nextWeek.getDate() + 7)

// Helper to create history entries
const createHistory = (
  id: string,
  timestamp: string,
  actionType: HistoryEntry["actionType"],
  actor: string,
  details: HistoryEntry["details"] = {}
): HistoryEntry => ({
  id,
  timestamp,
  actionType,
  actor,
  details,
})

export const MOCK_ISSUES: Issue[] = [
  // ─── APS_ID_A: 構造系（2件） ────────────────────────────
  {
    id: "ISS-001",
    title: "3F廊下の手すり固定不良",
    category: "安全",
    assignee: "田中太郎",
    inspector: "現場監督A",
    dueDate: formatDate(twoDaysAgo),   // 期限超過
    status: "未着手",
    elementId: APS_ID_A, location: apsLoc(APS_ID_A),
    photos: [
      {
        id: "photo-001",
        url: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop",
        stage: "是正前",
        addedAt: "2026-04-10T09:00:00",
        addedBy: "現場監督A",
      },
    ],
    createdAt: "2026-04-10T09:00:00",
    createdBy: "現場監督A",
    relatedIssues: [{ id: "ISS-004", memo: "同一オブジェクト・安全対策連携" }],
    history: [
      createHistory("h-001", "2026-04-10T09:00:00", "created", "現場監督A"),
      createHistory("h-002", "2026-04-10T09:05:00", "photo_added", "現場監督A", { photoStage: "是正前" }),
    ],
  },
  {
    id: "ISS-004",
    title: "安全柵の溶接部分亀裂",
    category: "安全",
    assignee: "佐藤次郎",
    inspector: "所長",
    dueDate: formatDate(tomorrow),     // 明日期限
    status: "確認待ち",
    elementId: APS_ID_A, location: apsLoc(APS_ID_A),
    photos: [
      {
        id: "photo-006",
        url: "https://images.unsplash.com/photo-1590856029826-c7a73142bbf1?w=400&h=300&fit=crop",
        stage: "是正前",
        addedAt: "2026-04-13T08:45:00",
        addedBy: "所長",
      },
      {
        id: "photo-007",
        url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop",
        stage: "是正後",
        addedAt: "2026-04-14T17:00:00",
        addedBy: "佐藤次郎",
      },
    ],
    createdAt: "2026-04-13T08:45:00",
    createdBy: "所長",
    relatedIssues: [{ id: "ISS-001", memo: "同一オブジェクト・連続点検" }],
    history: [
      createHistory("h-012", "2026-04-13T08:45:00", "created", "所長"),
      createHistory("h-013", "2026-04-13T08:50:00", "photo_added", "所長", { photoStage: "是正前" }),
      createHistory("h-014", "2026-04-13T10:00:00", "status_changed", "佐藤次郎", { from: "未着手", to: "対応中" }),
      createHistory("h-015", "2026-04-14T17:00:00", "photo_added", "佐藤次郎", { photoStage: "是正後" }),
      createHistory("h-016", "2026-04-14T17:05:00", "status_changed", "佐藤次郎", { from: "対応中", to: "是正報告済" }),
      createHistory("h-017", "2026-04-15T08:00:00", "status_changed", "所長", { from: "是正報告済", to: "確認待ち" }),
    ],
  },

  // ─── APS_ID_B: 設備系（3件） ────────────────────────────
  {
    id: "ISS-002",
    title: "配管接続部分の漏水",
    category: "通常",
    assignee: "鈴木一郎",
    inspector: "現場監督B",
    dueDate: formatDate(today),        // 今日期限
    status: "対応中",
    elementId: APS_ID_B, location: apsLoc(APS_ID_B),
    photos: [
      {
        id: "photo-002",
        url: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop",
        stage: "是正前",
        addedAt: "2026-04-11T10:30:00",
        addedBy: "現場監督B",
      },
      {
        id: "photo-003",
        url: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=300&fit=crop",
        stage: "是正中",
        addedAt: "2026-04-13T14:00:00",
        addedBy: "鈴木一郎",
      },
    ],
    createdAt: "2026-04-11T10:30:00",
    createdBy: "現場監督B",
    relatedIssues: [{ id: "ISS-005", memo: "同一オブジェクト・設備点検" }],
    history: [
      createHistory("h-003", "2026-04-11T10:30:00", "created", "現場監督B"),
      createHistory("h-004", "2026-04-11T10:35:00", "photo_added", "現場監督B", { photoStage: "是正前" }),
      createHistory("h-005", "2026-04-12T09:00:00", "status_changed", "鈴木一郎", { from: "未着手", to: "対応中" }),
      createHistory("h-006", "2026-04-13T14:00:00", "photo_added", "鈴木一郎", { photoStage: "是正中" }),
    ],
  },
  {
    id: "ISS-005",
    title: "電気配線の露出・絶縁不良",
    category: "安全",
    assignee: "高橋三郎",
    inspector: "現場監督A",
    dueDate: formatDate(yesterday),    // 昨日期限・超過
    status: "対応中",
    elementId: APS_ID_B, location: apsLoc(APS_ID_B),
    photos: [
      {
        id: "photo-008",
        url: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400&h=300&fit=crop",
        stage: "是正前",
        addedAt: "2026-04-09T16:20:00",
        addedBy: "現場監督A",
      },
    ],
    createdAt: "2026-04-09T16:20:00",
    createdBy: "現場監督A",
    relatedIssues: [{ id: "ISS-002", memo: "同一オブジェクト・設備点検" }],
    history: [
      createHistory("h-018", "2026-04-09T16:20:00", "created", "現場監督A"),
      createHistory("h-019", "2026-04-09T16:25:00", "photo_added", "現場監督A", { photoStage: "是正前" }),
      createHistory("h-020", "2026-04-10T09:00:00", "status_changed", "高橋三郎", { from: "未着手", to: "対応中" }),
    ],
  },
  {
    id: "ISS-007",
    title: "空調ダクト固定緩み",
    category: "通常",
    assignee: "鈴木一郎",
    inspector: "現場監督A",
    dueDate: formatDate(nextWeek),     // 来週期限
    status: "完了",
    elementId: APS_ID_B, location: apsLoc(APS_ID_B),
    photos: [
      {
        id: "photo-010",
        url: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=400&h=300&fit=crop",
        stage: "是正前",
        addedAt: "2026-04-08T09:30:00",
        addedBy: "現場監督A",
      },
      {
        id: "photo-011",
        url: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=400&h=300&fit=crop",
        stage: "是正後",
        addedAt: "2026-04-12T15:00:00",
        addedBy: "鈴木一郎",
      },
    ],
    createdAt: "2026-04-08T09:30:00",
    createdBy: "現場監督A",
    relatedIssues: [],
    history: [
      createHistory("h-023", "2026-04-08T09:30:00", "created", "現場監督A"),
      createHistory("h-024", "2026-04-08T09:35:00", "photo_added", "現場監督A", { photoStage: "是正前" }),
      createHistory("h-025", "2026-04-09T08:00:00", "status_changed", "鈴木一郎", { from: "未着手", to: "対応中" }),
      createHistory("h-026", "2026-04-12T15:00:00", "photo_added", "鈴木一郎", { photoStage: "是正後" }),
      createHistory("h-027", "2026-04-12T15:05:00", "status_changed", "鈴木一郎", { from: "対応中", to: "是正報告済" }),
      createHistory("h-028", "2026-04-13T10:00:00", "status_changed", "現場監督A", { from: "是正報告済", to: "完了" }),
    ],
  },

  // ─── APS_ID_C: 仕上げ系（2件） ────────────────────────────
  {
    id: "ISS-003",
    title: "エントランス床タイル破損",
    category: "通常",
    assignee: "山田花子",
    inspector: "現場監督A",
    dueDate: formatDate(today),        // 今日期限
    status: "是正報告済",
    elementId: APS_ID_C, location: apsLoc(APS_ID_C),
    photos: [
      {
        id: "photo-004",
        url: "https://images.unsplash.com/photo-1581094794329-c8112d1ca6a0?w=400&h=300&fit=crop",
        stage: "是正前",
        addedAt: "2026-04-12T14:00:00",
        addedBy: "現場監督A",
      },
      {
        id: "photo-005",
        url: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=300&fit=crop",
        stage: "是正後",
        addedAt: "2026-04-14T16:00:00",
        addedBy: "山田花子",
      },
    ],
    createdAt: "2026-04-12T14:00:00",
    createdBy: "現場監督A",
    relatedIssues: [{ id: "ISS-006", memo: "同一オブジェクト・仕上げ点検" }],
    history: [
      createHistory("h-007", "2026-04-12T14:00:00", "created", "現場監督A"),
      createHistory("h-008", "2026-04-12T14:05:00", "photo_added", "現場監督A", { photoStage: "是正前" }),
      createHistory("h-009", "2026-04-13T08:00:00", "status_changed", "山田花子", { from: "未着手", to: "対応中" }),
      createHistory("h-010", "2026-04-14T16:00:00", "photo_added", "山田花子", { photoStage: "是正後" }),
      createHistory("h-011", "2026-04-14T16:05:00", "status_changed", "山田花子", { from: "対応中", to: "是正報告済" }),
    ],
  },
  {
    id: "ISS-006",
    title: "会議室ドア建付け不良",
    category: "通常",
    assignee: "田中太郎",
    inspector: "現場監督B",
    dueDate: formatDate(inTwoDays),    // 2日後期限
    status: "未着手",
    elementId: APS_ID_C, location: apsLoc(APS_ID_C),
    photos: [
      {
        id: "photo-009",
        url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
        stage: "是正前",
        addedAt: "2026-04-14T11:00:00",
        addedBy: "現場監督B",
      },
    ],
    createdAt: "2026-04-14T11:00:00",
    createdBy: "現場監督B",
    relatedIssues: [{ id: "ISS-003", memo: "同一オブジェクト・仕上げ点検" }],
    history: [
      createHistory("h-021", "2026-04-14T11:00:00", "created", "現場監督B"),
      createHistory("h-022", "2026-04-14T11:05:00", "photo_added", "現場監督B", { photoStage: "是正前" }),
    ],
  },
]
