'use client'

import { getLevelProgress } from '@/lib/levels'

interface Props {
  xp: number
}

/** Animierter XP-Fortschrittsbalken zum nächsten Level */
export function XPBar({ xp }: Props) {
  const { current, next, percent } = getLevelProgress(xp)

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-display font-bold text-white">
          {current.emoji} {current.name}
        </span>
        <span className="text-white/60">
          {next ? `${xp} / ${next.min} XP` : `${xp} XP · Maximal-Level`}
        </span>
      </div>
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-glass">
        <div
          className="h-full rounded-full bg-gradient-to-r from-gold/70 to-gold transition-all duration-700"
          style={{ width: `${percent}%` }}
        />
      </div>
      {next && (
        <p className="mt-1 text-xs text-white/50">
          Noch {next.min - xp} XP bis {next.name}
        </p>
      )}
    </div>
  )
}
