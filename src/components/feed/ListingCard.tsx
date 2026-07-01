'use client'
import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Eye, Heart, MapPin } from 'lucide-react'
import { CATEGORIES } from '@/types'
import type { ListingWithProfile } from '@/types'

interface ListingCardProps {
  listing: ListingWithProfile
  onClick?: () => void
}

const CATEGORY_EMOJI: Record<string, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c.emoji])
)

/** Stabiler Pseudo-Wert aus der Listing-ID (gleich auf Server & Client → kein Hydration-Mismatch) */
function seedFromId(id: string, min = 8, max = 38): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return min + (h % (max - min + 1))
}

/**
 * Live-Zähler „🔥 X schauen gerade" – reine FOMO-Optik.
 * Startwert deterministisch (kein echtes „gleichzeitig"-Datum), schwankt clientseitig.
 */
function LiveViewers({ id }: { id: string }) {
  const [n, setN] = useState(() => seedFromId(id))
  const ref = useRef<HTMLElement>(null)
  const first = useRef(true)

  useEffect(() => {
    const t = setInterval(() => {
      setN((prev) =>
        Math.random() > 0.55
          ? Math.max(8, prev + (Math.random() > 0.5 ? 1 : -1))
          : prev
      )
    }, 2600)
    return () => clearInterval(t)
  }, [])

  // Kurzes Aufleuchten bei Änderung (wie in der Referenz)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    ref.current?.animate(
      [{ transform: 'scale(1.35)', color: '#FFED4E' }, { transform: 'scale(1)' }],
      { duration: 400, easing: 'ease-out' }
    )
  }, [n])

  return (
    <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-uri-fire/30 bg-uri-fire/10 px-2.5 py-[5px] text-[11px] font-semibold text-uri-fire">
      <span className="animate-flick">🔥</span>
      <b ref={ref}>{n}</b>&nbsp;schauen gerade
    </div>
  )
}

export function ListingCard({ listing, onClick }: ListingCardProps) {
  const [fav, setFav] = useState(false)
  const isSold = listing.status === 'sold'
  const isFree = listing.price_type === 'free'
  const price = isFree
    ? 'Gratis'
    : `CHF ${(listing.price || 0).toLocaleString('de-CH')}`
  const emoji = CATEGORY_EMOJI[listing.category] ?? '📦'

  // Badge-Konfiguration nach Typ (Referenz-Farben)
  const typeBadge =
    listing.type === 'Gesuch'
      ? { label: '🔍 GESUCH', cls: 'text-uri-info bg-uri-info/[0.12] border-uri-info/50' }
      : listing.type === 'Event'
        ? { label: '🚀 VORANKÜNDIGUNG', cls: 'text-uri-purple bg-uri-purple/[0.14] border-uri-purple/50' }
        : { label: '🏷️ ANGEBOT', cls: 'text-gold-deep bg-gold-deep/[0.12] border-gold-deep/50' }

  // Geboostet → Highlight: Gold-Sweep + HIGHLIGHT-Badge oben links,
  // Typ-Badge wandert dann nach unten links (kollisionsfrei).
  const highlight = listing.is_boosted
  const typeBadgePos =
    highlight || listing.type === 'Angebot' ? 'bottom-2.5 left-2.5' : 'top-2.5 left-2.5'

  return (
    <div
      onClick={onClick}
      className={`group relative cursor-pointer overflow-hidden rounded-[20px] border bg-[linear-gradient(165deg,#141416,#0c0c0d)] shadow-card transition-[transform,box-shadow,border-color] duration-300 ease-smooth hover:-translate-y-[5px] hover:border-white/20 hover:shadow-[0_18px_50px_rgba(0,0,0,0.6)] ${
        highlight ? 'gold-sweep border-gold/50' : 'border-glass-border'
      }`}
    >
      {/* Media */}
      <div className="relative grid h-[122px] place-items-center overflow-hidden bg-[radial-gradient(120%_100%_at_50%_0,#1d1d20,#0c0c0d)]">
        {listing.image_url ? (
          <Image
            src={listing.image_url}
            alt={listing.title}
            fill
            sizes="(max-width: 480px) 50vw, 220px"
            className="object-cover transition-transform duration-500 ease-smooth group-hover:scale-105"
          />
        ) : (
          <span className="text-[54px] drop-shadow-[0_6px_14px_rgba(0,0,0,0.5)] transition-transform duration-500 ease-smooth group-hover:scale-110 group-hover:-translate-y-0.5">
            {emoji}
          </span>
        )}

        {/* Herz (reine Optik, keine Persistenz) */}
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
            className={
              fav ? 'heart-pop fill-uri-danger text-uri-danger' : 'text-white'
            }
          />
        </button>

        {/* HIGHLIGHT-Badge (nur geboostet) */}
        {highlight && (
          <span className="absolute left-2.5 top-2.5 z-[3] inline-flex items-center gap-1 rounded-full bg-gradient-to-br from-gold-lt to-gold px-2.5 py-[5px] font-display text-[9.5px] font-bold tracking-wide text-black shadow-[0_3px_12px_rgba(255,215,0,0.35)]">
            ⭐ HIGHLIGHT
          </span>
        )}

        {/* Typ-Badge */}
        <span
          className={`absolute ${typeBadgePos} z-[3] inline-flex items-center gap-1 rounded-full border px-2.5 py-[5px] font-display text-[9.5px] font-bold tracking-wide ${typeBadge.cls}`}
        >
          {typeBadge.label}
        </span>

        {/* Sold-Overlay (echter Status) */}
        {isSold && (
          <div className="absolute inset-0 z-[2] flex items-center justify-center bg-black/55 backdrop-blur-[1px]">
            <span className="animate-stamp -rotate-3 rounded-[7px] border-[1.4px] border-uri-danger px-2.5 py-1 font-display text-xs font-bold tracking-wide text-uri-danger">
              VERKAUFT
            </span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="px-[13px] pb-3.5 pt-3">
        <h3 className="line-clamp-2 min-h-[34px] text-[13.5px] font-semibold leading-snug text-white/[0.94]">
          {listing.title}
        </h3>

        <div
          className={`mt-2 font-display text-[21px] font-extrabold ${
            isFree ? 'text-uri-success' : 'text-gold'
          }`}
        >
          {price}
        </div>

        <div className="mt-[7px] flex items-center gap-1 text-[11.5px] text-white/35">
          <MapPin size={12} className="stroke-[1.6]" />
          <span>{listing.gemeinde}</span>
        </div>

        {listing.type === 'Angebot' && !isSold ? (
          <LiveViewers id={listing.id} />
        ) : (
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-glass-border bg-glass px-2.5 py-[5px] text-[11.5px] text-white/55">
            <Eye size={13} className="stroke-[1.6]" />
            {listing.views ?? 0}
          </div>
        )}
      </div>
    </div>
  )
}
