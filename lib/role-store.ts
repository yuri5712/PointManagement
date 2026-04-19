"use client"

import { create } from "zustand"

export type UserRole = "監督" | "業者"

// デモ用の業者担当者名（実運用では認証情報から取得）
export const DEMO_CONTRACTOR = "田中太郎" // ISS-001, ISS-006 を担当

interface RoleStore {
  currentRole: UserRole
  /** 業者ロール時の担当者名（デモ用） */
  contractorName: string
  setRole: (role: UserRole) => void
  setContractorName: (name: string) => void
}

export const useRoleStore = create<RoleStore>((set) => ({
  currentRole: "監督",
  contractorName: DEMO_CONTRACTOR,
  setRole: (role) => set({ currentRole: role }),
  setContractorName: (name) => set({ contractorName: name }),
}))

// ─── ロール別の操作権限 ──────────────────────────────────

/** 起票できるか */
export const canCreateIssue = (role: UserRole) => role === "監督"

/** 期限変更できるか */
export const canChangeDueDate = (role: UserRole) => role === "監督"

/** 担当者・確認者を変更できるか */
export const canChangeAssignee = (role: UserRole) => role === "監督"

/**
 * 指定ステータスへの遷移が許可されているか
 * 監督: 全ステータスに遷移可
 * 業者: 対応中・是正報告済 のみ
 */
export const canTransitionTo = (role: UserRole, nextStatus: string): boolean => {
  if (role === "監督") return true
  return nextStatus === "対応中" || nextStatus === "是正報告済"
}

/** 写真をアップロードできるか（両ロール可） */
export const canUploadPhoto = (_role: UserRole) => true
