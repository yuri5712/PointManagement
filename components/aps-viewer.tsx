"use client"

import { useEffect, useRef, useState, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { MockFloorPlan } from "@/components/mock-floor-plan"
import { useViewerStore, FLOORS } from "@/lib/viewer-store"
import { useIssueStore } from "@/lib/issue-store"
import { getDueDateStatus } from "@/lib/types"
import { APS_TO_FLOOR_ELEMENT } from "@/lib/element-metadata"
import { cn } from "@/lib/utils"
import {
  Layers, Box, RotateCcw, AlertCircle, Info, MapPin, X,
  Pin, Tag, ChevronRight, User, Clock, AlertTriangle,
  LayoutDashboard,
} from "lucide-react"
import { StatusBadge } from "@/components/status-badge"
import type { Floor } from "@/lib/viewer-store"
import { getElementMetadata, CATEGORY_COLOR, FLOOR_ELEMENT_TO_APS_ID } from "@/lib/element-metadata"
import type { IssueStatus } from "@/lib/types"
import type { Issue } from "@/lib/types"
import { getFloorElementById, FLOOR_DATA } from "@/components/mock-floor-plan"

// ─── BIM ワールド座標型 ────────────────────────────────────
type WorldPos3D = { x: number; y: number; z: number }

// ─── THREE.js / APS Viewer 型宣言 ─────────────────────────

interface APSBox3 {
  /** AABB が空（フラグメントなし）かどうか */
  isEmpty(): boolean
  /** 他の Box3 とのユニオン（自身を変更して返す） */
  union(box: APSBox3): APSBox3
  /** 中心座標を target に書き込んで返す */
  getCenter(target: WorldPos3D): WorldPos3D
}

interface APSInstanceTree {
  /**
   * nodeId 配下のフラグメント ID を列挙する（同期）。
   * recursive=false で直接フラグメントのみ対象。
   */
  enumNodeFragments(
    nodeId: number,
    callback: (fragId: number) => void,
    recursive: boolean
  ): void
}

interface APSFragmentList {
  /** フラグメントのワールド AABB を box に書き込む */
  getWorldBounds(fragId: number, box: APSBox3): void
}

declare global {
  interface Window {
    /** APS Viewer SDK が読み込んだ THREE.js */
    THREE?: {
      Vector3: new (x?: number, y?: number, z?: number) => WorldPos3D
      Box3: new () => APSBox3
      /** RGBA カラー（setThemingColor 用）*/
      Vector4: new (x?: number, y?: number, z?: number, w?: number) => { x: number; y: number; z: number; w: number }
    }
    Autodesk?: {
      Viewing: {
        Initializer(options: APSInitOptions, callback: () => void): void
        GuiViewer3D: new (container: HTMLElement) => APSViewerInstance
        SELECTION_CHANGED_EVENT: string
        /** カメラ移動・ズームなどのビューポート変化イベント */
        CAMERA_CHANGE_EVENT: string
        Document: {
          load(
            urn: string,
            onSuccess: (doc: APSDocument) => void,
            onError: (code: number, msg: string) => void
          ): void
        }
      }
    }
  }
}

interface APSInitOptions { env: string; accessToken: string; api?: string }
interface APSDocument { getRoot(): { getDefaultGeometry(): APSDocNode } }
type APSDocNode = object

interface APSProperties {
  dbId: number
  name: string
  externalId?: string
  properties?: Array<{
    attributeName: string
    displayValue: string | number
    displayCategory?: string
  }>
}

interface APSViewerInstance {
  start(): void
  finish(): void
  loadDocumentNode(doc: APSDocument, node: APSDocNode): Promise<void>
  addEventListener(event: string, cb: (e: unknown) => void): void
  removeEventListener(event: string, cb: (e: unknown) => void): void
  getProperties(dbId: number, onSuccess: (r: APSProperties) => void): void
  /** dbIds の要素を選択状態にする（SELECTION_CHANGED_EVENT が発火） */
  select(dbIds: number[]): void
  setViewCube(face: string): void
  fitToView(dbIds?: number[], model?: unknown, immediate?: boolean): void
  getState(filter?: object): object
  restoreState(state: object, filter?: object, immediate?: boolean): boolean
  /** ワールド座標 → ビューアコンテナ内スクリーン座標（px） */
  worldToClient(point: WorldPos3D): { x: number; y: number } | null
  /**
   * 指定 dbId に色付きハイライトを適用（オレンジ推奨: Vector4(1,0.5,0,1)）。
   * recursive=true で子孫ノードにも適用可。
   */
  setThemingColor(
    dbId: number,
    color: { x: number; y: number; z: number; w: number },
    model?: unknown,
    recursive?: boolean
  ): void
  /** モデル全体のテーミングカラーをリセット */
  clearThemingColors(model?: unknown): void
  navigation: { setIsOrtho(ortho: boolean): void }
  model: {
    getInstanceTree(): APSInstanceTree
    getFragmentList(): APSFragmentList
    /**
     * モデル全体の externalId → dbId マッピングを非同期で取得。
     * モデルロード直後に呼び出してキャッシュを構築する。
     */
    getExternalIdMapping(
      onSuccess: (mapping: Record<string, number>) => void,
      onError?: (err: unknown) => void
    ): void
  }
  impl: { camera: unknown }
}

const SDK_CSS = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css"
const SDK_JS  = "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js"

// ─────────────────────────────────────────────────────────
// ヘルパー関数
// ─────────────────────────────────────────────────────────

/**
 * APS Viewer の dbId からワールド座標（AABB 中心）を取得する。
 *
 * 処理フロー:
 *   1. model.getInstanceTree() で InstanceTree を取得
 *   2. enumNodeFragments(dbId, cb, false) で各フラグメント ID を列挙（同期）
 *   3. model.getFragmentList().getWorldBounds(fragId, box) で AABB を取得
 *   4. 全フラグメントの AABB をユニオンして中心を返す
 *
 * @param viewer APS ViewerInstance（モデルロード済み）
 * @param dbId   Viewer 内部 ID（SELECTION_CHANGED_EVENT の dbIdArray[0]）
 * @returns ワールド座標 {x,y,z} または取得失敗時 null
 */
function getWorldPosition(viewer: APSViewerInstance, dbId: number): WorldPos3D | null {
  try {
    const THREE = window.THREE
    if (!THREE) return null

    const instanceTree = viewer.model.getInstanceTree()
    const fragList     = viewer.model.getFragmentList()
    const box          = new THREE.Box3()

    // enumNodeFragments は同期的にコールバックを呼ぶ
    instanceTree.enumNodeFragments(
      dbId,
      (fragId: number) => {
        const fragBox = new THREE.Box3()
        fragList.getWorldBounds(fragId, fragBox)
        box.union(fragBox)
      },
      false // recursive=false: 直接フラグメントのみ
    )

    if (box.isEmpty()) return null

    const center: WorldPos3D = { x: 0, y: 0, z: 0 }
    box.getCenter(center)
    return { x: center.x, y: center.y, z: center.z }
  } catch {
    return null
  }
}

/**
 * BIM ワールド座標 → ビューアコンテナ内スクリーン座標（px）。
 *
 * viewer.worldToClient は THREE.Vector3 を受け取り、ビューア DOM 要素基準の
 * ピクセル座標を返す。カメラ変化の度に再呼び出しが必要。
 *
 * @param viewer APS ViewerInstance
 * @param pos    BIM ワールド座標
 * @returns スクリーン座標 {x,y}（px）または変換失敗時 null
 */
function worldToScreen(
  viewer: APSViewerInstance,
  pos: WorldPos3D
): { x: number; y: number } | null {
  try {
    const sc = viewer.worldToClient(pos)
    if (!sc) return null
    return { x: sc.x, y: sc.y }
  } catch {
    return null
  }
}

// ─── ステータス別ピン色 ────────────────────────────────────
function getPinColor(status: IssueStatus): string {
  switch (status) {
    case "未着手":     return "#ef4444"
    case "対応中":     return "#f97316"
    case "是正報告済":  return "#3b82f6"
    case "確認待ち":   return "#8b5cf6"
    case "完了":      return "#22c55e"
    default:          return "#94a3b8"
  }
}

// ─────────────────────────────────────────────────────────
// RealAPSViewer
// ─────────────────────────────────────────────────────────
/**
 * 実 APS Viewer コンポーネント。ピンの BIM 座標追従を担う。
 *
 * ピン表示の仕組み:
 *   - 要素選択時: getWorldPosition(viewer, dbId) → worldPos を取得し
 *     bimPinsRef (objectId → WorldPos3D) に保存（初回のみ）
 *   - 既存 issues の worldPos (coordSystem:"bim") はモデルロード後に取り込む
 *   - CAMERA_CHANGE_EVENT + resize の度に worldToScreen で再投影 →
 *     screenPins state を更新 → React が DOM を再描画
 */
function RealAPSViewer({
  token,
  urn,
  viewMode,
  onElementClick,
  issues,
  onPinClick,
  highlightIssueId,
}: {
  token: string
  urn: string
  viewMode: "3D" | "2D"
  onElementClick: (
    id: string,
    info?: { name: string; category: string; worldPos?: WorldPos3D }
  ) => void
  issues: Issue[]
  onPinClick: (issueId: string) => void
  highlightIssueId: string | null
}) {
  const containerRef    = useRef<HTMLDivElement>(null)
  const viewerRef       = useRef<APSViewerInstance | null>(null)
  const onClickRef      = useRef(onElementClick)
  const viewerReadyRef  = useRef(false)
  const savedViewRef    = useRef<object | null>(null)
  /** ウィンドウ resize ハンドラ（cleanup 用） */
  const resizeHandlerRef = useRef<(() => void) | null>(null)

  /**
   * objectId → BIM ワールド座標。
   * 初回取得時のみ登録。以降は再計算しない。
   */
  const bimPinsRef = useRef<Map<string, WorldPos3D>>(new Map())

  /**
   * objectId (externalId) → dbId キャッシュ。
   * ・モデルロード後に getExternalIdMapping() で全件構築（一括）
   * ・SELECTION_CHANGED_EVENT でも都度追記（フォールバック）
   * select + fitToView の dbId 解決に使用する。
   */
  const dbIdCacheRef = useRef<Map<string, number>>(new Map())

  // 外部から select + fitToView を要求するワンショット命令
  const {
    pendingSelectObjectId, setPendingSelectObjectId,
    selectedElementId,
  } = useViewerStore()

  const [status,     setStatus]     = useState<"loading" | "ready" | "error">("loading")
  const [errorMsg,   setErrorMsg]   = useState("")
  /**
   * モデルロード完了フラグ（state）。
   * true になると issues → bimPinsRef 取り込み effect が動く。
   */
  const [modelReady, setModelReady] = useState(false)
  /**
   * 対象要素の Viewer 内特定状態。
   * - "unknown"  : 未確認（モデルロード前・pendingSelect 待ち）
   * - "found"    : dbId 解決済み → select + fitToView 実施済み
   * - "notfound" : dbId がキャッシュに存在しない
   */
  const [elementLocated, setElementLocated] = useState<"unknown" | "found" | "notfound">("unknown")

  /**
   * ビューア内スクリーン座標（px）。
   * CAMERA_CHANGE_EVENT / resize の度に再計算される。
   * objectId → { x, y }
   */
  const [screenPins, setScreenPins] = useState<Record<string, { x: number; y: number }>>({})

  // onElementClick の最新版を ref で保持（stale closure 回避）
  useEffect(() => { onClickRef.current = onElementClick }, [onElementClick])

  // ─── スクリーン座標再計算 ──────────────────────────────
  const updateScreenPins = useCallback(() => {
    const viewer = viewerRef.current
    if (!viewer) return
    const next: Record<string, { x: number; y: number }> = {}
    for (const [objectId, pos] of bimPinsRef.current) {
      const sc = worldToScreen(viewer, pos)
      if (sc) next[objectId] = sc
    }
    setScreenPins(next)
  }, [])

  // event handler に渡すため ref でラップ
  const updateScreenPinsRef = useRef(updateScreenPins)
  useEffect(() => { updateScreenPinsRef.current = updateScreenPins }, [updateScreenPins])

  // ─── issues の BIM worldPos → bimPinsRef に取り込む ────
  // モデルロード後 + issues 変化時（新規起票後）に実行。
  // bimPinsRef に未登録の objectId だけ追加（初回のみ保存）。
  useEffect(() => {
    if (!modelReady) return
    let changed = false
    for (const issue of issues) {
      if (
        issue.worldPos?.coordSystem === "bim" &&
        issue.elementId &&
        !bimPinsRef.current.has(issue.elementId)
      ) {
        const { x, y, z = 0 } = issue.worldPos
        bimPinsRef.current.set(issue.elementId, { x, y, z })
        changed = true
      }
    }
    if (changed) updateScreenPins()
  }, [issues, modelReady, updateScreenPins])

  // ─── pendingSelectObjectId 消費: select + fitToView ───────
  // modelReady かつ pendingSelectObjectId がセットされたとき実行。
  // キャッシュヒット時 → select + fitToView → elementLocated:"found"
  // キャッシュミス時  → elementLocated:"notfound"（ワンショットはクリアしない）
  useEffect(() => {
    if (!modelReady || !pendingSelectObjectId) return
    const viewer = viewerRef.current
    if (!viewer) return

    const dbId = dbIdCacheRef.current.get(pendingSelectObjectId)
    if (dbId !== undefined) {
      try { viewer.select([dbId]) }                       catch (e) { console.warn("[APS] select failed:", e) }
      try { viewer.fitToView([dbId], undefined, false) }  catch (e) { console.warn("[APS] fitToView failed:", e) }
      setElementLocated("found")
      // ワンショット消費
      setPendingSelectObjectId(null)
    } else {
      // キャッシュミス: pendingSelectObjectId は残したまま notfound を通知
      console.info("[APS] pendingSelect: dbId not in cache for", pendingSelectObjectId)
      setElementLocated("notfound")
      setPendingSelectObjectId(null)
    }
  }, [pendingSelectObjectId, modelReady, setPendingSelectObjectId])

  // ─── selectedElementId 変化 → setThemingColor でオレンジ強調 ──
  // modelReady 後、selectedElementId が変わるたびに:
  //   1. clearThemingColors() で前のハイライトを消す
  //   2. 新しい dbId が取れれば setThemingColor(dbId, orange) を適用
  useEffect(() => {
    if (!modelReady) return
    const viewer = viewerRef.current
    if (!viewer) return

    try { viewer.clearThemingColors() } catch { /* noop */ }

    if (selectedElementId) {
      const dbId = dbIdCacheRef.current.get(selectedElementId)
      if (dbId !== undefined && window.THREE?.Vector4) {
        try {
          const orange = new window.THREE.Vector4(1, 0.5, 0, 1)
          viewer.setThemingColor(dbId, orange, undefined, true)
        } catch (e) { console.warn("[APS] setThemingColor failed:", e) }
      }
    }
  }, [selectedElementId, modelReady])

  // ─── viewMode 切替（3D ↔ 2D）────────────────────────────
  useEffect(() => {
    if (!viewerReadyRef.current) return
    const viewer = viewerRef.current
    if (!viewer) return

    if (viewMode === "2D") {
      try { savedViewRef.current = viewer.getState({ viewport: true }) } catch { savedViewRef.current = null }
      try { viewer.navigation.setIsOrtho(true) }  catch (e) { console.warn("[APS] setIsOrtho(true):", e) }
      try { viewer.setViewCube("top") }            catch (e) { console.warn("[APS] setViewCube:", e) }
    } else {
      try { viewer.navigation.setIsOrtho(false) } catch (e) { console.warn("[APS] setIsOrtho(false):", e) }
      try {
        if (savedViewRef.current) {
          viewer.restoreState(savedViewRef.current, { viewport: true }, false)
          savedViewRef.current = null
        } else {
          viewer.fitToView()
        }
      } catch (e) {
        console.warn("[APS] restore failed:", e)
        try { viewer.fitToView() } catch { /* noop */ }
      }
    }
  }, [viewMode])

  // ─── SDK 初期化 ────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return
    let cancelled = false

    if (!document.querySelector("link[data-aps-css]")) {
      const link = document.createElement("link")
      link.rel = "stylesheet"; link.href = SDK_CSS
      link.setAttribute("data-aps-css", "1")
      document.head.appendChild(link)
    }

    const initViewer = () => {
      if (cancelled || !window.Autodesk || !containerRef.current) return
      window.Autodesk.Viewing.Initializer(
        { env: "AutodeskProduction", accessToken: token, api: "derivativeV2" },
        () => {
          if (cancelled || !containerRef.current) return
          const viewer = new window.Autodesk!.Viewing.GuiViewer3D(containerRef.current)
          viewer.start()
          viewerRef.current = viewer

          const urnFull = urn.startsWith("urn:") ? urn : `urn:${urn}`
          window.Autodesk!.Viewing.Document.load(
            urnFull,
            (doc) => {
              const viewable = doc.getRoot().getDefaultGeometry()
              viewer.loadDocumentNode(doc, viewable).then(() => {
                if (cancelled) return
                viewerReadyRef.current = true
                setStatus("ready")

                // ── externalId → dbId を一括取得してキャッシュ ──
                // getExternalIdMapping は非同期コールバック方式のため、
                // コールバック内で setModelReady(true) を呼ぶことで
                // "キャッシュ構築完了後" に pendingSelectObjectId effect が
                // 発火することを保証する（レースコンディション回避）。
                try {
                  viewer.model.getExternalIdMapping(
                    (mapping) => {
                      for (const [extId, dbId] of Object.entries(mapping)) {
                        dbIdCacheRef.current.set(extId, dbId)
                      }
                      console.info("[APS] externalId cache built:", dbIdCacheRef.current.size, "entries")
                      if (!cancelled) setModelReady(true)
                    },
                    (e) => {
                      console.warn("[APS] getExternalIdMapping failed:", e)
                      // マッピング失敗でも Viewer は使えるので ready にする
                      if (!cancelled) setModelReady(true)
                    }
                  )
                } catch (e) {
                  console.warn("[APS] getExternalIdMapping threw:", e)
                  setModelReady(true)
                }

                // ── カメラ変化 → ピン再投影 ──────────────────
                viewer.addEventListener(
                  window.Autodesk!.Viewing.CAMERA_CHANGE_EVENT,
                  () => updateScreenPinsRef.current()
                )

                // ── リサイズ → ピン再投影 ────────────────────
                const onResize = () => updateScreenPinsRef.current()
                resizeHandlerRef.current = onResize
                window.addEventListener("resize", onResize)
              })
            },
            (code, msg) => {
              if (!cancelled) { setStatus("error"); setErrorMsg(`(${code}: ${msg})`) }
            }
          )

          // ── 要素選択イベント ─────────────────────────────
          viewer.addEventListener(
            window.Autodesk!.Viewing.SELECTION_CHANGED_EVENT,
            (e) => {
              const ev = e as { dbIdArray: number[] }
              if (ev.dbIdArray.length === 0) {
                onClickRef.current("", undefined)
                return
              }
              const dbId = ev.dbIdArray[0]
              viewer.getProperties(dbId, (r) => {
                const category =
                  r.properties
                    ?.find(p =>
                      p.attributeName === "Category" ||
                      p.attributeName === "カテゴリ"
                    )
                    ?.displayValue?.toString() ?? "Unknown"

                const id = r.externalId ?? r.name ?? String(dbId)

                // ── dbId をキャッシュ（フォールバック: getExternalIdMapping 前の選択にも対応）──
                if (!dbIdCacheRef.current.has(id)) {
                  dbIdCacheRef.current.set(id, dbId)
                }

                // ── ワールド座標を取得して bimPinsRef に保存（初回のみ）──
                const worldPos = getWorldPosition(viewer, dbId)
                if (worldPos && !bimPinsRef.current.has(id)) {
                  bimPinsRef.current.set(id, worldPos)
                  updateScreenPinsRef.current()
                }

                onClickRef.current(id, {
                  name: r.name,
                  category,
                  worldPos: worldPos ?? undefined,
                })
              })
            }
          )
        }
      )
    }

    if (window.Autodesk) {
      initViewer()
    } else {
      const script = document.createElement("script")
      script.src = SDK_JS
      script.onload = initViewer
      script.onerror = () => {
        if (!cancelled) { setStatus("error"); setErrorMsg("SDK読込失敗") }
      }
      document.head.appendChild(script)
    }

    return () => {
      cancelled = true
      viewerReadyRef.current = false
      savedViewRef.current = null
      if (resizeHandlerRef.current) {
        window.removeEventListener("resize", resizeHandlerRef.current)
        resizeHandlerRef.current = null
      }
      if (viewerRef.current) { viewerRef.current.finish(); viewerRef.current = null }
    }
  }, [token, urn])

  // ─── ピングループ（objectId ごとに issues をまとめる）────
  // screenPins に座標がある objectId のみ表示対象。
  const bimPinGroups = useMemo(() => {
    const groups: Record<string, Issue[]> = {}
    for (const issue of issues) {
      if (!issue.elementId) continue
      if (!screenPins[issue.elementId]) continue
      groups[issue.elementId] ??= []
      groups[issue.elementId].push(issue)
    }
    return groups
  }, [issues, screenPins])

  return (
    <div className="relative w-full h-full">
      {status === "loading" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex items-center gap-2 text-muted-foreground animate-pulse">
            <RotateCcw className="w-5 h-5 animate-spin" />
            <span className="text-sm">APS Viewer 読み込み中…</span>
          </div>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
          <div className="flex flex-col items-center gap-2 text-destructive text-center px-4">
            <AlertCircle className="w-8 h-8" />
            <p className="font-medium text-sm">エラーが発生しました</p>
            <p className="text-xs text-muted-foreground">{errorMsg}</p>
          </div>
        </div>
      )}

      {/* 対象要素が特定できない場合の警告バナー */}
      {elementLocated === "notfound" && (
        <div className="absolute inset-x-0 top-2 flex justify-center z-[30] pointer-events-none">
          <div className="flex items-center gap-2 bg-amber-50 border border-amber-300 text-amber-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow-md">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            対象要素がViewerで特定できません
          </div>
        </div>
      )}

      {/* APS Viewer の canvas */}
      <div ref={containerRef} className="w-full h-full" />

      {/* ─── BIM ピンオーバーレイ ────────────────────────────
           worldToClient で取得したスクリーン座標（px）に絶対配置。
           CAMERA_CHANGE_EVENT / resize → updateScreenPins → screenPins 更新
           → React 再描画 → カメラに完全追従。
      ──────────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 pointer-events-none z-[25]"
        aria-label="指摘ピンオーバーレイ"
      >
        {Object.entries(bimPinGroups).flatMap(([objId, objIssues]) => {
          const sc = screenPins[objId]
          if (!sc) return []
          const total = objIssues.length

          return objIssues.map((issue, idx) => {
            const color = getPinColor(issue.status)
            const isHighlighted = issue.id === highlightIssueId
            // 複数ピンは sc.x を中心に横並び（22px 間隔）
            const pinLeft = sc.x + (idx - (total - 1) / 2) * 22

            return (
              <button
                key={issue.id}
                aria-label={`指摘ピン: ${issue.title}`}
                className="absolute pointer-events-auto focus:outline-none"
                style={{
                  left: pinLeft,
                  top:  sc.y,
                  transform: "translate(-50%, -50%)",
                }}
                onClick={() => onPinClick(issue.id)}
              >
                {isHighlighted && (
                  <span
                    className="absolute inset-0 rounded-full animate-ping"
                    style={{ backgroundColor: color, opacity: 0.4, margin: "-4px" }}
                  />
                )}
                <span
                  className="relative flex items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform hover:scale-125"
                  style={{
                    width:           isHighlighted ? 22 : 18,
                    height:          isHighlighted ? 22 : 18,
                    backgroundColor: color,
                    boxShadow:       isHighlighted ? `0 0 0 3px ${color}55` : undefined,
                  }}
                >
                  {total > 1 && (
                    <span className="text-white font-bold" style={{ fontSize: 9 }}>
                      {idx + 1}
                    </span>
                  )}
                </span>
              </button>
            )
          })
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────
// APSViewer（メインコンポーネント）
// ─────────────────────────────────────────────────────────

interface APSViewerProps { className?: string }

export function APSViewer({ className }: APSViewerProps) {
  const router = useRouter()
  const {
    selectedElementId, focusedIssueId, currentFloor,
    pinMode, pinLocation, viewMode,
    setSelectedElementId, setCurrentFloor, setPinMode, setPinLocation,
    setViewMode, setSelectedObject, setPendingSelectObjectId,
    selectedObject,
  } = useViewerStore()
  const { issues } = useIssueStore()

  const [activePinIssueId, setActivePinIssueId] = useState<string | null>(null)

  // ─── focusedIssueId → フロア移動 + Viewer 選択 ───────────
  // 指摘カードクリック / 詳細ページマウント時に発火。
  // ・Mock: currentFloor を切り替えて selectedElementId をセット
  // ・Real APS: pendingSelectObjectId 経由で select + fitToView をトリガー
  useEffect(() => {
    if (!focusedIssueId) return
    const issue = issues.find(i => i.id === focusedIssueId)
    if (!issue?.elementId) return

    // Mock 平面図: フロア切替 + ハイライト
    const mapping = APS_TO_FLOOR_ELEMENT[issue.elementId]
    if (mapping && FLOORS.includes(mapping.floorId as Floor)) {
      setCurrentFloor(mapping.floorId as Floor)
    }
    setSelectedElementId(issue.elementId)

    // Real APS Viewer: select + fitToView をトリガー
    setPendingSelectObjectId(issue.elementId)
  }, [focusedIssueId, issues, setCurrentFloor, setSelectedElementId, setPendingSelectObjectId])

  // ─── 実 APS Viewer クリックハンドラ ──────────────────────
  // worldPos が取れた場合は coordSystem:"bim" として selectedObject に格納。
  // これにより起票時に IssueWorldPos として保存され、次回起動時も再利用できる。
  const handleAPSElementClick = useCallback(
    (id: string, info?: { name: string; category: string; worldPos?: WorldPos3D }) => {
      setSelectedElementId(id || null)
      setSelectedObject(
        id && info
          ? {
              objectId: id,
              name:     info.name,
              category: info.category,
              worldPos: info.worldPos
                ? { ...info.worldPos, coordSystem: "bim" as const }
                : undefined,
            }
          : null
      )
      setActivePinIssueId(null)
    },
    [setSelectedElementId, setSelectedObject]
  )

  // ─── モック平面図クリックハンドラ ─────────────────────────
  const handleMockElementClick = useCallback(
    (id: string) => {
      const resolvedId = FLOOR_ELEMENT_TO_APS_ID[id] ?? id
      setSelectedElementId(resolvedId || null)
      setActivePinIssueId(null)

      const floorEl = getFloorElementById(id)
      if (floorEl) {
        const floorId =
          Object.entries(FLOOR_DATA).find(([, els]) => els.some(e => e.id === id))?.[0]
          ?? currentFloor
        setSelectedObject({
          objectId: resolvedId,
          name:     floorEl.label,
          category: "その他",
          worldPos: {
            x: floorEl.x + floorEl.w / 2,
            y: floorEl.y + floorEl.h / 2,
            floorId,
            coordSystem: "svg",
          },
        })
      } else {
        setSelectedObject(null)
      }
    },
    [setSelectedElementId, setSelectedObject, currentFloor]
  )

  const focusedElementId = focusedIssueId
    ? (issues.find(i => i.id === focusedIssueId)?.elementId ?? null)
    : null

  // APS objectId → モック平面図要素 ID に逆変換（MockFloorPlan 用）
  const mockSelectedId = selectedElementId
    ? (APS_TO_FLOOR_ELEMENT[selectedElementId]?.elementId ?? selectedElementId)
    : null
  const mockFocusedId = focusedElementId
    ? (APS_TO_FLOOR_ELEMENT[focusedElementId]?.elementId ?? focusedElementId)
    : null

  // APS token / urn 取得
  const [liveToken, setLiveToken] = useState<string | null>(null)
  const [liveUrn,   setLiveUrn]   = useState<string | null>(null)
  useEffect(() => {
    fetch("/api/aps-token")
      .then(r => r.json())
      .then((data: { access_token?: string; urn?: string | null }) => {
        if (data.access_token) setLiveToken(data.access_token)
        if (data.urn)          setLiveUrn(data.urn)
      })
      .catch(() => {})
  }, [])

  const useRealViewer = !!(liveToken && liveUrn)

  const activePinIssue = activePinIssueId
    ? issues.find(i => i.id === activePinIssueId)
    : null

  // ─── 選択中オブジェクト表示情報 ──────────────────────────
  const elementMeta = useMemo(() => {
    if (!selectedElementId) return null

    // selectedObject（モック / 実 APS）が最優先
    if (selectedObject) {
      return {
        name:     selectedObject.name,
        category: selectedObject.category,
        detail:   undefined as string | undefined,
        level:    selectedObject.worldPos?.floorId,
      }
    }

    // デモ用 APS ID マップ（3件のダミーデータ）
    const apsMeta = getElementMetadata(selectedElementId)
    if (apsMeta.name !== "不明な要素") return apsMeta

    // モック平面図要素: FLOOR_DATA からラベルとフロアを取得
    const floorEl = getFloorElementById(selectedElementId)
    if (floorEl) {
      const floorId = Object.entries(FLOOR_DATA).find(
        ([, els]) => els.some(e => e.id === selectedElementId)
      )?.[0]
      return {
        name:     floorEl.label,
        category: "その他" as const,
        detail:   undefined as string | undefined,
        level:    floorId,
      }
    }

    return apsMeta
  }, [selectedElementId, selectedObject])

  return (
    <div className={cn("flex flex-col h-full bg-background relative", className)}>

      {/* ─── ヘッダーバー ──────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-slate-50 shrink-0 min-h-[40px]">
        {useRealViewer
          ? <Box className="w-4 h-4 text-blue-500 shrink-0" />
          : <Layers className="w-4 h-4 text-slate-500 shrink-0" />
        }
        <span className="text-sm font-medium text-slate-700">
          {useRealViewer ? "APS Viewer (3Dモデル)" : "フロア平面図"}
        </span>
        {!useRealViewer && (
          <span className="hidden lg:flex items-center gap-1 text-[10px] text-slate-400 ml-1">
            <Info className="w-3 h-3" />
            APS 認証情報を設定すると実3Dビューアが起動します
          </span>
        )}

        <div className="ml-auto flex items-center gap-1.5">

          {/* 3D / 2D 切替ボタン（実 APS Viewer のみ） */}
          {useRealViewer && (
            <div className="flex items-center rounded-full border border-slate-200 overflow-hidden bg-white text-xs font-semibold">
              <button
                onClick={() => setViewMode("3D")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 transition-colors",
                  viewMode === "3D"
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                )}
                title="3D透視投影ビュー"
              >
                <Box className="w-3 h-3" />3D
              </button>
              <button
                onClick={() => setViewMode("2D")}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 transition-colors",
                  viewMode === "2D"
                    ? "bg-blue-600 text-white"
                    : "text-slate-500 hover:bg-slate-100"
                )}
                title="真上から平行投影ビュー"
              >
                <LayoutDashboard className="w-3 h-3" />2D
              </button>
            </div>
          )}

          {/* モック平面図用：ピン配置モードボタン */}
          {!useRealViewer && (
            <button
              onClick={() => setPinMode(!pinMode)}
              className={cn(
                "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium transition-colors border",
                pinMode
                  ? "bg-violet-600 text-white border-violet-600 hover:bg-violet-700"
                  : "bg-white text-slate-500 border-slate-300 hover:bg-slate-100"
              )}
            >
              <Pin className="w-3 h-3" />
              {pinMode ? "配置中…" : "ピン"}
            </button>
          )}

          {selectedElementId && (
            <button
              onClick={() => {
                setSelectedElementId(null)
                setSelectedObject(null)
                setActivePinIssueId(null)
              }}
              className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors rounded"
              title="選択解除"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ─── 選択中オブジェクト情報パネル ─────────────────── */}
      {selectedElementId && elementMeta && (
        <div className="flex items-start gap-3 px-3 py-2 border-b bg-blue-50/70 shrink-0">
          <div className="p-1.5 bg-blue-100 rounded-lg shrink-0 mt-0.5">
            <Tag className="w-3.5 h-3.5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-slate-800">
                {elementMeta.name}
              </span>
              <span className={cn(
                "text-[10px] font-bold px-1.5 py-0.5 rounded border",
                CATEGORY_COLOR[elementMeta.category as keyof typeof CATEGORY_COLOR]
                  ?? "bg-slate-100 text-slate-600 border-slate-200"
              )}>
                {elementMeta.category}
              </span>
            </div>
            {"detail" in elementMeta && (elementMeta.detail || elementMeta.level) && (
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                {elementMeta.detail && (
                  <span className="text-[11px] text-slate-500">{elementMeta.detail}</span>
                )}
                {elementMeta.level && (
                  <span className="text-[11px] text-slate-400">／ {elementMeta.level}</span>
                )}
              </div>
            )}
            <p className="text-[10px] font-mono text-blue-400 mt-0.5 truncate" title={selectedElementId}>
              ID: {selectedElementId}
            </p>
            {useRealViewer && selectedObject?.worldPos?.coordSystem === "bim" && (
              <p className="text-[10px] text-blue-300 mt-0.5">
                BIM座標: ({selectedObject.worldPos.x.toFixed(2)},
                {" "}{selectedObject.worldPos.y.toFixed(2)},
                {" "}{selectedObject.worldPos.z?.toFixed(2) ?? "—"})
              </p>
            )}
          </div>
          <MapPin className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-1" />
        </div>
      )}

      {!selectedElementId && useRealViewer && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b bg-slate-50/50 shrink-0">
          <Info className="w-3 h-3 text-slate-300 shrink-0" />
          <span className="text-[11px] text-slate-400">
            3Dモデルの要素をクリックすると名前・カテゴリが表示されます
          </span>
        </div>
      )}

      {/* ─── Viewer 本体 ──────────────────────────────────── */}
      <div className="flex-1 min-h-0 relative">
        {useRealViewer && liveToken && liveUrn ? (
          // RealAPSViewer がピンオーバーレイも内包する
          <RealAPSViewer
            token={liveToken}
            urn={liveUrn}
            viewMode={viewMode}
            onElementClick={handleAPSElementClick}
            issues={issues}
            onPinClick={(issueId) => {
              // ピンクリック → selectedObjectId を更新（一覧ハイライト同期）
              const pinIssue = issues.find(i => i.id === issueId)
              if (pinIssue?.elementId) {
                setSelectedElementId(pinIssue.elementId)
              }
              setActivePinIssueId(prev => prev === issueId ? null : issueId)
            }}
            highlightIssueId={activePinIssueId}
          />
        ) : (
          <MockFloorPlan
            issues={issues}
            selectedElementId={mockSelectedId}
            focusedElementId={mockFocusedId}
            currentFloor={currentFloor}
            onElementClick={handleMockElementClick}
            onFloorChange={floor => setCurrentFloor(floor as Floor)}
            pinMode={pinMode}
            pinLocation={pinLocation}
            onPinPlace={(x, y) => {
              setPinLocation({ floorId: currentFloor, x, y })
              setPinMode(false)
            }}
            onPinClick={(issueId) => {
              // ピンクリック → selectedObjectId を更新（一覧ハイライト同期）
              const pinIssue = issues.find(i => i.id === issueId)
              if (pinIssue?.elementId) {
                setSelectedElementId(pinIssue.elementId)
              }
              setActivePinIssueId(prev => prev === issueId ? null : issueId)
            }}
            highlightIssueId={activePinIssueId}
          />
        )}

        {/* ─── ピンポップオーバー（モック・実 APS 共通）──────── */}
        {activePinIssue && (
          <div className="absolute bottom-0 left-0 right-0 p-3 z-[30] pointer-events-none">
            <div
              className="bg-white/97 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-xl p-4 pointer-events-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <StatusBadge status={activePinIssue.status} size="sm" />
                    {activePinIssue.category === "安全" && (
                      <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded">
                        安全
                      </span>
                    )}
                    <span className="text-xs text-muted-foreground font-mono ml-auto">
                      {activePinIssue.id}
                    </span>
                  </div>
                  <p className="font-bold text-base text-foreground leading-tight mb-2">
                    {activePinIssue.title}
                  </p>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />{activePinIssue.assignee}
                    </span>
                    <span className={cn(
                      "flex items-center gap-1",
                      getDueDateStatus(activePinIssue.dueDate) === "overdue" &&
                        "text-destructive font-semibold"
                    )}>
                      {getDueDateStatus(activePinIssue.dueDate) === "overdue"
                        ? <AlertTriangle className="w-3.5 h-3.5" />
                        : <Clock className="w-3.5 h-3.5" />
                      }
                      {activePinIssue.dueDate}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setActivePinIssueId(null)}
                  className="p-1 text-slate-400 hover:text-slate-700 shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => router.push(`/issues/${activePinIssue.id}`)}
                className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-colors"
              >
                詳細を見る
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
