'use client'

import type { Persona } from './OnboardingScreen1'

interface Props {
  persona: Persona
  /** Zurück zu Screen 1. */
  onBack: () => void
  /** „Los geht's" → Onboarding beenden + Registrierung öffnen. */
  onComplete: () => void
}

/**
 * Onboarding Screen 2 — So funktioniert Smart Match (Herzstück) + Geschenk +
 * persona-abhängiger Gratulations-Peak + CTA. Texte exakt aus block-12-MD.
 * FOMO = verpasste Chance (keine erfundenen Zahlen/Zeiten). Demo klar als
 * „Beispiel" markiert (kein Fake-Social-Proof).
 */
export function OnboardingScreen2({ persona, onBack, onComplete }: Props) {
  // Persona steuert NUR diesen Text (block-12-MD).
  const gratText =
    persona === 'suchen'
      ? 'Sag noch heute, was du suchst; Smart Match meldet sich, sobald es jemand aus deiner Nähe hat.'
      : 'Stell noch heute dein erstes Inserat ein; Smart Match übernimmt den Rest.'

  return (
    <div className="flex h-[90vh] flex-col overflow-y-auto bg-[radial-gradient(120%_80%_at_50%_-10%,#16130a_0%,#0a0a0b_38%,#000_100%)]">
      <div className="flex-1 px-6 pb-2 pt-14">
        <div className="reveal font-display text-[11px] font-bold uppercase tracking-[2px] text-gold" style={{ animationDelay: '.05s' }}>
          So funktioniert&apos;s
        </div>
        <h2
          className="reveal mb-6 mt-3 font-display text-[28px] font-extrabold leading-[1.08] tracking-tight text-white"
          style={{ animationDelay: '.05s' }}
        >
          Einmal einstellen.
          <br />
          <em className="not-italic text-gold">Uri-Markt sucht für dich weiter.</em>
        </h2>

        {/* Schritt 1 */}
        <Step delay=".2s" num="1">
          Du stellst dein Angebot ein – ein Foto, ein Titel, fertig.
        </Step>

        {/* Schritt 2 — HERZSTÜCK (gold hervorgehoben) */}
        <div
          className="reveal mb-4 flex items-start gap-3.5"
          style={{ animationDelay: '.32s' }}
          data-testid="onboarding-herzstueck"
        >
          <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px] border-none bg-[linear-gradient(135deg,#FFED4E,#FFD700)] font-display text-[15px] font-bold text-black shadow-[0_4px_16px_rgba(255,215,0,0.35)]">
            2
          </span>
          <span className="pt-0.5">
            <b className="block font-body text-sm font-semibold leading-snug text-white">
              Smart Match arbeitet für dich: Sobald jemand aus deiner Nähe genau das sucht,
              meldet sich die App bei dir.
            </b>
            <span className="mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 px-2.5 py-1 font-display text-[10px] font-bold tracking-wide text-gold">
              ⚡ Das Herzstück
            </span>
          </span>
        </div>

        {/* Schritt 3 */}
        <Step delay=".44s" num="3">
          Ihr trefft euch vor Ort, du übergibst – erledigt. Kein Versand, kein Papierkram.
        </Step>

        {/* Demo — klar als Beispiel markiert */}
        <div
          className="reveal my-4 rounded-xl border border-dashed border-glass-border bg-glass px-3.5 py-3 text-xs text-white/55"
          style={{ animationDelay: '.44s' }}
        >
          <span className="mb-1 block font-display text-[9.5px] font-bold uppercase tracking-wide text-white/35">
            Beispiel
          </span>
          „Kinderwagen“ → Anfrage von jemandem aus deiner Gemeinde.
        </div>

        {/* FOMO — verpasste Chance, keine Zahlen */}
        <p className="reveal my-4 text-[14.5px] font-medium leading-relaxed text-white" style={{ animationDelay: '.52s' }}>
          Ohne die App verpasst du vielleicht genau den, der dein Ding gesucht hat.{' '}
          <b className="font-semibold text-uri-fire">Mit Smart Match nie wieder.</b>
        </p>

        {/* Geschenk-Teaser — faktisch wahr (5 Uri-Taler, handle_new_user) */}
        <div
          className="reveal mb-5 flex items-center gap-3 rounded-2xl border border-gold/40 bg-[linear-gradient(135deg,rgba(255,215,0,0.14),rgba(255,152,0,0.05))] px-4 py-3.5"
          style={{ animationDelay: '.52s' }}
        >
          <span className="text-[26px]">🎁</span>
          <span>
            <b className="block font-display text-[15px] font-bold text-gold-lt">
              5 Uri-Taler geschenkt
            </b>
            <span className="mt-0.5 block text-xs text-white/55">
              Dein Startguthaben, weil du neu dabei bist.
            </span>
          </span>
        </div>

        {/* Gratulations-Peak (persona-abhängig) */}
        <div className="reveal mb-2 text-center" style={{ animationDelay: '.64s' }}>
          <h4 className="mb-2 font-display text-[19px] font-extrabold text-white">
            🎉 Gratulation – du machst gerade den ersten Schritt.
          </h4>
          <p className="mx-auto max-w-[88%] text-[13.5px] leading-relaxed text-white/55">
            {gratText}
          </p>
        </div>
      </div>

      {/* Footer-Steuerung */}
      <div className="mt-auto flex flex-col gap-3 px-6 pb-6 pt-4">
        <button
          onClick={onComplete}
          data-testid="onboarding-cta-start"
          className="w-full rounded-2xl bg-[linear-gradient(135deg,#FFED4E,#FFD700)] py-4 font-display text-base font-extrabold tracking-wide text-black shadow-gold transition hover:-translate-y-0.5 hover:shadow-[0_12px_40px_rgba(255,215,0,0.45)] active:scale-95"
        >
          Los geht&apos;s
        </button>
        <button
          onClick={onBack}
          className="w-full rounded-2xl border border-gold/40 bg-glass py-3 font-display font-bold text-gold transition hover:bg-glass-hover"
        >
          Zurück
        </button>
      </div>
    </div>
  )
}

function Step({
  num,
  delay,
  children,
}: {
  num: string
  delay: string
  children: React.ReactNode
}) {
  return (
    <div className="reveal mb-4 flex items-start gap-3.5" style={{ animationDelay: delay }}>
      <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[11px] border border-glass-border bg-glass font-display text-[15px] font-bold text-white/55">
        {num}
      </span>
      <b className="pt-0.5 font-body text-sm font-semibold leading-snug text-white/90">
        {children}
      </b>
    </div>
  )
}
