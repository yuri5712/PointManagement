"use client"

import { create } from "zustand"
import type { Issue, IssueStatus, Photo, PhotoStage, HistoryEntry, RelatedIssue, IssueLocation } from "./types"
import { MOCK_ISSUES } from "./mock-data"

// 現在のユーザー（プロトタイプ用の仮実装）
const CURRENT_USER = "現場監督A"

interface IssueStore {
  issues: Issue[]
  currentUser: string
  addIssue: (issue: Omit<Issue, "id" | "createdAt" | "createdBy" | "history">) => void
  updateIssue: (id: string, updates: Partial<Issue>) => void
  updateStatus: (id: string, status: IssueStatus) => void
  addPhoto: (id: string, photo: Omit<Photo, "id" | "addedAt" | "addedBy">) => void
  addRelatedIssue: (id: string, relatedIssueId: string, memo?: string) => void
  changeAssignee: (id: string, newAssignee: string) => void
  changeInspector: (id: string, newInspector: string) => void
  getIssueById: (id: string) => Issue | undefined
  /** 指摘に平面図/3Dビューアの要素IDを紐付ける（後方互換） */
  linkElement: (issueId: string, elementId: string) => void
  /** 指摘の要素ID紐付けを解除する */
  unlinkElement: (issueId: string) => void
  /** 位置情報（IssueLocation union）を設定する */
  setLocation: (issueId: string, location: IssueLocation) => void
  /** 位置情報をクリアする */
  clearLocation: (issueId: string) => void
}

const generateId = (prefix: string, length: number = 3) => {
  return `${prefix}-${Math.random().toString(36).substr(2, length).toUpperCase()}`
}

const createHistoryEntry = (
  actionType: HistoryEntry["actionType"],
  actor: string,
  details: HistoryEntry["details"] = {}
): HistoryEntry => ({
  id: generateId("h"),
  timestamp: new Date().toISOString(),
  actionType,
  actor,
  details,
})

export const useIssueStore = create<IssueStore>((set, get) => ({
  issues: MOCK_ISSUES,
  currentUser: CURRENT_USER,
  
  addIssue: (issueData) => {
    const now = new Date().toISOString()
    const newIssue: Issue = {
      ...issueData,
      id: `ISS-${String(get().issues.length + 1).padStart(3, "0")}`,
      createdAt: now,
      createdBy: get().currentUser,
      history: [
        createHistoryEntry("created", get().currentUser),
      ],
    }
    
    // 写真があれば履歴に追加
    if (newIssue.photos.length > 0) {
      newIssue.history.push(
        createHistoryEntry("photo_added", get().currentUser, { 
          photoStage: newIssue.photos[0].stage 
        })
      )
    }
    
    set((state) => ({
      issues: [newIssue, ...state.issues],
    }))
  },
  
  updateIssue: (id, updates) => {
    set((state) => ({
      issues: state.issues.map((issue) =>
        issue.id === id ? { ...issue, ...updates } : issue
      ),
    }))
  },
  
  updateStatus: (id, status) => {
    const { currentUser } = get()
    set((state) => ({
      issues: state.issues.map((issue) => {
        if (issue.id !== id) return issue
        
        const historyEntry = createHistoryEntry("status_changed", currentUser, {
          from: issue.status,
          to: status,
        })
        
        return {
          ...issue,
          status,
          history: [...issue.history, historyEntry],
        }
      }),
    }))
  },
  
  addPhoto: (id, photoData) => {
    const { currentUser } = get()
    set((state) => ({
      issues: state.issues.map((issue) => {
        if (issue.id !== id) return issue
        
        const newPhoto: Photo = {
          ...photoData,
          id: generateId("photo"),
          addedAt: new Date().toISOString(),
          addedBy: currentUser,
        }
        
        const historyEntry = createHistoryEntry("photo_added", currentUser, {
          photoStage: photoData.stage,
        })
        
        return {
          ...issue,
          photos: [...issue.photos, newPhoto],
          history: [...issue.history, historyEntry],
        }
      }),
    }))
  },
  
  addRelatedIssue: (id, relatedIssueId, memo) => {
    const { currentUser } = get()
    set((state) => ({
      issues: state.issues.map((issue) => {
        if (issue.id !== id) return issue
        
        // 既に関連付けされている場合はスキップ
        if (issue.relatedIssues.some(r => r.id === relatedIssueId)) {
          return issue
        }
        
        const newRelated: RelatedIssue = {
          id: relatedIssueId,
          memo,
        }
        
        const historyEntry = createHistoryEntry("related_issue_added", currentUser, {
          relatedIssueId,
          memo,
        })
        
        return {
          ...issue,
          relatedIssues: [...issue.relatedIssues, newRelated],
          history: [...issue.history, historyEntry],
        }
      }),
    }))
  },
  
  changeAssignee: (id, newAssignee) => {
    const { currentUser } = get()
    set((state) => ({
      issues: state.issues.map((issue) => {
        if (issue.id !== id) return issue
        
        const historyEntry = createHistoryEntry("assignee_changed", currentUser, {
          from: issue.assignee,
          to: newAssignee,
        })
        
        return {
          ...issue,
          assignee: newAssignee,
          history: [...issue.history, historyEntry],
        }
      }),
    }))
  },
  
  changeInspector: (id, newInspector) => {
    const { currentUser } = get()
    set((state) => ({
      issues: state.issues.map((issue) => {
        if (issue.id !== id) return issue
        
        const historyEntry = createHistoryEntry("inspector_changed", currentUser, {
          from: issue.inspector,
          to: newInspector,
        })
        
        return {
          ...issue,
          inspector: newInspector,
          history: [...issue.history, historyEntry],
        }
      }),
    }))
  },
  
  getIssueById: (id) => {
    return get().issues.find((issue) => issue.id === id)
  },

  linkElement: (issueId, elementId) => {
    set((state) => ({
      issues: state.issues.map((issue) =>
        issue.id === issueId
          ? { ...issue, elementId, location: { type: "aps" as const, elementId } }
          : issue
      ),
    }))
  },

  unlinkElement: (issueId) => {
    set((state) => ({
      issues: state.issues.map((issue) =>
        issue.id === issueId ? { ...issue, elementId: undefined, location: undefined } : issue
      ),
    }))
  },

  setLocation: (issueId, location) => {
    set((state) => ({
      issues: state.issues.map((issue) => {
        if (issue.id !== issueId) return issue
        // APSロケーションの場合は elementId も同期
        const elementId = location.type === "aps" ? location.elementId : issue.elementId
        return { ...issue, location, elementId }
      }),
    }))
  },

  clearLocation: (issueId) => {
    set((state) => ({
      issues: state.issues.map((issue) =>
        issue.id === issueId ? { ...issue, location: undefined, elementId: undefined } : issue
      ),
    }))
  },
}))
