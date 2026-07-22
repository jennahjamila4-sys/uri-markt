'use client'

import Image from 'next/image'

/** Persona steuert allein den Gratulations-Text auf Screen 2 (keine Logik dahinter). */
export type Persona = 'verkaufen' | 'suchen' | 'beides' | null

interface Props {
  /** Persona wählen (Karten-Tap / „beides") und zu Screen 2 gehen. */
  onSelect: (persona: Persona) => void
}

/**
 * Onboarding Screen 1 — Hook + zwei antippbare Persona-Karten.
 * Ken-Burns-Alpen-Hero (echtes Bergpanorama), Gold-Shine auf „Gold wert",
 * Glassmorphism-Karten mit Gold-Sweep beim Hover. Texte exakt aus block-12-MD.
 * Effekte sind reine Visual-Schicht (Lektion 19).
 */
export function OnboardingScreen1({ onSelect }: Props) {
  return (
    <div className="flex h-[90vh] flex-col overflow-y-auto bg-[radial-gradient(120%_80%_at_50%_-10%,#16130a_0%,#0a0a0b_38%,#000_100%)]">
      {/* Skip → weiter ohne Persona */}
      <button
        onClick={() => onSelect(null)}
        data-testid="onboarding-skip"
        className="absolute right-4 top-5 z-20 rounded-full border border-glass-border bg-black/40 px-3.5 py-1.5 text-xs text-white/70 backdrop-blur-sm transition hover:text-white"
      >
        Überspringen
      </button>

      {/* Hero mit Ken-Burns-Zoom */}
      <div className="relative h-[340px] shrink-0 overflow-hidden">
        <Image
          src="/uri-markt-alps-banner.jpg"
          alt="Urner Alpen"
          fill
          priority
          sizes="(max-width: 480px) 100vw, 430px"
          className="kenburns object-cover object-[center_40%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.35)_0%,rgba(0,0,0,0.15)_30%,rgba(0,0,0,0.78)_78%,#000_100%)]" />

        <div className="absolute inset-0 flex flex-col justify-between p-6">
          <div className="reveal flex items-center gap-2.5" style={{ animationDelay: '.05s' }}>
            <Image
              src="/uri-markt-uristier-logo.png"
              alt="Uri-Markt"
              width={40}
              height={40}
              className="drop-shadow-[0_2px_8px_rgba(255,215,0,0.4)]"
            />
            <div>
              <h1 className="font-display text-lg font-extrabold leading-none tracking-wide text-white">
                Uri<span className="text-gold">-Markt</span>
              </h1>
              <p className="mt-0.5 text-[10px] uppercase tracking-[1.6px] text-white/55">
                Dein lokaler Marktplatz
              </p>
            </div>
          </div>

          <div>
            <h2
              className="reveal font-display text-[33px] font-extrabold leading-[1.04] tracking-tight text-white"
              style={{ animationDelay: '.15s' }}
            >
              Was bei dir rumsteht,
              <br />
              ist <span className="text-shine">Gold wert</span>.
            </h2>
            <p
              className="reveal mt-2.5 max-w-[96%] text-sm leading-relaxed text-white/[0.82]"
              style={{ animationDelay: '.28s' }}
            >
              Für dich – und für jemanden in Uri. Stell es{' '}
              <b className="font-semibold text-gold-lt">einmal</b> ein, und{' '}
              <b className="font-semibold text-gold-lt">Smart Match</b> meldet sich bei dir,
              sobald jemand Interesse hat.
            </p>
          </div>
        </div>
      </div>

      {/* Persona-Karten */}
      <div className="flex flex-1 flex-col gap-3 p-5">
        <button
          onClick={() => onSelect('verkaufen')}
          data-testid="onboarding-persona-verkaufen"
          className="gold-sweep reveal relative flex items-start gap-3.5 overflow-hidden rounded-[20px] border border-glass-border bg-[linear-gradient(135deg,rgba(255,255,255,0.09),rgba(255,255,255,0.055))] p-4 text-left transition-all duration-300 ease-smooth hover:-translate-y-1.5 hover:border-gold/50 hover:shadow-gold"
          style={{ animationDelay: '.4s' }}
        >
          <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[14px] border border-gold/30 bg-[linear-gradient(135deg,rgba(255,215,0,0.16),rgba(255,152,0,0.06))] text-[23px]">
            📦
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[16.5px] font-bold text-white">
              Loswerden &amp; verdienen
            </span>
            <span className="mt-1 block text-[12.8px] leading-snug text-white/55">
              Einmal einstellen – dann macht die App die Arbeit und sagt dir Bescheid, sobald
              jemand aus Uri dein Ding will.
            </span>
          </span>
        </button>

        <button
          onClick={() => onSelect('suchen')}
          data-testid="onboarding-persona-suchen"
          className="gold-sweep reveal relative flex items-start gap-3.5 overflow-hidden rounded-[20px] border border-glass-border bg-[linear-gradient(135deg,rgba(255,255,255,0.09),rgba(255,255,255,0.055))] p-4 text-left transition-all duration-300 ease-smooth hover:-translate-y-1.5 hover:border-gold/50 hover:shadow-gold"
          style={{ animationDelay: '.52s' }}
        >
          <span className="grid h-[46px] w-[46px] shrink-0 place-items-center rounded-[14px] border border-gold/30 bg-[linear-gradient(135deg,rgba(255,215,0,0.16),rgba(255,152,0,0.06))] text-[23px]">
            🔍
          </span>
          <span className="min-w-0">
            <span className="block font-display text-[16.5px] font-bold text-white">
              Etwas Bestimmtes suchen
            </span>
            <span className="mt-1 block text-[12.8px] leading-snug text-white/55">
              Sag einmal, was du brauchst. Smart Match meldet sich, sobald es jemand aus deiner
              Nähe anbietet – du musst nie wieder suchen.
            </span>
          </span>
        </button>

        <button
          onClick={() => onSelect('beides')}
          data-testid="onboarding-persona-beides"
          className="reveal py-2 text-center text-[13px] font-semibold text-gold opacity-85 transition hover:opacity-100"
          style={{ animationDelay: '.64s' }}
        >
          Mich interessiert beides →
        </button>
      </div>
    </div>
  )
}
