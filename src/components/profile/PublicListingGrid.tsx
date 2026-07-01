'use client'

import Image from 'next/image'
import { useAppStore } from '@/store/appStore'

export interface PublicListing {
  id: string
  title: string
  price: number | null
  price_type: string
  image_url: string | null
  status: string
}

interface Props {
  listings: PublicListing[]
}

export function PublicListingGrid({ listings }: Props) {
  const setSelectedListingId = useAppStore((s) => s.setSelectedListingId)

  if (listings.length === 0) {
    return (
      <p className="py-8 text-center text-white/60">
        Noch keine aktiven Inserate.
      </p>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {listings.map((l) => (
        <button
          key={l.id}
          onClick={() => setSelectedListingId(l.id)}
          className="overflow-hidden rounded-xl border border-glass-border bg-obsidian-3 text-left"
        >
          <div className="relative h-28 w-full bg-obsidian-4">
            {l.image_url && (
              <Image src={l.image_url} alt={l.title} fill className="object-cover" />
            )}
          </div>
          <div className="p-2">
            <p className="truncate text-sm font-semibold text-white">{l.title}</p>
            <p className="text-xs text-gold">
              {l.price_type === 'free'
                ? 'Gratis'
                : `CHF ${(l.price ?? 0).toFixed(2)}`}
            </p>
          </div>
        </button>
      ))}
    </div>
  )
}
