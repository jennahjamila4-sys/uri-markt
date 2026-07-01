'use client'

import { useEffect, useRef, createElement } from 'react'
import { toast } from 'sonner'
import { useAppStore } from '@/store/appStore'
import { XPToast } from '@/components/gamification/XPToast'

/**
 * Beobachtet XP-/Level-Änderungen des eingeloggten Users.
 * - XP-Gewinn → custom XPToast
 * - Level-Aufstieg → LevelUpModal (über Zustand-State `levelUp`)
 */
export function useXPWatcher() {
  const user = useAppStore((s) => s.user)
  const setLevelUp = useAppStore((s) => s.setLevelUp)
  const prevXP = useRef<number | null>(null)
  const prevLevel = useRef<string | null>(null)

  useEffect(() => {
    if (!user) return

    const xp = user.xp_points ?? 0
    const gained = xp - (prevXP.current ?? 0)

    // XP-Toast (nur bei echtem Zuwachs, nicht beim ersten Laden)
    if (gained > 0 && prevXP.current !== null) {
      toast.custom(() => createElement(XPToast, { gained, totalXP: xp }), {
        duration: 3000,
      })
    }

    // Level-Up Modal (nicht beim ersten Laden)
    if (user.level && user.level !== prevLevel.current && prevLevel.current !== null) {
      setLevelUp({ level: user.level, xp })
    }

    prevXP.current = xp
    prevLevel.current = user.level ?? null
  }, [user, setLevelUp])
}
