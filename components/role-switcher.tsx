"use client"

import { useRoleStore } from "@/lib/role-store"
import { cn } from "@/lib/utils"
import { HardHat, ShieldCheck } from "lucide-react"

/**
 * デモ用ロール切替ウィジェット
 * 黄金シナリオ：監督→業者→監督 のロール切替を画面上で実演するため
 */
export function RoleSwitcher() {
  const { currentRole, setRole } = useRoleStore()

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground hidden sm:block">ロール：</span>
      <div className="flex items-center p-0.5 bg-muted rounded-lg border border-border gap-0.5">
        <button
          onClick={() => setRole("監督")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-all",
            currentRole === "監督"
              ? "bg-blue-600 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
          )}
        >
          <ShieldCheck className="w-3.5 h-3.5" />
          監督
        </button>
        <button
          onClick={() => setRole("業者")}
          className={cn(
            "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs font-semibold transition-all",
            currentRole === "業者"
              ? "bg-orange-500 text-white shadow-sm"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/80"
          )}
        >
          <HardHat className="w-3.5 h-3.5" />
          業者
        </button>
      </div>
    </div>
  )
}
