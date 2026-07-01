'use client'
import { useEffect, useState } from 'react'
import { Heart, MapPin } from 'lucide-react'
import type { ListingWithProfile } from '@/types'

interface Props {
  listing: ListingWithProfile
  onClick?: () => void
}

/** Sekunden → „DDT HH:MM:SS" (Tage nur wenn nötig) */
function formatCountdown(total: number): string {
  const d = Math.floor(total / 86400)
  const h = String(Math.floor((total % 86400) / 3600)).padStart(2, '0')
  const m = String(Math.floor((total % 3600) / 60)).padStart(2, '0')
  const s = String(total % 60).padStart(2, '0')
  return d > 0 ? `${d}T ${h}:${m}:${s}` : `${h}:${m}:${s}`
}

/**
 * Vorankündigungs-/Event-Karte nach docs/design/design-referenz.html:
 * Countdown, geschimmerter Fortschrittsbalken und Scarcity-Hinweis.
 * Werte kommen aus echten DB-Feldern (event_date, current_bookings, max_capacity);
 * „Erinnere mich" ist ein visueller Toggle (kein Reminder-Backend).
 */
export function EventCard({ listing, onClick }: Props) {
  const [fav, setFav] = useState(false)
  const [reminded, setReminded] = useState(false)
  const [secs, setSecs] = useState<number | null>(null)
  const [barWidth, setBarWidth] = useState(0)

  const capacity = listing.max_capacity ?? 0
  const booked = listing.current_bookings ?? 0
  const pct = capacity > 0 ? Math.min(100, Math.round((booked / capacity) * 100)) : 0
  const priceVal = listing.ticket_price ?? listing.price
  const price =
    priceVal != null ? `CHF ${priceVal.toLocaleString('de-CH')}` : null

  // Countdown – erst nach Mount berechnet (kein Hydration-Mismatch)
  useEffect(() => {
    if (!listing.event_date) return
    const target = new Date(listing.event_date).getTime()
    const tick = () =>
      setSecs(Math.max(0, Math.floor((target - Date.now()) / 1000)))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [listing.event_date])

  // Balken füllt sich animiert nach kurzem Delay
  useEffect(() => {
    const t = setTimeout(() => setBarWidth(pct), 400)
    return () => clearTimeout(t)
  }, [pct])

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-[20px] border border-glass-border bg-[linear-gradient(165deg,#141416,#0c0c0d)] shadow-card transition-[transform,box-shadow,border-color] duration-300 ease-smooth hover:-translate-y-[5px] hover:border-white/20 hover:shadow-[0_18px_50px_rgba(0,0,0,0.6)]"
    >
      {/* Media */}
      <div className="relative grid h-24 place-items-center overflow-hidden bg-[radial-gradient(120%_120%_at_70%_0,#1a1430,#0c0c12)]">
        <span className="absolute left-2.5 top-2.5 z-[3] inline-flex items-center gap-1 rounded-full border border-uri-purple/50 bg-uri-purple/[0.14] px-2.5 py-[5px] font-display text-[9.5px] font-bold tracking-wide text-uri-purple">
          🚀 VORANKÜNDIGUNG
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            setFav((v) => !v)
          }}
          aria-label="Merken"
          className="absolute right-2.5 top-2.5 z-[4] grid h-[34px] w-[34px] place-items-center rounded-full border border-glass-border bg-black/40 backdrop-blur-sm transition active:scale-90"
        >
          <Heart
            size={17}
            className={fav ? 'heart-pop fill-uri-danger text-uri-danger' : 'text-white'}
          />
        </button>
        <span className="text-[44px] drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-smooth group-hover:scale-110">
          🎿
        </span>
      </div>

      {/* Body */}
      <div className="px-[13px] pb-1 pt-3">
        <h3 className="line-clamp-2 text-[13.5px] font-semibold leading-snug text-white/[0.94]">
          {listing.title}
        </h3>
        <div className="mt-[7px] flex items-center gap-1 text-[11.5px] text-white/35">
          <MapPin size={12} className="stroke-[1.6]" />
          <span>{listing.event_location || listing.gemeinde}</span>
          {price && <b className="ml-1 text-gold">· {price}</b>}
        </div>
      </div>

      {/* Countdown + Fortschritt */}
      <div className="px-[13px] pt-0">
        <div className="text-[9.5px] font-semibold uppercase tracking-[1.5px] text-white/35">
          {secs === 0 ? 'Startet jetzt' : 'Startet in'}
        </div>
        <div className="mt-0.5 font-display text-2xl font-extrabold tracking-wide text-gold tabular-nums">
          {secs === null ? '··:··:··' : formatCountdown(secs)}
        </div>

        {capacity > 0 && (
          <>
            <div className="relative my-[11px] h-2 overflow-hidden rounded-full bg-white/[0.08]">
              <i
                className="prog-shimmer absolute inset-y-0 left-0 block rounded-full bg-gradient-to-r from-gold-deep to-gold shadow-[0_0_12px_rgba(255,215,0,0.5)] transition-[width] [transition-duration:1400ms] ease-smooth"
                style={{ width: `${barWidth}%` }}
              />
            </div>
            <div className="text-[11px] font-medium text-white/55">
              <b className="text-white">{booked}</b> von {capacity} Plätzen reserviert
            </div>
          </>
        )}
      </div>

      {/* Erinnere mich (visueller Toggle) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          setReminded(true)
        }}
        className={`mx-[13px] mb-3.5 mt-[11px] flex items-center justify-center gap-[7px] rounded-[13px] border py-[11px] font-display text-[13px] font-bold transition active:scale-[0.97] ${
          reminded
            ? 'border-uri-success/45 text-uri-success'
            : 'border-gold/45 bg-gradient-to-br from-gold/[0.14] to-gold-deep/[0.05] text-gold hover:border-gold hover:shadow-gold'
        }`}
        style={{ width: 'calc(100% - 26px)' }}
      >
        {reminded ? '🔔 Erinnerung aktiv ✓' : '🔔 Erinnere mich'}
      </button>
    </div>
  )
}
