'use client'

import { useEffect } from 'react'

interface Props {
  onComplete: () => void
}

export function OnboardingScreen5({ onComplete }: Props) {
  useEffect(() => {
    // Trigger confetti animation
    const style = document.createElement('style')
    style.textContent = `
      @keyframes confetti-fall {
        0% {
          transform: translateY(-10vh) rotate(0deg);
          opacity: 1;
        }
        100% {
          transform: translateY(100vh) rotate(720deg);
          opacity: 0;
        }
      }
      
      .confetti {
        position: fixed;
        pointer-events: none;
        animation: confetti-fall 3s ease-in forwards;
      }
    `
    document.head.appendChild(style)

    // Create confetti pieces
    for (let i = 0; i < 50; i++) {
      const confetti = document.createElement('div')
      confetti.className = 'confetti'
      confetti.textContent = ['🎉', '✨', '⭐', '🌟', '💫', '🏆'][Math.floor(Math.random() * 6)]
      confetti.style.left = Math.random() * 100 + '%'
      confetti.style.fontSize = Math.random() * 20 + 20 + 'px'
      confetti.style.animationDelay = Math.random() * 0.5 + 's'
      confetti.style.opacity = '1'
      document.body.appendChild(confetti)

      setTimeout(() => confetti.remove(), 3500)
    }

    return () => style.remove()
  }, [])

  return (
    <div className="h-[90vh] flex flex-col justify-between p-8 bg-gradient-to-b from-obsidian-2 to-obsidian-3 overflow-y-auto">
      <div className="pt-12" />

      <div className="text-center space-y-8">
        <h2 className="text-4xl font-display font-bold text-white">
          🎉 Herzlich willkommen!
        </h2>

        <div className="bg-gradient-to-b from-gold/20 to-amber-600/20 border-2 border-gold rounded-xl p-8">
          <div className="text-5xl font-bold text-gold mb-2">5</div>
          <div className="text-xl text-white/80">Uri-Taler Guthaben</div>
          <p className="text-white/60 text-sm mt-2">Dein Startkapital für erste Käufe</p>
        </div>

        <div className="space-y-2 bg-obsidian-3 rounded-lg p-4">
          <p className="text-white/70">
            ✨ Du hast jetzt Zugang zu allen Features
          </p>
          <p className="text-white/70">
            🏆 Verdiene XP durch Käufe, Verkäufe &amp; Bewertungen
          </p>
          <p className="text-white/70">
            🎯 Finde lokale Deals in deiner Nähe
          </p>
        </div>
      </div>

      <button
        onClick={onComplete}
        className="w-full py-4 bg-gradient-to-r from-gold to-amber-600 text-obsidian font-bold text-lg rounded-lg hover:shadow-lg hover:shadow-gold/50 transition-all"
      >
        Los geht&apos;s! 🚀
      </button>

      <div className="pb-4" />
    </div>
  )
}
