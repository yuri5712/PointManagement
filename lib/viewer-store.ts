"use client"

import { create } from "zustand"
import type { IssueWorldPos } from "./types"

export const FLOORS = ["B1F", "1F", "2F", "3F", "4F", "屋上"] as const
export type Floor = (typeof FLOORS)[number]

/** 2Dピンの位置（SVG viewBox 座標系: 0 0 500 360） */
export interface ViewerPinLocation {
  floorId: Floor
  x: number
  y: number
}

/**
 * ビューアで選択した要素の完全な情報。
 * モック平面図・実APS Viewer 両方で使用。
 */
export interface SelectedObject {
  /** APS externalId または モック平面図要素ID */
  objectId: string
  /** 表示名（BIM Element Name / 平面図ラベル） */
  name: string
  /** カテゴリ（BIM Category / "その他"） */
  category: string
  /** 座標（ピン描画用 — SVG or BIM 座標系）*/
  worldPos?: IssueWorldPos
}

/** @deprecated SelectedObject を使用 */
export type SelectedObjectInfo = Pick<SelectedObject, "name" | "category">

interface ViewerStore {
  /** 平面図/3Dビューアで選択されている要素のID */
  selectedElementId: string | null
  /** 指摘リストでフォーカスされている指摘のID（ビューアで位置ハイライト用） */
  focusedIssueId: string | null
  /** モック平面図で表示中のフロア */
  currentFloor: Floor
  /** 2Dピンモードが有効か */
  pinMode: boolean
  /** 配置された2Dピンの位置 */
  pinLocation: ViewerPinLocation | null
  /**
   * 3D / 2D ビューモード（実APS Viewer用）
   * 2D = 真上からの平行投影ビュー
   */
  viewMode: "3D" | "2D"
  /** 選択中オブジェクトの完全な情報（名前・カテゴリ・座標） */
  selectedObject: SelectedObject | null
  /**
   * 実 APS Viewer に「この objectId を select + fitToView せよ」と伝える
   * ワンショット命令。Viewer が消費したら null に戻す。
   * - 指摘カードクリック / 詳細ページマウント時にセット
   * - RealAPSViewer が dbId に解決して viewer.select + fitToView を実行後クリア
   */
  pendingSelectObjectId: string | null

  setSelectedElementId: (id: string | null) => void
  setFocusedIssueId: (id: string | null) => void
  setCurrentFloor: (floor: Floor) => void
  setPinMode: (enabled: boolean) => void
  setPinLocation: (pin: ViewerPinLocation | null) => void
  setViewMode: (mode: "3D" | "2D") => void
  setSelectedObject: (obj: SelectedObject | null) => void
  setPendingSelectObjectId: (id: string | null) => void
  /** @deprecated setSelectedObject を使用 */
  setSelectedObjectInfo: (info: SelectedObjectInfo | null) => void
}

export const useViewerStore = create<ViewerStore>((set) => ({
  selectedElementId: null,
  focusedIssueId: null,
  currentFloor: "1F",
  pinMode: false,
  pinLocation: null,
  viewMode: "3D",
  selectedObject: null,
  pendingSelectObjectId: null,

  setSelectedElementId: (id) => set({ selectedElementId: id }),
  setFocusedIssueId: (id) => set({ focusedIssueId: id }),
  setCurrentFloor: (floor) => set({ currentFloor: floor }),
  setPinMode: (enabled) => set({ pinMode: enabled, pinLocation: enabled ? null : undefined }),
  setPinLocation: (pin) => set({ pinLocation: pin }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSelectedObject: (obj) => set({ selectedObject: obj }),
  setPendingSelectObjectId: (id) => set({ pendingSelectObjectId: id }),
  // compat shim: selectedObjectInfo → selectedObject（名前とカテゴリのみ更新）
  setSelectedObjectInfo: (info) => set((state) => ({
    selectedObject: info && state.selectedElementId
      ? {
          objectId: state.selectedElementId,
          name: info.name,
          category: info.category,
        }
      : null,
  })),
}))
