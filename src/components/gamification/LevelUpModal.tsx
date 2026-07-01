'use client'

import { useAppStore } from '@/store/appStore'
import { XP_LEVELS, levelEmoji } from '@/lib/levels'

/**
 * Fullscreen Level-Up-Overlay mit reiner CSS-Konfetti-Animation.
 * Wird über den Zustand-State `levelUp` gesteuert (siehe useXPWatcher).
 */
export function LevelUpModal() {
  const levelUp = useAppStore((s) => s.levelUp)
  const setLevelUp = useAppStore((s) => s.setLevelUp)

  if (!levelUp) return null

  const config = XP_LEVELS.find((l) => l.name === levelUp.level)
  const emoji = levelEmoji(levelUp.level)

  // 24 Konfetti-Teile mit verteilten Positionen/Verzögerungen
  const confetti = Array.from({ length: 24 }, (_, i) => i)
  const colors = ['#FFD700', '#FF2D55', '#4FC3F7', '#00D68F', '#ffffff']

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm">
      {/* Konfetti */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {confetti.map((i) => (
          <span
            key={i}
            className="confetti-piece"
            style={{
              left: `${(i * 4.16) % 100}%`,
              backgroundColor: colors[i % colors.length],
              animationDelay: `${(i % 8) * 0.15}s`,
              animationDuration: `${2.2 + (i % 5) * 0.3}s`,
            }}
          />
        ))}
      </div>

      <div className="animate-scale-in relative z-10 mx-4 max-w-sm rounded-3xl border border-gold/40 bg-obsidian-3 p-8 text-center shadow-gold">
        <div className="text-7xl">{emoji}</div>
        <p className="mt-4 text-sm font-body uppercase tracking-widest text-white/50">
          Level aufgestiegen!
        </p>
        <h2 className="mt-1 font-display text-4xl font-bold text-gold">
          {levelUp.level}
        </h2>
        <p className="mt-3 text-white/70">
          {config?.perk ?? `Du bist jetzt ${levelUp.level}!`}
        </p>
        <p className="mt-1 text-sm text-white/50">{levelUp.xp} XP</p>

        <button
          onClick={() => setLevelUp(null)}
          className="btn-gold mt-6 w-full rounded-xl py-3"
        >
          Weiter
        </button>
      </div>
    </div>
  )
}
