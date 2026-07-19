'use client'

import Image from 'next/image'
import { useEffect, useRef } from 'react'
import { useAppStore } from '@/store/appStore'
import {
  useMinuteTick,
  reservedRemainingText,
  isRecentlyRelisted,
} from '@/lib/reservation'
import type { ListingWithProfile } from '@/types'

interface Props {
  listings: ListingWithProfile[]
  onExit: () => void
  /** Lädt die nächste Seite (cursor-basiert, identisch zum Grid) */
  onLoadMore?: () => void
  /** Ob es überhaupt noch weitere Inserate gibt */
  hasMore?: boolean
  /** Ob gerade eine Seite geladen wird */
  isLoading?: boolean
}

/**
 * Vollbild „TikTok"-Scroll-Modus: vertikales Scroll-Snapping über Inserate.
 * Sortierung erfolgt bereits beim Laden (Boosts → Neueste → FOMO).
 * Beim Swipen ans Ende wird über `onLoadMore` automatisch nachgeladen –
 * dieselbe cursor-basierte Pagination wie im Grid.
 */
export function TikTokScroll({
  listings,
  onExit,
  onLoadMore,
  hasMore = false,
  isLoading = false,
}: Props) {
  const setSelectedListingId = useAppStore((s) => s.setSelectedListingId)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const now = useMinuteTick()

  // Auto-Nachladen: sobald das Lade-Panel am Ende in Sichtnähe kommt, die
  // nächste Seite anfordern. rootMargin lädt vor, damit beim Swipen nahtlos
  // weitere Inserate bereitstehen. loadMore hat serverseitig eigene Guards
  // (isLoading/hasMore/cursor), Mehrfach-Trigger sind daher unschädlich.
  useEffect(() => {
    if (!onLoadMore || !hasMore) return
    const el = loadMoreRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) onLoadMore()
      },
      { threshold: 0.1, rootMargin: '0px 0px 600px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [onLoadMore, hasMore, listings.length])

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Exit-Button immer sichtbar */}
      <button
        onClick={onExit}
        className="absolute left-4 top-4 z-20 rounded-full bg-black/50 px-4 py-2 font-display text-sm font-bold text-white backdrop-blur-sm"
      >
        ← Zurück
      </button>

      <div className="h-[100dvh] snap-y snap-proximity overflow-y-scroll">
        {listings.map((listing) => {
          const img =
            listing.image_url ??
            (listing.image_urls && listing.image_urls[0]) ??
            null
          const price =
            listing.price_type === 'free'
              ? 'Gratis'
              : `CHF ${(listing.price ?? 0).toLocaleString('de-CH')}`

          return (
            <div
              key={listing.id}
              className="relative h-[100dvh] w-full snap-start"
            >
              {img ? (
                <Image
                  src={img}
                  alt={listing.title}
                  fill
                  className="object-cover"
                  sizes="100vw"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-obsidian-3 text-6xl">
                  📦
                </div>
              )}

              {/* Gradient von oben + unten für Lesbarkeit */}
              <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />

              {/* Status-Badge bei verkauft */}
              {listing.status === 'sold' && (
                <span className="absolute right-4 top-4 animate-fomo-pulse rounded-full bg-uri-fomo px-3 py-1 font-display text-sm font-bold text-white">
                  VERKAUFT
                </span>
              )}

              {/* Status-Badge bei reserviert – Countdown aus reserved_until (TEIL 4) */}
              {listing.status === 'reserved' && (
                <span
                  data-testid="reserved-badge"
                  className="absolute right-4 top-4 rounded-full bg-amber-500 px-3 py-1 font-display text-sm font-bold text-black"
                >
                  {reservedRemainingText(listing.reserved_until, now)}
                </span>
              )}

              {/* „🔄 Wieder erhältlich" (TEIL 5) – aktiv + kürzlich reaktiviert */}
              {listing.status === 'active' &&
                isRecentlyRelisted(listing.relisted_at, now) && (
                  <span
                    data-testid="relisted-badge"
                    className="absolute right-4 top-4 rounded-full bg-uri-success px-3 py-1 font-display text-sm font-bold text-black"
                  >
                    🔄 Wieder erhältlich!
                  </span>
                )}

              {/* Glas-Card unten */}
              <div className="absolute inset-x-4 bottom-24">
                <div className="glass-card rounded-2xl p-4">
                  <div className="flex items-center gap-2">
                    {listing.profiles?.avatar_url && (
                      <Image
                        src={listing.profiles.avatar_url}
                        alt={listing.profiles.username}
                        width={32}
                        height={32}
                        className="rounded-full"
                      />
                    )}
                    <span className="text-sm font-semibold text-white">
                      {listing.profiles?.username}
                    </span>
                    {listing.profiles?.level && (
                      <span className="text-xs text-gold">
                        {listing.profiles.level}
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 font-display text-xl font-bold text-white">
                    {listing.title}
                  </h3>
                  <p className="text-2xl font-display font-bold text-gold">
                    {price}
                  </p>

                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setSelectedListingId(listing.id)}
                      className="btn-gold flex-1 rounded-xl py-3"
                    >
                      Ansehen
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}

        {/* Ende: Lade-Panel (es kommt noch mehr) ODER Ende-Marker (fertig) */}
        {hasMore ? (
          <div
            ref={loadMoreRef}
            className="flex h-[100dvh] w-full snap-start flex-col items-center justify-center gap-4 bg-obsidian-2 text-center"
          >
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            <p className="text-white/50">
              {isLoading ? 'Weitere Inserate laden…' : 'Weiter swipen für mehr'}
            </p>
          </div>
        ) : (
          <div className="flex h-[100dvh] w-full snap-start flex-col items-center justify-center gap-4 bg-obsidian-2 text-center">
            <div className="text-5xl">🏔️</div>
            <p className="text-white/60">Das war&apos;s für jetzt!</p>
            <button
              onClick={onExit}
              className="rounded-xl border border-glass-border px-6 py-3 font-display font-bold text-white"
            >
              Zurück zum Markt
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
