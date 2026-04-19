#!/usr/bin/env python3
"""
設備点検カレンダー_データ量実験 DB
計画日 >= 2030-04-01 のページを一括アーカイブするスクリプト

使い方:
  pip install requests
  python notion_archive.py --token <NOTION_API_TOKEN> [--dry-run]
"""

import argparse
import time
import json
import sys
from datetime import datetime

try:
    import requests
except ImportError:
    print("ERROR: requests がインストールされていません。")
    print("  pip install requests")
    sys.exit(1)

# ============================================================
# 設定
# ============================================================
DATABASE_ID = "34d888bf7a0b827b968b819532e7601c"
CUTOFF_DATE = "2030-04-01"          # この日付以降をアーカイブ
BATCH_SLEEP  = 0.35                 # リクエスト間隔 (sec) ※ 3req/s制限対策
PAGE_SIZE    = 100                  # 1クエリあたりの取得件数 (max 100)
PROGRESS_FILE = "archive_progress.json"

HEADERS_TEMPLATE = {
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json",
}

# ============================================================
# Notion API ラッパー
# ============================================================
def get_headers(token: str) -> dict:
    h = dict(HEADERS_TEMPLATE)
    h["Authorization"] = f"Bearer {token}"
    return h


def query_database(token: str, start_cursor: str | None = None) -> dict:
    """計画日 >= CUTOFF_DATE のページを取得（archived=false のみ）"""
    url = f"https://api.notion.com/v1/databases/{DATABASE_ID}/query"
    payload = {
        "page_size": PAGE_SIZE,
        "filter": {
            "and": [
                {
                    "property": "計画日",
                    "date": {
                        "on_or_after": CUTOFF_DATE
                    }
                },
                # 未アーカイブのみ対象（再実行時のスキップ用）
                # Notion API では archived フィルタは query では使えないため
                # アーカイブ済みページは自動的に返らない（archived=true は非表示）
            ]
        },
        "sorts": [
            {"property": "計画日", "direction": "ascending"}
        ]
    }
    if start_cursor:
        payload["start_cursor"] = start_cursor

    for attempt in range(5):
        resp = requests.post(url, headers=get_headers(token), json=payload)
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", 10))
            print(f"  [Rate limit] {wait}秒待機中...")
            time.sleep(wait)
            continue
        if resp.status_code != 200:
            print(f"  [ERROR] query: {resp.status_code} {resp.text}")
            return None
        return resp.json()

    print("  [ERROR] リトライ上限に達しました (query)")
    return None


def archive_page(token: str, page_id: str) -> bool:
    """ページをアーカイブ（archived=true に設定）"""
    url = f"https://api.notion.com/v1/pages/{page_id}"
    payload = {"archived": True}

    for attempt in range(5):
        resp = requests.patch(url, headers=get_headers(token), json=payload)
        if resp.status_code == 429:
            wait = int(resp.headers.get("Retry-After", 10))
            print(f"  [Rate limit] {wait}秒待機中...")
            time.sleep(wait)
            continue
        if resp.status_code == 200:
            return True
        print(f"  [ERROR] archive page {page_id}: {resp.status_code} {resp.text}")
        return False

    print(f"  [ERROR] リトライ上限 page {page_id}")
    return False


# ============================================================
# 進捗管理
# ============================================================
def load_progress() -> dict:
    try:
        with open(PROGRESS_FILE, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        return {"archived_ids": [], "last_cursor": None, "total_archived": 0}


def save_progress(progress: dict):
    with open(PROGRESS_FILE, "w") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


# ============================================================
# メイン処理
# ============================================================
def run(token: str, dry_run: bool):
    print(f"{'[DRY-RUN] ' if dry_run else ''}開始: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"対象DB: {DATABASE_ID}")
    print(f"条件: 計画日 >= {CUTOFF_DATE}")
    print("-" * 60)

    progress = load_progress()
    archived_ids_set = set(progress["archived_ids"])
    cursor = progress["last_cursor"]
    total_archived = progress["total_archived"]
    total_skipped  = 0
    total_error    = 0
    batch_num      = 0

    if cursor:
        print(f"[再開] 前回の続きから (処理済: {total_archived}件)")

    while True:
        batch_num += 1
        result = query_database(token, cursor)
        if result is None:
            print("[FATAL] クエリ失敗。終了します。")
            break

        pages = result.get("results", [])
        if not pages:
            break

        has_more = result.get("has_more", False)
        next_cursor = result.get("next_cursor")

        print(f"\nバッチ #{batch_num}  取得: {len(pages)}件  (累計アーカイブ済: {total_archived}件)")

        for page in pages:
            page_id = page["id"]
            title_prop = page.get("properties", {}).get("計画", {})
            titles = title_prop.get("title", [])
            title = titles[0]["plain_text"] if titles else "(無題)"
            plan_date = page.get("properties", {}).get("計画日", {}).get("date", {})
            plan_start = plan_date.get("start", "") if plan_date else ""

            if page_id in archived_ids_set:
                total_skipped += 1
                continue

            if dry_run:
                print(f"  [DRY] {plan_start}  {title[:50]}")
                archived_ids_set.add(page_id)
                total_archived += 1
            else:
                ok = archive_page(token, page_id)
                if ok:
                    archived_ids_set.add(page_id)
                    total_archived += 1
                    print(f"  [OK] {plan_start}  {title[:50]}")
                else:
                    total_error += 1
                    print(f"  [NG] {plan_start}  {title[:50]}")

                time.sleep(BATCH_SLEEP)

        # 進捗保存（カーソル更新）
        progress["archived_ids"] = list(archived_ids_set)
        progress["last_cursor"] = next_cursor if has_more else None
        progress["total_archived"] = total_archived
        save_progress(progress)

        if not has_more:
            break

        cursor = next_cursor

    print("\n" + "=" * 60)
    print(f"完了: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"  アーカイブ: {total_archived}件")
    print(f"  スキップ:   {total_skipped}件")
    print(f"  エラー:     {total_error}件")
    if dry_run:
        print("\n※ DRY-RUNモードのため実際にはアーカイブされていません。")
        print("   --dry-run を外して再実行してください。")


# ============================================================
# エントリポイント
# ============================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Notion DBの計画日>=2030-04-01のページを一括アーカイブ"
    )
    parser.add_argument(
        "--token", "-t",
        required=True,
        help="Notion Integration Token (secret_xxx...)"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="実際にアーカイブせず対象件数を確認するだけ"
    )
    args = parser.parse_args()

    run(token=args.token, dry_run=args.dry_run)
