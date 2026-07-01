'use client'

import Image from 'next/image'
import { useAppStore } from '@/store/appStore'
import type { ListingWithProfile } from '@/types'

interface Props {
  listings: ListingWithProfile[]
  onExit: () => void
}

/**
 * Vollbild „TikTok"-Scroll-Modus: vertikales Scroll-Snapping über Inserate.
 * Sortierung erfolgt bereits beim Laden (Boosts → Neueste → FOMO).
 */
export function TikTokScroll({ listings, onExit }: Props) {
  const setSelectedListingId = useAppStore((s) => s.setSelectedListingId)

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Exit-Button immer sichtbar */}
      <button
        onClick={onExit}
        className="absolute left-4 top-4 z-20 rounded-full bg-black/50 px-4 py-2 font-display text-sm font-bold text-white backdrop-blur-sm"
      >
        ← Zurück
      </button>

      <div className="h-[100dvh] snap-y snap-mandatory overflow-y-scroll">
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

        {/* Ende-Marker */}
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
      </div>
    </div>
  )
}
