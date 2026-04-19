"use client"

import { useMemo } from "react"
import { getDueDateStatus, type IssueStatus } from "@/lib/types"
import type { Issue } from "@/lib/types"
import type { ViewerPinLocation } from "@/lib/viewer-store"
import { APS_TO_FLOOR_ELEMENT } from "@/lib/element-metadata"

// ─── 型定義 ────────────────────────────────────────────

interface FloorElement {
  id: string
  label: string
  x: number
  y: number
  w: number
  h: number
}

// ─── フロア別 要素データ（SVG viewBox: 0 0 500 360）────────

export const FLOOR_DATA: Record<string, FloorElement[]> = {
  "B1F": [
    { id: "b1f-elec",     label: "電気配線室",  x: 10,  y: 10,  w: 152, h: 120 },
    { id: "b1f-mech",     label: "機械室",       x: 162, y: 10,  w: 152, h: 120 },
    { id: "b1f-storage",  label: "倉庫",         x: 314, y: 10,  w: 176, h: 120 },
    { id: "b1f-corridor", label: "廊下",         x: 10,  y: 135, w: 480, h: 50  },
    { id: "b1f-parking",  label: "駐車場",       x: 10,  y: 190, w: 480, h: 160 },
  ],
  "1F": [
    { id: "1f-entrance",  label: "エントランス", x: 10,  y: 10,  w: 200, h: 140 },
    { id: "1f-office",    label: "管理室",       x: 210, y: 10,  w: 130, h: 140 },
    { id: "1f-stairs",    label: "階段",         x: 340, y: 10,  w: 75,  h: 65  },
    { id: "1f-elev",      label: "EV",           x: 415, y: 10,  w: 75,  h: 65  },
    { id: "1f-wc",        label: "トイレ",       x: 340, y: 75,  w: 150, h: 75  },
    { id: "1f-corridor",  label: "廊下",         x: 10,  y: 150, w: 480, h: 50  },
    { id: "1f-utility",   label: "設備室",       x: 10,  y: 205, w: 230, h: 145 },
    { id: "1f-lobby",     label: "ロビー",       x: 240, y: 205, w: 250, h: 145 },
  ],
  "2F": [
    { id: "2f-meetingA",  label: "会議室A",      x: 10,  y: 10,  w: 155, h: 130 },
    { id: "2f-pipe",      label: "配管スペース", x: 165, y: 10,  w: 155, h: 130 },
    { id: "2f-duct",      label: "空調ダクト",   x: 320, y: 10,  w: 170, h: 130 },
    { id: "2f-corridor",  label: "廊下",         x: 10,  y: 145, w: 480, h: 50  },
    { id: "2f-officeA",   label: "オフィスA",    x: 10,  y: 200, w: 250, h: 150 },
    { id: "2f-lounge",    label: "休憩室",       x: 260, y: 200, w: 230, h: 150 },
  ],
  "3F": [
    { id: "3f-officeB",   label: "オフィスB",    x: 10,  y: 10,  w: 195, h: 130 },
    { id: "3f-lounge",    label: "休憩室",       x: 205, y: 10,  w: 285, h: 130 },
    { id: "3f-corridor",  label: "廊下（手すり）", x: 10, y: 145, w: 480, h: 50 },
    { id: "3f-conference",label: "会議室B",      x: 10,  y: 200, w: 195, h: 150 },
    { id: "3f-storage",   label: "収納室",       x: 205, y: 200, w: 285, h: 150 },
  ],
  "4F": [
    { id: "4f-meeting",   label: "会議室",       x: 10,  y: 10,  w: 265, h: 150 },
    { id: "4f-server",    label: "サーバー室",   x: 275, y: 10,  w: 215, h: 150 },
    { id: "4f-corridor",  label: "廊下",         x: 10,  y: 165, w: 480, h: 50  },
    { id: "4f-archive",   label: "書類保管室",   x: 10,  y: 220, w: 210, h: 130 },
    { id: "4f-wc",        label: "トイレ",       x: 220, y: 220, w: 270, h: 130 },
  ],
  "屋上": [
    { id: "roof-waterproof", label: "防水シートエリア", x: 10,  y: 10,  w: 320, h: 230 },
    { id: "roof-equipment",  label: "設備機器",         x: 330, y: 10,  w: 160, h: 110 },
    { id: "roof-stairs",     label: "階段出入口",       x: 330, y: 120, w: 160, h: 120 },
    { id: "roof-access",     label: "屋上通路",         x: 10,  y: 245, w: 480, h: 105 },
  ],
}

/** フロア一覧（表示順） */
export const FLOOR_LIST = Object.keys(FLOOR_DATA)

/** 要素ID → フロア のマッピング */
export const ELEMENT_FLOOR_MAP: Record<string, string> = Object.fromEntries(
  Object.entries(FLOOR_DATA).flatMap(([floor, elements]) =>
    elements.map((el) => [el.id, floor])
  )
)

/**
 * 要素IDに対応する FloorElement を全フロアから検索して返す。
 * 未登録IDの場合は undefined。
 * APSViewer で「モック平面図の要素名」を表示するために使う。
 */
export function getFloorElementById(elementId: string): FloorElement | undefined {
  for (const elements of Object.values(FLOOR_DATA)) {
    const found = elements.find(e => e.id === elementId)
    if (found) return found
  }
  return undefined
}

// ─── ヘルパー関数 ────────────────────────────────────

interface ElementStyle {
  fill: string
  stroke: string
  strokeWidth: number
  activeCount: number
}

function getElementStyle(
  elementId: string,
  issues: Issue[],
  selectedId: string | null,
  focusedElementId: string | null
): ElementStyle {
  const linked = issues.filter((i) => i.elementId === elementId)
  const active = linked.filter((i) => i.status !== "完了")

  let fill = "#f1f5f9"
  let stroke = "#cbd5e1"
  let strokeWidth = 1.5

  if (active.length > 0) {
    const hasOverdue = active.some((i) => getDueDateStatus(i.dueDate) === "overdue")
    const hasSafety = active.some((i) => i.category === "安全")
    const hasToday = active.some((i) => getDueDateStatus(i.dueDate) === "today")

    if (hasOverdue && hasSafety) {
      fill = "#fef2f2"; stroke = "#ef4444"
    } else if (hasOverdue) {
      fill = "#fff7ed"; stroke = "#f97316"
    } else if (hasSafety) {
      fill = "#fff7ed"; stroke = "#fb923c"
    } else if (hasToday) {
      fill = "#fffbeb"; stroke = "#f59e0b"
    } else {
      fill = "#eff6ff"; stroke = "#93c5fd"
    }
  } else if (linked.length > 0) {
    // 完了済みのみ
    fill = "#f0fdf4"; stroke = "#86efac"
  }

  // フォーカス中の指摘に紐付いた要素（紫）
  if (elementId === focusedElementId) {
    stroke = "#7c3aed"; strokeWidth = 3
  }
  // 選択中の要素（青）- focusedより優先
  if (elementId === selectedId) {
    stroke = "#2563eb"; strokeWidth = 3
  }

  return { fill, stroke, strokeWidth, activeCount: active.length }
}

/** イシューステータス → ピン色 */
function getPinColor(status: IssueStatus): string {
  switch (status) {
    case "未着手":    return "#ef4444"
    case "対応中":    return "#f97316"
    case "是正報告済": return "#3b82f6"
    case "確認待ち":  return "#8b5cf6"
    case "完了":     return "#22c55e"
    default:         return "#94a3b8"
  }
}

/** ラベルを最大文字数で2行に分割 */
function splitLabel(label: string, maxChars = 5): [string, string | null] {
  if (label.length <= maxChars) return [label, null]
  const mid = Math.ceil(label.length / 2)
  return [label.slice(0, mid), label.slice(mid)]
}

/** 要素サイズに応じたフォントサイズ */
function fontSize(w: number, h: number): number {
  const base = Math.min(w / 8, h / 4, 13)
  return Math.max(base, 9)
}

// ─── コンポーネント ──────────────────────────────────

interface MockFloorPlanProps {
  issues: Issue[]
  selectedElementId: string | null
  focusedElementId: string | null
  currentFloor: string
  onElementClick: (elementId: string) => void
  onFloorChange: (floor: string) => void
  /** 2Dピン配置モード（trueの場合クリックで座標を返す） */
  pinMode?: boolean
  /** 配置済みの2Dピン位置 */
  pinLocation?: ViewerPinLocation | null
  /** ピン配置コールバック（SVG座標系） */
  onPinPlace?: (x: number, y: number) => void
  /** イシューピンクリック時のコールバック */
  onPinClick?: (issueId: string) => void
  /** ハイライト表示するイシューID（ビューアで選択中） */
  highlightIssueId?: string | null
}

export function MockFloorPlan({
  issues,
  selectedElementId,
  focusedElementId,
  currentFloor,
  onElementClick,
  onFloorChange,
  pinMode = false,
  pinLocation = null,
  onPinPlace,
  onPinClick,
  highlightIssueId,
}: MockFloorPlanProps) {
  const currentElements = FLOOR_DATA[currentFloor] ?? []

  // このフロアに指摘が何件あるか（フロアタブのバッジ用）
  const floorIssueCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    FLOOR_LIST.forEach((floor) => {
      const elementIds = (FLOOR_DATA[floor] ?? []).map((e) => e.id)
      counts[floor] = issues.filter((i) => {
        if (i.status === "完了") return false
        // worldPos（SVG座標系）があればフロアIDで判定
        if (i.worldPos?.coordSystem === "svg") return i.worldPos.floorId === floor
        // レガシー: 平面図要素IDで判定
        return !!(i.elementId && elementIds.includes(i.elementId))
      }).length
    })
    return counts
  }, [issues])

  return (
    <div className="flex flex-col h-full select-none">
      {/* フロアセレクター */}
      <div className="flex items-center gap-1 px-2 py-1.5 border-b bg-slate-50 flex-wrap shrink-0">
        {FLOOR_LIST.map((floor) => {
          const count = floorIssueCounts[floor] ?? 0
          const isActive = floor === currentFloor
          return (
            <button
              key={floor}
              onClick={() => onFloorChange(floor)}
              className={`relative px-2.5 py-1 text-xs font-medium rounded transition-colors ${
                isActive
                  ? "bg-slate-700 text-white"
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
              }`}
            >
              {floor}
              {count > 0 && (
                <span
                  className={`absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 text-[9px] font-bold rounded-full ${
                    isActive ? "bg-red-500 text-white" : "bg-red-400 text-white"
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
        <span className={`ml-auto text-[10px] hidden sm:block ${pinMode ? "text-violet-600 font-semibold animate-pulse" : "text-slate-400"}`}>
          {pinMode ? "📍 クリックして位置を指定" : `${currentFloor} 平面図（クリックで要素を選択）`}
        </span>
      </div>

      {/* SVG 平面図 */}
      <div className={`flex-1 min-h-0 overflow-hidden p-1${pinMode ? " cursor-crosshair" : ""}`}>
        <svg
          viewBox="0 0 500 360"
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
          onClick={pinMode && onPinPlace ? (e) => {
            const svgEl = e.currentTarget
            const rect = svgEl.getBoundingClientRect()
            const x = ((e.clientX - rect.left) / rect.width)  * 500
            const y = ((e.clientY - rect.top)  / rect.height) * 360
            onPinPlace(x, y)
          } : undefined}
        >
          {/* 建物外周 */}
          <rect
            x="3" y="3" width="494" height="354"
            fill="#f8fafc" stroke="#94a3b8" strokeWidth="2" rx="6"
          />

          {/* 各要素 */}
          {currentElements.map((el) => {
            const style = getElementStyle(el.id, issues, selectedElementId, focusedElementId)
            const cx = el.x + el.w / 2
            const cy = el.y + el.h / 2
            const fs = fontSize(el.w, el.h)
            const [line1, line2] = splitLabel(el.label, 6)
            const isSelected = el.id === selectedElementId
            const isFocused = el.id === focusedElementId

            return (
              <g
                key={el.id}
                onClick={pinMode ? undefined : (e) => { e.stopPropagation(); onElementClick(el.id) }}
                className={pinMode ? undefined : "cursor-pointer"}
                role={pinMode ? undefined : "button"}
                aria-label={el.label}
              >
                {/* 選択時のグロー */}
                {(isSelected || isFocused) && (
                  <rect
                    x={el.x - 3} y={el.y - 3}
                    width={el.w + 6} height={el.h + 6}
                    fill="none"
                    stroke={isSelected ? "#2563eb" : "#7c3aed"}
                    strokeWidth="2"
                    strokeDasharray="4 2"
                    rx="2"
                    opacity={0.6}
                  />
                )}

                {/* 部屋の矩形 */}
                <rect
                  x={el.x} y={el.y}
                  width={el.w} height={el.h}
                  fill={style.fill}
                  stroke={style.stroke}
                  strokeWidth={style.strokeWidth}
                  rx="2"
                />

                {/* ホバー用オーバーレイ（透明） */}
                <rect
                  x={el.x} y={el.y}
                  width={el.w} height={el.h}
                  fill="transparent"
                  className="hover:fill-black/5 transition-colors"
                  rx="2"
                />

                {/* ラベルテキスト */}
                <text
                  x={cx} y={line2 ? cy - fs * 0.6 : cy}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={fs}
                  fontFamily="system-ui, sans-serif"
                  fill="#334155"
                  fontWeight={isSelected || isFocused ? "700" : "500"}
                  pointerEvents="none"
                >
                  {line1}
                </text>
                {line2 && (
                  <text
                    x={cx} y={cy + fs * 0.7}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={fs}
                    fontFamily="system-ui, sans-serif"
                    fill="#334155"
                    fontWeight={isSelected || isFocused ? "700" : "500"}
                    pointerEvents="none"
                  >
                    {line2}
                  </text>
                )}

                {/* 指摘件数バッジ */}
                {style.activeCount > 0 && (
                  <g pointerEvents="none">
                    <circle
                      cx={el.x + el.w - 11}
                      cy={el.y + 11}
                      r={10}
                      fill={
                        style.stroke === "#ef4444" ? "#ef4444" :
                        style.stroke === "#f97316" || style.stroke === "#fb923c" ? "#f97316" :
                        style.stroke === "#f59e0b" ? "#f59e0b" :
                        "#3b82f6"
                      }
                    />
                    <text
                      x={el.x + el.w - 11}
                      y={el.y + 11}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={9}
                      fontFamily="system-ui, sans-serif"
                      fill="white"
                      fontWeight="bold"
                    >
                      {style.activeCount}
                    </text>
                  </g>
                )}

                {/* 完了済みのみの場合はチェックマーク */}
                {style.activeCount === 0 &&
                  issues.some((i) => i.elementId === el.id) && (
                  <g pointerEvents="none">
                    <circle
                      cx={el.x + el.w - 11} cy={el.y + 11}
                      r={9} fill="#22c55e"
                    />
                    <text
                      x={el.x + el.w - 11} y={el.y + 11}
                      textAnchor="middle" dominantBaseline="middle"
                      fontSize={10} fill="white" fontWeight="bold"
                    >
                      ✓
                    </text>
                  </g>
                )}
              </g>
            )
          })}

          {/* ─── 2Dピンマーカー ─────────────────────────── */}
          {pinLocation && pinLocation.floorId === currentFloor && (
            <g pointerEvents="none">
              {/* ピンの影 */}
              <ellipse
                cx={pinLocation.x}
                cy={pinLocation.y + 2}
                rx={6} ry={3}
                fill="rgba(0,0,0,0.2)"
              />
              {/* ピン本体（ドロップ形状） */}
              <path
                d={`M${pinLocation.x},${pinLocation.y}
                    C${pinLocation.x + 9},${pinLocation.y - 9}
                     ${pinLocation.x + 9},${pinLocation.y - 22}
                     ${pinLocation.x},${pinLocation.y - 22}
                    C${pinLocation.x - 9},${pinLocation.y - 22}
                     ${pinLocation.x - 9},${pinLocation.y - 9}
                     ${pinLocation.x},${pinLocation.y}Z`}
                fill="#8b5cf6"
                stroke="white"
                strokeWidth={1.5}
              />
              {/* ピン中心の白丸 */}
              <circle
                cx={pinLocation.x}
                cy={pinLocation.y - 15}
                r={4}
                fill="white"
              />
            </g>
          )}

          {/* ─── ピンモード クロスヘアヒント ──────────────── */}
          {pinMode && (
            <text
              x={250} y={340}
              textAnchor="middle"
              fontSize={11}
              fontFamily="system-ui, sans-serif"
              fill="#7c3aed"
              fontWeight="600"
            >
              クリックして位置を指定
            </text>
          )}

          {/* ─── イシューピンレイヤー ─────────────────────
               起票済み指摘を対応する位置にピンとして表示。
               ① worldPos（SVG座標）がある → 正確な要素中心に表示
               ② レガシー（elementId のみ） → APS_TO_FLOOR_ELEMENT で要素中心を算出
          ────────────────────────────────────────────── */}
          {(() => {
            // ① worldPos ベースのピン（新規起票分）
            const worldPosPins = issues.filter(
              (i) => i.worldPos?.coordSystem === "svg" && i.worldPos.floorId === currentFloor
            )

            // ② レガシーピン（worldPos なし + elementId で APS_TO_FLOOR_ELEMENT に登録済み）
            const legacyPinGroups: Record<string, Issue[]> = {}
            for (const issue of issues) {
              if (issue.worldPos) continue   // worldPos があれば ① 側で描画
              if (!issue.elementId) continue
              const mapping = APS_TO_FLOOR_ELEMENT[issue.elementId]
              if (!mapping || mapping.floorId !== currentFloor) continue
              const el = currentElements.find(e => e.id === mapping.elementId)
              if (!el) continue
              if (!legacyPinGroups[mapping.elementId]) legacyPinGroups[mapping.elementId] = []
              legacyPinGroups[mapping.elementId].push(issue)
            }

            // ① worldPos ピンをグループ化（同一座標は横並び）
            const worldPosGroups: Record<string, Issue[]> = {}
            for (const issue of worldPosPins) {
              const wp = issue.worldPos!
              const key = `${Math.round(wp.x)}_${Math.round(wp.y)}`
              if (!worldPosGroups[key]) worldPosGroups[key] = []
              worldPosGroups[key].push(issue)
            }

            const worldPosNodes = Object.entries(worldPosGroups).flatMap(([, grpIssues]) => {
              const wp = grpIssues[0].worldPos!
              const cx = wp.x
              const cy = wp.y
              const total = grpIssues.length
              const spacing = Math.min(18, 40 / Math.max(total, 1))
              const totalWidth = (total - 1) * spacing
              const baseX = cx - totalWidth / 2

              return grpIssues.map((issue, idx) => {
                const pinX = baseX + idx * spacing
                const color = getPinColor(issue.status)
                const isHighlighted = issue.id === highlightIssueId
                return (
                  <g
                    key={`issue-pin-${issue.id}`}
                    onClick={(e) => { e.stopPropagation(); onPinClick?.(issue.id) }}
                    className="cursor-pointer"
                    style={{ pointerEvents: "all" }}
                  >
                    {isHighlighted && (
                      <circle cx={pinX} cy={cy} r={11} fill={color} opacity={0.3} />
                    )}
                    <circle
                      cx={pinX} cy={cy} r={7}
                      fill={color} stroke="white"
                      strokeWidth={isHighlighted ? 2 : 1.5}
                    />
                    {total > 1 && (
                      <text x={pinX} y={cy} textAnchor="middle" dominantBaseline="middle"
                        fontSize={6} fill="white" fontWeight="bold" pointerEvents="none">
                        {idx + 1}
                      </text>
                    )}
                  </g>
                )
              })
            })

            // ② レガシーピン（要素中心を使用）
            const legacyNodes = Object.entries(legacyPinGroups).flatMap(([elId, elIssues]) => {
              const el = currentElements.find(e => e.id === elId)
              if (!el) return []
              const total = elIssues.length
              const spacing = Math.min(18, (el.w - 16) / Math.max(total, 1))
              const totalWidth = (total - 1) * spacing
              const baseX = el.x + el.w / 2 - totalWidth / 2
              const pinY = el.y + el.h / 2   // 要素の中心 Y

              return elIssues.map((issue, idx) => {
                const pinX = baseX + idx * spacing
                const color = getPinColor(issue.status)
                const isHighlighted = issue.id === highlightIssueId
                return (
                  <g
                    key={`issue-pin-${issue.id}`}
                    onClick={(e) => { e.stopPropagation(); onPinClick?.(issue.id) }}
                    className="cursor-pointer"
                    style={{ pointerEvents: "all" }}
                  >
                    {isHighlighted && (
                      <circle cx={pinX} cy={pinY} r={11} fill={color} opacity={0.3} />
                    )}
                    <circle
                      cx={pinX} cy={pinY} r={7}
                      fill={color} stroke="white"
                      strokeWidth={isHighlighted ? 2 : 1.5}
                    />
                    {total > 1 && (
                      <text x={pinX} y={pinY} textAnchor="middle" dominantBaseline="middle"
                        fontSize={6} fill="white" fontWeight="bold" pointerEvents="none">
                        {idx + 1}
                      </text>
                    )}
                  </g>
                )
              })
            })

            return [...worldPosNodes, ...legacyNodes]
          })()}
        </svg>
      </div>

      {/* 凡例 */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t bg-slate-50 text-[10px] text-slate-500 flex-wrap shrink-0">
        {[
          { color: "#ef4444", label: "安全・超過" },
          { color: "#f97316", label: "超過 or 安全" },
          { color: "#f59e0b", label: "今日期限" },
          { color: "#3b82f6", label: "指摘あり" },
          { color: "#22c55e", label: "完了済" },
          { color: "#cbd5e1", label: "なし" },
        ].map(({ color, label }) => (
          <span key={label} className="flex items-center gap-1">
            <span
              className="inline-block w-3 h-3 rounded-sm border border-black/10"
              style={{ backgroundColor: color }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
