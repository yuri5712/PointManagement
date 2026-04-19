import { NextResponse } from "next/server"

/**
 * APS 2-legged access token を取得するAPIルート
 *
 * 環境変数:
 *   APS_CLIENT_ID     - Autodesk Platform Services のクライアントID
 *   APS_CLIENT_SECRET - Autodesk Platform Services のクライアントシークレット
 *   MODEL_URN         - 表示するモデルのURN（Base64エンコード済み）
 *
 * GET /api/aps-token → { access_token: string, expires_in: number, urn: string }
 */
export async function GET() {
  const clientId     = process.env.APS_CLIENT_ID
  const clientSecret = process.env.APS_CLIENT_SECRET
  const modelUrn     = process.env.MODEL_URN

  if (!clientId || !clientSecret) {
    return NextResponse.json(
      { error: "APS_CLIENT_ID / APS_CLIENT_SECRET が設定されていません" },
      { status: 500 }
    )
  }

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "viewables:read",
  })

  const res = await fetch(
    "https://developer.api.autodesk.com/authentication/v2/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      // トークンの有効期限より短い時間でキャッシュ（55分）
      next: { revalidate: 55 * 60 },
    }
  )

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json(
      { error: `Autodesk 認証失敗: ${res.status} ${text}` },
      { status: 502 }
    )
  }

  const data = await res.json()
  return NextResponse.json({
    access_token: data.access_token as string,
    expires_in:   data.expires_in   as number,
    urn:          modelUrn ?? null,
  })
}
