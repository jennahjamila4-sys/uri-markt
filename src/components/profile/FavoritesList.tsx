'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Heart } from 'lucide-react'
import { toast } from 'sonner'
import { useAppStore } from '@/store/appStore'
import { toggleFavoriteAction } from '@/app/actions/favorites'

export interface FavoriteItem {
  id: string
  title: string
  status: string
  price: number | null
  price_type: string
  type: string
  image_url: string | null
  gemeinde: string
}

interface Props {
  favorites: FavoriteItem[]
}

// Status-Sticker (ehrlich: zeigt den aktuellen Zustand des favorisierten Inserats).
const STATUS: Record<string, { label: string; cls: string }> = {
  active: { label: 'Aktiv', cls: 'bg-uri-success/20 text-uri-success' },
  reserved: { label: 'Reserviert', cls: 'bg-amber-500/20 text-amber-400' },
  sold: { label: 'Verkauft', cls: 'bg-uri-fomo/20 text-uri-fomo' },
  cancelled: { label: 'Deaktiviert', cls: 'bg-white/10 text-white/60' },
  draft: { label: 'Entwurf', cls: 'bg-white/10 text-white/60' },
}

export function FavoritesList({ favorites }: Props) {
  const [items, setItems] = useState(favorites)
  const [busyId, setBusyId] = useState<string | null>(null)
  const setSelectedListingId = useAppStore((s) => s.setSelectedListingId)

  const remove = async (id: string) => {
    if (busyId) return
    setBusyId(id)
    // optimistisch entfernen
    const prev = items
    setItems((cur) => cur.filter((f) => f.id !== id))
    try {
      await toggleFavoriteAction(id)
    } catch (err) {
      setItems(prev) // zurückrollen
      toast.error(err instanceof Error ? err.message : 'Konnte nicht entfernen')
    } finally {
      setBusyId(null)
    }
  }

  if (items.length === 0) {
    return (
      <div
        data-testid="favorites-empty"
        className="rounded-xl border border-glass-border bg-obsidian-3 p-6 text-center"
      >
        <div className="mb-2 text-4xl">🤍</div>
        <p className="text-white/60">
          Noch keine Favoriten. Tippe auf ein Herz, um Dinge zu merken, die dir gefallen — so
          verlierst du nichts aus den Augen.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2" data-testid="favorites-list">
      {items.map((f) => {
        const price =
          f.price_type === 'free'
            ? 'Gratis'
            : `CHF ${(f.price ?? 0).toLocaleString('de-CH')}`
        const sticker = STATUS[f.status] ?? {
          label: f.status,
          cls: 'bg-white/10 text-white/60',
        }
        return (
          <div
            key={f.id}
            data-testid="favorite-row"
            className="flex items-center gap-3 rounded-xl border border-glass-border bg-obsidian-3 p-3"
          >
            <button
              onClick={() => setSelectedListingId(f.id)}
              className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-obsidian-4"
            >
              {f.image_url ? (
                <Image src={f.image_url} alt={f.title} fill className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xl">
                  📦
                </span>
              )}
            </button>

            <button
              onClick={() => setSelectedListingId(f.id)}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate font-semibold text-white">{f.title}</p>
              <div className="mt-0.5 flex items-center gap-2 text-xs">
                <span className={`rounded-full px-2 py-0.5 ${sticker.cls}`}>
                  {sticker.label}
                </span>
                <span className="text-gold">{price}</span>
              </div>
            </button>

            <button
              onClick={() => remove(f.id)}
              disabled={busyId === f.id}
              aria-label="Aus Favoriten entfernen"
              data-testid="favorite-remove-btn"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-glass-border transition hover:border-uri-danger/50 disabled:opacity-50"
            >
              <Heart size={16} className="fill-uri-danger text-uri-danger" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
