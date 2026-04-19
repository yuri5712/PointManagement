"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { RoleSwitcher } from "@/components/role-switcher"
import { useRoleStore } from "@/lib/role-store"
import { Plus, ClipboardList } from "lucide-react"

export function AppHeader() {
  const { currentRole } = useRoleStore()

  return (
    <header className="sticky top-0 z-50 bg-card border-b border-border">
      <div className="px-4 py-2.5 flex items-center justify-between gap-3">
        {/* ロゴ */}
        <Link href="/" className="flex items-center gap-2 py-1 shrink-0">
          <div className="p-1.5 bg-primary rounded-lg">
            <ClipboardList className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-base text-foreground hidden sm:block">指摘管理</span>
        </Link>

        {/* ロール切替（デモ用） */}
        <RoleSwitcher />

        {/* 起票ボタン（監督のみ） */}
        {currentRole === "監督" ? (
          <Link href="/issues/new">
            <Button size="sm" className="h-9 px-4 font-bold gap-1">
              <Plus className="h-4 w-4" />
              起票
            </Button>
          </Link>
        ) : (
          /* 業者は起票不可 — スペース確保のみ */
          <div className="w-[72px]" />
        )}
      </div>
    </header>
  )
}
