'use client'

import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import { toast } from 'sonner'

/**
 * Hook to watch for XP changes and show toasts/modals
 */
export function useXPWatcher() {
  const user = useAppStore((s) => s.user)
  const prevXP = useRef<number | null>(null)
  const prevLevel = useRef<string | null>(null)

  useEffect(() => {
    if (!user) return

    const gained = (user.xp_points ?? 0) - (prevXP.current ?? 0)

    // Show XP gained toast
    if (gained > 0 && prevXP.current !== null) {
      toast.success(`+${gained} XP!`, {
        description: `Total: ${user.xp_points} XP`,
        duration: 3000,
      })
    }

    // Show level up modal
    if (user.level !== prevLevel.current && prevLevel.current !== null) {
      showLevelUpModal(user.level, user.xp_points ?? 0)
    }

    prevXP.current = user.xp_points ?? 0
    prevLevel.current = user.level ?? null
  }, [user])
}

function showLevelUpModal(level: string | null, xp: number) {
  if (!level) return

  const levelEmojis: Record<string, string> = {
    'Beobachter': '👁️',
    'Dorf-Händler': '🥉',
    'Lokal-Matador': '🥈',
    'Kantons-Legende': '🥇',
    'Gotthard-Titan': '💎',
  }

  const emoji = levelEmojis[level] || '⭐'

  toast.success(`${emoji} Level ${level}!`, {
    description: `Glückwunsch! Du bist jetzt ${level} mit ${xp} XP.`,
    duration: 5000,
  })
}
