'use client'

import { getLevelProgress } from '@/lib/levels'

interface Props {
  gained: number
  totalXP: number
}

/**
 * Inhalt des XP-Gewinn-Toasts (wird via sonner `toast.custom` gerendert).
 * Gold-Münze + „+X XP" + Fortschrittsbalken zur nächsten Stufe.
 */
export function XPToast({ gained, totalXP }: Props) {
  const { current, next, percent } = getLevelProgress(totalXP)

  return (
    <div className="flex w-[300px] items-center gap-3 rounded-xl border border-gold/40 bg-obsidian-4 p-3 shadow-gold">
      <div className="flex h-10 w-10 shrink-0 animate-bounce items-center justify-center rounded-full bg-gold text-lg">
        🪙
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display font-bold text-gold">+{gained} XP</p>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-glass">
          <div
            className="h-full rounded-full bg-gold transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-white/50">
          {next ? `${current.name} · noch ${next.min - totalXP} XP bis ${next.name}` : current.name}
        </p>
      </div>
    </div>
  )
}
