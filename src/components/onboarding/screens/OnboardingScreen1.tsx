'use client'

interface Props {
  pioneerCount: number
  onNext: () => void
}

export function OnboardingScreen1({ pioneerCount, onNext }: Props) {
  return (
    <div className="h-[90vh] flex flex-col justify-between items-center p-8 bg-gradient-to-b from-obsidian-2 to-obsidian-3 overflow-y-auto">
      <div className="pt-16" />

      {/* Animated Logo & Tagline */}
      <div className="text-center space-y-4 animate-fade-in">
        <div className="text-6xl font-bold text-gold mb-2 animate-scale-in">
          🏆
        </div>
        <h1 className="text-4xl font-display font-bold text-white">
          Uri-Markt
        </h1>
        <p className="text-xl text-gold font-semibold">Regional – Genau was es brucht!</p>
      </div>

      {/* Value Props */}
      <div className="space-y-3 my-8">
        {['Zeitsparend', 'KI-Benachrichtigungen', 'Privat & Business', 'Kostenlos starten'].map((prop, i) => (
          <div key={prop} className="flex items-center gap-3 text-white/80 animate-slide-right" style={{ animationDelay: `${i * 100}ms` }}>
            <span className="text-gold text-xl">✓</span>
            <span>{prop}</span>
          </div>
        ))}
      </div>

      {/* Pioneer Badge */}
      <div className="bg-gold/10 border border-gold/50 rounded-lg p-4 text-center mb-8">
        <div className="text-3xl font-bold text-gold">🏆 {pioneerCount}</div>
        <p className="text-white/70 text-sm">Noch {pioneerCount} Pionier-Plätze verfügbar!</p>
      </div>

      {/* CTA Button */}
      <button
        onClick={onNext}
        className="w-full py-3 bg-gradient-to-r from-gold to-amber-600 text-obsidian font-bold rounded-lg hover:shadow-lg hover:shadow-gold/50 transition-all"
      >
        Jetzt starten
      </button>

      <div className="pb-4" />
    </div>
  )
}
