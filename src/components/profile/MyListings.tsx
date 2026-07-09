'use client'

import { useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import { deleteListingAction } from '@/app/actions/listings'
import { useAppStore } from '@/store/appStore'

export interface MyListingItem {
  id: string
  title: string
  status: string
  price: number | null
  type: string
  created_at: string | null
  image_url: string | null
  views: number | null
}

interface Props {
  listings: MyListingItem[]
}

const TABS = [
  { key: 'active', label: 'Aktiv' },
  { key: 'reserved', label: 'Reserviert' },
  { key: 'sold', label: 'Verkauft' },
  { key: 'draft', label: 'Entwürfe' },
] as const

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-uri-success/20 text-uri-success',
  reserved: 'bg-amber-500/20 text-amber-400',
  sold: 'bg-uri-fomo/20 text-uri-fomo',
  draft: 'bg-white/10 text-white/60',
}

// Deutsche Status-Labels (Soll-Verhalten Block 2): kein roher Enum-Wert im UI
const STATUS_LABEL: Record<string, string> = {
  active: 'Aktiv',
  reserved: 'Reserviert',
  sold: 'Abgeschlossen',
  draft: 'Entwurf',
}

export function MyListings({ listings }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('active')
  const [items, setItems] = useState(listings)
  const [busyId, setBusyId] = useState<string | null>(null)
  const setSelectedListingId = useAppStore((s) => s.setSelectedListingId)

  const filtered = items.filter((l) => l.status === tab)

  const handleDelete = async (id: string) => {
    setBusyId(id)
    try {
      await deleteListingAction(id)
      setItems((prev) => prev.filter((l) => l.id !== id))
      toast.success('Inserat gelöscht')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-display font-bold transition ${
              tab === t.key
                ? 'bg-gold text-obsidian'
                : 'border border-glass-border text-white/60'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-glass-border bg-obsidian-3 p-6 text-center">
          <p className="text-white/60">Keine Inserate in dieser Kategorie.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((listing) => (
            <div
              key={listing.id}
              className="flex items-center gap-3 rounded-xl border border-glass-border bg-obsidian-3 p-3"
            >
              <button
                onClick={() => setSelectedListingId(listing.id)}
                className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-obsidian-4"
              >
                {listing.image_url && (
                  <Image
                    src={listing.image_url}
                    alt={listing.title}
                    fill
                    className="object-cover"
                  />
                )}
              </button>
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-white">
                  {listing.title}
                </p>
                <div className="mt-0.5 flex items-center gap-2 text-xs">
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      STATUS_BADGE[listing.status] ?? 'bg-white/10 text-white/60'
                    }`}
                  >
                    {STATUS_LABEL[listing.status] ?? listing.status}
                  </span>
                  <span className="text-white/40">👁 {listing.views ?? 0}</span>
                </div>
              </div>
              <button
                disabled={busyId === listing.id}
                onClick={() => handleDelete(listing.id)}
                className="shrink-0 rounded-lg border border-glass-border px-3 py-1.5 text-xs text-white/60 transition hover:border-uri-danger/60 hover:text-uri-danger disabled:opacity-50"
              >
                Löschen
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
