"use client"
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DealFlow } from './DealFlow'
import { CommentSection } from './CommentSection'
import { GesuchMatches } from './GesuchMatches'
import { smartFieldLabel } from '@/lib/gesuchConfig'
import { conditionLabel } from '@/lib/conditionConfig'
import { useMinuteTick, isRecentlyRelisted } from '@/lib/reservation'
import { useAppStore } from '@/store/appStore'
import type { ListingWithProfile } from '@/types'

interface Props {
  listingId?: string
  listing?: ListingWithProfile
  onClose?: () => void
}

export function ListingDetail({ listingId, listing: initialListing, onClose }: Props) {
  const supabase = createClient()
  const currentUser = useAppStore((s) => s.user)
  const [listing, setListing] = useState<ListingWithProfile | null>(initialListing ?? null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const now = useMinuteTick()

  useEffect(() => {
    if (listing) return
    if (!listingId) return
    let mounted = true
    setLoading(true)
    ;(async () => {
      try {
        const { data } = await supabase
          .from('listings')
          .select(`
            *,
            profiles!listings_user_id_fkey ( id, username, avatar_url, avg_rating, level )
          `)
          .eq('id', listingId)
          .single()
        if (mounted) setListing(data)
      } catch (e) {
        console.error('Failed to load listing', e)
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [listingId, listing, supabase])

  // Views GENAU EINMAL pro Detail-Öffnung erhöhen.
  // Guard per Ref auf die Listing-ID – NICHT von `listing` abhängig machen,
  // sonst triggert das eigene setListing() den Effekt erneut (Endlos-Hochzählen).
  const incrementedFor = useRef<string | null>(null)
  useEffect(() => {
    const id = listing?.id
    if (!id) return
    if (incrementedFor.current === id) return
    incrementedFor.current = id

    const base = listing?.views ?? 0
    ;(async () => {
      try {
        const { error } = await supabase
          .from('listings')
          .update({ views: base + 1 })
          .eq('id', id)
        if (error) {
          console.warn('Failed to increment views', error.message)
          return
        }
        // lokal spiegeln (nur wenn noch dasselbe Listing offen ist)
        setListing((l) => (l && l.id === id ? { ...l, views: (l.views ?? 0) + 1 } : l))
      } catch (e) {
        console.error(e)
      }
    })()
    // Absichtlich nur an der ID hängen: pro Öffnung genau eine Erhöhung.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.id, supabase])

  // Ladezustand – im Modal-Overlay, damit man jederzeit schliessen kann.
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-end">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative z-50 w-full rounded-t-3xl bg-obsidian-2 p-10 text-center animate-slide-up">
          <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
          <p className="mt-3 text-sm text-white/50">Inserat wird geladen…</p>
        </div>
      </div>
    )
  }

  // Nicht (mehr) vorhanden – z.B. altes/gelöschtes Inserat. KEIN Endlos-Spinner:
  // klar sagen, was los ist, und schliessbar machen.
  if (!listing) {
    return (
      <div className="fixed inset-0 z-50 flex items-end">
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <div className="relative z-50 w-full rounded-t-3xl bg-obsidian-2 p-8 text-center animate-slide-up">
          <div className="text-4xl">😕</div>
          <p className="mt-3 font-display font-bold text-white">
            Dieses Inserat gibt&apos;s nicht mehr
          </p>
          <p className="mt-1 text-sm text-white/60">
            Vielleicht schon weg oder zurückgezogen — schau dich weiter um im Markt!
          </p>
          <button
            onClick={onClose}
            className="mt-5 rounded-xl border border-glass-border px-6 py-3 font-display font-bold text-white"
          >
            Zurück zum Markt
          </button>
        </div>
      </div>
    )
  }

  const price = listing.price_type === 'free' ? 'Gratis' : `CHF ${(listing.price || 0).toLocaleString('de-CH')}`

  // Block 10: smart_data (Match-Signale) + alle Gemeinden aufbereiten.
  const smart =
    listing.smart_data && typeof listing.smart_data === 'object' && !Array.isArray(listing.smart_data)
      ? (listing.smart_data as Record<string, string | string[] | number>)
      : null
  const smartEntries = smart
    ? Object.entries(smart).filter(
        ([, v]) => v !== null && v !== '' && !(Array.isArray(v) && v.length === 0)
      )
    : []
  const gemeindenList =
    listing.gemeinden && listing.gemeinden.length > 0
      ? listing.gemeinden
      : listing.gemeinde
        ? [listing.gemeinde]
        : []

  const handleShare = async () => {
    const url = `${process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin}/l/${listing.id}`
    if (navigator.share) {
      try { await navigator.share({ title: listing.title, text: listing.description ?? '', url }) } catch {}
    } else {
      await navigator.clipboard.writeText(url)
      // fallback: clipboard copied
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative z-50 w-full max-h-[95dvh] overflow-auto rounded-t-3xl bg-obsidian-2 p-4 animate-slide-up">
        {/* Image gallery */}
        <div className="mb-4 space-y-3">
          <div className="overflow-x-auto flex gap-2 snap-x snap-mandatory pb-2">
            {(listing.image_urls && listing.image_urls.length > 0 ? listing.image_urls : listing.image_url ? [listing.image_url] : []).map((src, i) => (
              <div key={i} className="min-w-full snap-center relative h-[48vh] bg-obsidian-4">
                <Image src={src} alt={listing.title} fill className="object-cover" />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div>
              {listing.status === 'active' &&
                isRecentlyRelisted(listing.relisted_at, now) && (
                  <span
                    data-testid="relisted-badge"
                    className="mb-1 inline-flex items-center gap-1 rounded-full border border-uri-success/50 bg-uri-success/15 px-2.5 py-1 font-display text-xs font-bold text-uri-success"
                  >
                    🔄 Wieder erhältlich!
                  </span>
                )}
              <h2 className="text-2xl font-display font-bold text-white">{listing.title}</h2>
              <div className="mt-1 text-gold text-3xl font-display font-bold">{price}</div>
            </div>
            <div className="text-sm text-white/60">{listing.category}</div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {listing.profiles?.avatar_url && (
              <Image src={listing.profiles.avatar_url} width={48} height={48} alt={listing.profiles.username} className="rounded-full" />
            )}
            <div>
              <div className="font-body font-semibold text-white">{listing.profiles?.username}</div>
              <div className="flex items-center gap-2 text-xs">
                {listing.profiles?.level && (
                  <span className="text-gold font-display">{listing.profiles.level}</span>
                )}
                {/* Verkäufer-Bewertung: Durchschnitt (1 Dezimale). avg_rating ist
                    null/0 solange keine Bewertung existiert → kein erfundener Wert. */}
                <span className="text-white/60" data-testid="seller-rating">
                  ⭐ {(listing.profiles?.avg_rating ?? 0).toFixed(1)}
                </span>
              </div>
            </div>
            <div className="ml-auto text-xs text-white/60">{listing.views ?? 0} views</div>
          </div>

          <div className="prose max-w-none text-white/80">
            <p>
              {expanded ? listing.description : (listing.description ?? '').slice(0, 300)}
            </p>
            {listing.description && listing.description.length > 300 && (
              <button className="mt-2 text-sm text-gold" onClick={() => setExpanded(!expanded)}>
                {expanded ? 'Weniger anzeigen' : 'Mehr anzeigen'}
              </button>
            )}
          </div>

          {/* Block 14: Zustand (kanonisch oder Altwert-Fallback) */}
          {listing.type === 'Angebot' && conditionLabel(listing.condition) && (
            <div
              data-testid="detail-condition"
              className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1.5 text-sm text-white"
            >
              <span className="text-gold">Zustand</span>
              <span className="font-semibold">{conditionLabel(listing.condition)}</span>
            </div>
          )}

          {/* Block 10: alle Gemeinden als Chips */}
          {gemeindenList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {gemeindenList.map((g) => (
                <span
                  key={g}
                  data-testid="detail-gemeinde"
                  className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/80"
                >
                  📍 {g}
                </span>
              ))}
            </div>
          )}

          {/* Block 10: smart_data als 2-Spalten-Grid (Angebot UND Gesuch) */}
          {smartEntries.length > 0 && (
            <div
              data-testid="smart-data-grid"
              className="grid grid-cols-2 gap-3 rounded-xl border border-glass-border bg-obsidian-3 p-3"
            >
              {smartEntries.map(([k, v]) => (
                <div key={k}>
                  <p className="text-xs text-white/50">{smartFieldLabel(listing.category, k)}</p>
                  <p className="text-sm font-semibold text-white">
                    {Array.isArray(v) ? v.join(', ') : String(v)}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* Deal-Flow (Kaufen / Status / Verkäufer-Hinweis) */}
          {listing.type === 'Angebot' && (
            <DealFlow listing={listing} currentUser={currentUser} />
          )}

          {/* 🎯 Matches: nur auf dem EIGENEN Gesuch (RLS sichert zusätzlich own-only) */}
          {listing.type === 'Gesuch' &&
            currentUser?.id === listing.user_id && (
              <GesuchMatches gesuchId={listing.id} userId={currentUser.id} />
            )}

          <div className="flex gap-2">
            <button className="flex-1 rounded-xl border border-glass-border px-4 py-3" onClick={() => {}}>
              {'\u{1F49B}'} Favorit
            </button>
            <button className="rounded-xl border border-glass-border px-4 py-3" onClick={handleShare}>{'\u{1F4E4}'}</button>
          </div>

          {/* Kommentare */}
          <div className="border-t border-glass-border pt-4">
            <CommentSection listingId={listing.id} />
          </div>
        </div>
      </div>
    </div>
  )
}
