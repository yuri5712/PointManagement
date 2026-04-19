/**
 * 指摘タイトルの自動下書き生成モジュール
 *
 * 現在はルールベースのダミー生成。
 * 将来的には Claude API 等の LLM に差し替え可能なインターフェースを維持する。
 *
 * 差し替えポイント:
 *   generateDraft(elementId, category, photoBase64?) → Promise<string>
 *   ↑ 引数/戻り値シグネチャを変えずに内部実装をAIに変える
 */

import { getElementMetadata } from "./element-metadata"
import type { IssueCategory } from "./types"

/** 生成パラメータ（将来拡張用） */
export interface DraftParams {
  elementId?: string | null
  category: IssueCategory
  /** 将来: 写真のbase64（AI解析用） */
  photoHint?: string
}

/**
 * 指摘タイトルの下書きを生成して返す。
 * 非同期にしているのは将来のLLM連携を想定。
 * 現在は同期ロジックを Promise でラップしたダミー実装。
 *
 * TODO: LLM版では photoHint（写真base64）を受け取り、
 *       画像解析結果を踏まえた自然文を返す
 */
export async function generateDraftAsync(params: DraftParams): Promise<string> {
  // 現在はダミー実装（同期）
  return generateDraft(params.elementId, params.category)
}

/**
 * 同期版ドラフト生成（フォームのuseEffect等から呼ぶ用）
 */
export function generateDraft(
  elementId: string | null | undefined,
  category: IssueCategory
): string {
  const categoryText = category === "安全" ? "安全上の問題" : "指摘事項"

  if (!elementId) {
    return `${categoryText}が確認されました`
  }

  const meta = getElementMetadata(elementId)
  const locationPart = meta.level ? `（${meta.level}）` : ""
  const detailPart = meta.detail ? `の${meta.detail}` : ""

  return `${meta.name}${detailPart}に${categoryText}が確認されました${locationPart}`
}
