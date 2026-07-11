'use client'

import { useState } from 'react'
import Image from 'next/image'
import { toast } from 'sonner'
import {
  deleteListingAction,
  setListingActiveAction,
} from '@/app/actions/listings'
import { useAppStore } from '@/store/appStore'
import { EditListingModal } from './EditListingModal'

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
  { key: 'cancelled', label: 'Deaktiviert' },
] as const

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-uri-success/20 text-uri-success',
  reserved: 'bg-amber-500/20 text-amber-400',
  sold: 'bg-uri-fomo/20 text-uri-fomo',
  cancelled: 'bg-white/10 text-white/60',
}

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktiv',
  reserved: 'Reserviert',
  sold: 'Abgeschlossen',
  cancelled: 'Deaktiviert',
}

// Verwaltbar = editierbar/löschbar/deaktivierbar. Bei reserved/sold gesperrt.
const MANAGEABLE = new Set(['active', 'cancelled'])

// Warum eine Verwaltung gesperrt ist – sichtbar am UI (Lektion 6).
function blockedReason(status: string): string | null {
  if (status === 'reserved') return 'Reserviert – solange ein Deal läuft, gesperrt.'
  if (status === 'sold') return 'Verkauft – abgeschlossen, nicht mehr veränderbar.'
  return null
}

export function MyListings({ listings }: Props) {
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('active')
  const [items, setItems] = useState(listings)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [editItem, setEditItem] = useState<MyListingItem | null>(null)
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
      setConfirmId(null)
    }
  }

  const handleToggleActive = async (item: MyListingItem) => {
    const activate = item.status === 'cancelled'
    setBusyId(item.id)
    try {
      await setListingActiveAction(item.id, activate)
      const newStatus = activate ? 'active' : 'cancelled'
      setItems((prev) =>
        prev.map((l) => (l.id === item.id ? { ...l, status: newStatus } : l))
      )
      toast.success(activate ? 'Inserat reaktiviert ✅' : 'Inserat deaktiviert')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Aktion fehlgeschlagen')
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
          {filtered.map((listing) => {
            const reason = blockedReason(listing.status)
            const canManage = MANAGEABLE.has(listing.status)
            const canEdit = canManage && (listing.type === 'Angebot' || listing.type === 'Gesuch')
            const busy = busyId === listing.id
            return (
              <div
                key={listing.id}
                data-testid="my-listing-row"
                className="rounded-xl border border-glass-border bg-obsidian-3 p-3"
              >
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedListingId(listing.id)}
                    className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-obsidian-4"
                  >
                    {listing.image_url && (
                      <Image src={listing.image_url} alt={listing.title} fill className="object-cover" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-white" data-testid="my-listing-title">
                      {listing.title}
                    </p>
                    <div className="mt-0.5 flex items-center gap-2 text-xs">
                      <span className={`rounded-full px-2 py-0.5 ${STATUS_BADGE[listing.status] ?? 'bg-white/10 text-white/60'}`}>
                        {STATUS_LABEL[listing.status] ?? listing.status}
                      </span>
                      <span className="text-white/40">👁 {listing.views ?? 0}</span>
                    </div>
                  </div>
                </div>

                {/* Aktionen */}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {canEdit && (
                    <button
                      onClick={() => setEditItem(listing)}
                      disabled={busy}
                      data-testid="listing-edit-btn"
                      className="rounded-lg border border-glass-border px-3 py-1.5 text-xs text-white/80 transition hover:border-gold/60 hover:text-gold disabled:opacity-50"
                    >
                      Bearbeiten
                    </button>
                  )}

                  {canManage && (
                    <button
                      onClick={() => handleToggleActive(listing)}
                      disabled={busy}
                      data-testid="listing-toggle-active-btn"
                      className="rounded-lg border border-glass-border px-3 py-1.5 text-xs text-white/80 transition hover:border-white/30 disabled:opacity-50"
                    >
                      {listing.status === 'cancelled' ? 'Reaktivieren' : 'Deaktivieren'}
                    </button>
                  )}

                  {canManage &&
                    (confirmId === listing.id ? (
                      <span className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(listing.id)}
                          disabled={busy}
                          data-testid="listing-delete-confirm-btn"
                          className="rounded-lg bg-uri-danger px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                        >
                          {busy ? 'Löscht…' : 'Wirklich löschen'}
                        </button>
                        <button
                          onClick={() => setConfirmId(null)}
                          disabled={busy}
                          className="rounded-lg border border-glass-border px-3 py-1.5 text-xs text-white/60"
                        >
                          Abbrechen
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmId(listing.id)}
                        disabled={busy}
                        data-testid="listing-delete-btn"
                        className="rounded-lg border border-glass-border px-3 py-1.5 text-xs text-white/60 transition hover:border-uri-danger/60 hover:text-uri-danger disabled:opacity-50"
                      >
                        Löschen
                      </button>
                    ))}

                  {/* Gesperrt (reserved/sold): sichtbar WARUM (Lektion 6) */}
                  {reason && (
                    <span
                      data-testid="listing-blocked-reason"
                      className="text-xs text-white/50"
                    >
                      🔒 {reason}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {editItem && (
        <EditListingModal
          listingId={editItem.id}
          listingType={editItem.type === 'Gesuch' ? 'Gesuch' : 'Angebot'}
          onSaved={({ title }) => {
            setItems((prev) =>
              prev.map((l) => (l.id === editItem.id ? { ...l, title } : l))
            )
          }}
          onClose={() => setEditItem(null)}
        />
      )}
    </div>
  )
}
