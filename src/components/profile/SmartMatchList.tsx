'use client'

import { useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { dismissMatchAction } from '@/app/actions/listings'
import { useAppStore } from '@/store/appStore'

export interface MatchItem {
  id: string
  score: number
  listing: {
    id: string
    title: string
    price: number | null
    image_url: string | null
    category: string
  } | null
}

interface Props {
  matches: MatchItem[]
}

export function SmartMatchList({ matches }: Props) {
  const [items, setItems] = useState(matches)
  const [busyId, setBusyId] = useState<string | null>(null)
  const setSelectedListingId = useAppStore((s) => s.setSelectedListingId)

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-glass-border bg-obsidian-3 p-6 text-center">
        <p className="text-white/60">
          Noch keine Treffer. Erstelle ein Gesuch, und wir finden passende
          Angebote für dich. 🎯
        </p>
      </div>
    )
  }

  const dismiss = async (id: string) => {
    setBusyId(id)
    try {
      await dismissMatchAction(id)
      setItems((prev) => prev.filter((m) => m.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler')
    } finally {
      setBusyId(null)
    }
  }

  const ringColor = (score: number) =>
    score >= 80 ? 'text-uri-success' : score >= 60 ? 'text-gold' : 'text-white/50'

  return (
    <div className="space-y-3">
      {items.map((match) => (
        <div
          key={match.id}
          className="flex items-center gap-3 rounded-2xl border border-glass-border bg-obsidian-3 p-3"
        >
          {/* Score-Ring */}
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 border-current font-display text-sm font-bold ${ringColor(
              match.score
            )}`}
          >
            {match.score}
          </div>

          {/* Listing-Vorschau */}
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-obsidian-4">
            {match.listing?.image_url && (
              <Image
                src={match.listing.image_url}
                alt={match.listing.title}
                fill
                className="object-cover"
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-white">
              {match.listing?.title ?? 'Inserat'}
            </p>
            <p className="text-sm text-gold">
              CHF {(match.listing?.price ?? 0).toFixed(2)}
            </p>
          </div>

          {/* Aktionen */}
          <div className="flex shrink-0 flex-col gap-1">
            <button
              onClick={() =>
                match.listing && setSelectedListingId(match.listing.id)
              }
              className="rounded-lg bg-gold px-3 py-1 text-xs font-bold text-obsidian"
            >
              Ansehen
            </button>
            <button
              disabled={busyId === match.id}
              onClick={() => dismiss(match.id)}
              className="rounded-lg border border-glass-border px-3 py-1 text-xs text-white/60 disabled:opacity-50"
            >
              Verwerfen
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
