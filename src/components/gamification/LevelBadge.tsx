'use client'

import type { UserLevel } from '@/types'

const LEVEL_CONFIG: Record<UserLevel, { emoji: string; description: string; minXP: number }> = {
  'Beobachter': {
    emoji: '👁️',
    description: 'Du beobachtest den Markt',
    minXP: 0,
  },
  'Dorf-Händler': {
    emoji: '🥉',
    description: 'Du kennst deinen Dorf-Markt',
    minXP: 50,
  },
  'Lokal-Matador': {
    emoji: '🥈',
    description: 'Du beherrschst die lokale Szene',
    minXP: 200,
  },
  'Kantons-Legende': {
    emoji: '🥇',
    description: 'Du bist eine Legende im Kanton',
    minXP: 500,
  },
  'Gotthard-Titan': {
    emoji: '💎',
    description: 'Du bist unstoppbar',
    minXP: 1000,
  },
}

interface Props {
  level: UserLevel | null | undefined
  xp: number
}

export function LevelBadge({ level, xp }: Props) {
  if (!level || !LEVEL_CONFIG[level]) {
    return null
  }

  const config = LEVEL_CONFIG[level]

  const getBorderClass = () => {
    if (level === 'Gotthard-Titan')
      return 'border-cyan-400/50 shadow-[0_0_12px_rgba(34,211,238,0.3)]'
    if (level === 'Kantons-Legende') return 'border-gold/60 shadow-lg shadow-gold/20'
    return 'border-white/20'
  }

  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-2 rounded-full border ${getBorderClass()} bg-white/5 backdrop-blur-sm`}
    >
      <span className="text-xl">{config.emoji}</span>
      <span className="font-semibold text-white">{level}</span>
      <span className="text-xs text-white/60 ml-1">{xp} XP</span>
    </div>
  )
}
