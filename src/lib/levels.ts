import type { UserLevel } from '@/types'

export interface LevelConfig {
  name: UserLevel
  emoji: string
  min: number
  max: number
  perk: string
}

/** Level-Schwellen – Single Source of Truth für Gamification */
export const XP_LEVELS: LevelConfig[] = [
  { name: 'Beobachter', emoji: '👁️', min: 0, max: 49, perk: 'Du beobachtest den Markt' },
  { name: 'Dorf-Händler', emoji: '🥉', min: 50, max: 199, perk: 'Eigene Inserate hervorgehoben' },
  { name: 'Lokal-Matador', emoji: '🥈', min: 200, max: 499, perk: 'Smart Matches mit Priorität' },
  { name: 'Kantons-Legende', emoji: '🥇', min: 500, max: 999, perk: 'Gold-Badge im Profil' },
  { name: 'Gotthard-Titan', emoji: '💎', min: 1000, max: Infinity, perk: 'Maximales Vertrauen & Reichweite' },
]

/** Aktuelles Level + Fortschritt zum nächsten Level berechnen */
export function getLevelProgress(xp: number) {
  const current = XP_LEVELS.find((l) => xp >= l.min && xp <= l.max) ?? XP_LEVELS[0]
  const next = XP_LEVELS[XP_LEVELS.indexOf(current) + 1] ?? null

  const span = current.max === Infinity ? 1 : current.max - current.min + 1
  const into = xp - current.min
  const percent = current.max === Infinity ? 100 : Math.min(100, Math.round((into / span) * 100))

  return {
    current,
    next,
    percent,
    xpToNext: next ? next.min - xp : 0,
  }
}

export function levelEmoji(level: string | null | undefined): string {
  return XP_LEVELS.find((l) => l.name === level)?.emoji ?? '⭐'
}
