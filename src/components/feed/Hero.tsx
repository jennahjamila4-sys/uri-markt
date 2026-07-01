import Image from 'next/image'

interface HeroProps {
  /** Verbleibende Pionier-Plätze (reine Marketing-Optik, später an echte Daten koppelbar) */
  pioneerSpots?: number
}

/**
 * Marktplatz-Hero nach docs/design/design-referenz.html:
 * echtes Uri-Bergpanorama mit langsamem Ken-Burns-Zoom, Scrim für Lesbarkeit,
 * Headline mit laufendem Gold-Sheen und pulsierendem Pionier-Scarcity-Badge.
 * Reine Optik – enthält keine Logik.
 */
export function Hero({ pioneerSpots = 7 }: HeroProps) {
  return (
    <section
      className="reveal relative m-3.5 h-[268px] overflow-hidden rounded-3xl border border-glass-border shadow-card"
      style={{ animationDelay: '0.1s' }}
    >
      {/* Echtes Bergpanorama mit langsamem Zoom */}
      <Image
        src="/uri-markt-alps-banner.jpg"
        alt="Uri Bergpanorama"
        fill
        priority
        sizes="(max-width: 480px) 100vw, 460px"
        className="kenburns object-cover object-[center_38%]"
      />

      {/* Scrim: links dunkel → rechts transparent, damit Text lesbar bleibt */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/5" />

      <div className="absolute inset-0 flex flex-col justify-start p-[18px]">
        <span className="self-start inline-flex items-center gap-1.5 rounded-full border border-gold/35 bg-gold/10 px-3 py-1.5 font-display text-[11px] font-bold tracking-wide text-gold backdrop-blur-sm">
          ⭐ HYPERLOKALER MARKTPLATZ
        </span>

        <h2 className="mt-3.5 max-w-[78%] font-display text-[33px] font-extrabold leading-[1.02] tracking-tight">
          Kaufe &amp; Verkaufe <span className="text-shine">direkt in Uri.</span>
        </h2>

        <p className="mt-2.5 max-w-[62%] text-[13.5px] leading-snug text-white/[0.78]">
          Dein lokaler Marktplatz für Produkte, Events und Gesuche.
        </p>

        <span className="animate-scarce mt-auto self-start inline-flex items-center gap-1.5 rounded-full border border-[#FF6B2C]/40 bg-gradient-to-br from-[#FF3B30]/[0.22] to-[#FF6B2C]/[0.12] px-3.5 py-[7px] text-xs font-semibold text-white">
          🏆 Noch <b className="text-gold-lt">&nbsp;{pioneerSpots}&nbsp;</b> Pionier-Plätze verfügbar
        </span>
      </div>
    </section>
  )
}
