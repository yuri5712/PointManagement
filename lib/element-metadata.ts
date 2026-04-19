/**
 * BIM要素メタデータ
 *
 * 現在はダミーデータでIDに対して要素名・カテゴリをマッピング。
 * 将来的には Autodesk APS Model Derivative API (getProperties) から
 * 取得した値をキャッシュする形に置き換える。
 *
 * API例: GET /modelderivative/v2/designdata/{urn}/metadata/{guid}/properties
 */

export type ElementCategory = "構造" | "設備" | "仕上げ" | "外構" | "その他"

export interface ElementMetadata {
  /** 人間が読める要素名（BIMのElement Name相当） */
  name: string
  /** 大分類カテゴリ */
  category: ElementCategory
  /** 詳細説明（BIMのType Name相当） */
  detail?: string
  /** フロア・エリア情報（BIMのLevel相当） */
  level?: string
}

// ─── ダミーマッピング（実運用ではBIM APIで置き換え） ────────
const ELEMENT_METADATA_MAP: Record<string, ElementMetadata> = {
  // 構造系
  "135f118f-6d78-43a3-a9ec-260c6f0a10ae-02114a2c": {
    name: "手すり・安全柵",
    category: "構造",
    detail: "落下防止用手すり（スチール製）",
    level: "3F 廊下",
  },

  // 設備系
  "b73caf82-eec6-4e70-afe9-dc7619e8ca6d-0215e121": {
    name: "設備配管・電気系統",
    category: "設備",
    detail: "給排水配管 / 電気幹線配線",
    level: "2F 設備ゾーン",
  },

  // 仕上げ系
  "f041fe24-3752-4e08-9e91-d07d1823de73-02201b0b": {
    name: "床・建具仕上げ",
    category: "仕上げ",
    detail: "磁器タイル張り / アルミ建具",
    level: "1F エントランス",
  },
}

/**
 * APS objectId → モック平面図の要素位置マッピング
 *
 * 実運用では BIM モデルから 3D 座標を取得してオーバーレイに使う。
 * 現在はモック平面図の要素 ID と対応フロアを手動マッピング。
 *
 * TODO: APS Model Derivative API の getProperties から
 *       centroid 座標を取得して置き換える
 */
export const APS_TO_FLOOR_ELEMENT: Record<string, { floorId: string; elementId: string }> = {
  "135f118f-6d78-43a3-a9ec-260c6f0a10ae-02114a2c": { floorId: "3F", elementId: "3f-corridor" },
  "b73caf82-eec6-4e70-afe9-dc7619e8ca6d-0215e121": { floorId: "2F", elementId: "2f-pipe" },
  "f041fe24-3752-4e08-9e91-d07d1823de73-02201b0b": { floorId: "1F", elementId: "1f-entrance" },
}

/**
 * モック平面図の要素ID → APS objectId の逆引きマップ。
 *
 * 用途: モック平面図で要素をクリックしたとき、対応する APS objectId を
 *       取得して issue.elementId に格納する。これがないと起票された issue が
 *       ピン表示（APS_TO_FLOOR_ELEMENT で引く）と連動しない。
 *
 * APS_TO_FLOOR_ELEMENT から自動生成するため、手動での二重管理は不要。
 */
export const FLOOR_ELEMENT_TO_APS_ID: Record<string, string> = Object.fromEntries(
  Object.entries(APS_TO_FLOOR_ELEMENT).map(([apsId, { elementId }]) => [elementId, apsId])
)

/** カテゴリ別の表示色クラス（Tailwind） */
export const CATEGORY_COLOR: Record<ElementCategory, string> = {
  構造: "bg-orange-100 text-orange-700 border-orange-200",
  設備: "bg-blue-100   text-blue-700   border-blue-200",
  仕上げ: "bg-green-100  text-green-700  border-green-200",
  外構: "bg-yellow-100 text-yellow-700 border-yellow-200",
  その他: "bg-slate-100  text-slate-600  border-slate-200",
}

/**
 * objectId からメタデータを取得する。
 * 未登録の場合はフォールバック値を返す。
 *
 * @param elementId - APS objectId（externalId / dbId に対応）
 */
export function getElementMetadata(elementId: string): ElementMetadata {
  return (
    ELEMENT_METADATA_MAP[elementId] ?? {
      name: "不明な要素",
      category: "その他",
      detail: "BIMデータ未取得",
    }
  )
}

/**
 * objectId が既知かどうかを返す。
 * 既知 = BIM連携済み or ダミーマッピング登録済み
 */
export function isKnownElement(elementId: string): boolean {
  return elementId in ELEMENT_METADATA_MAP
}
