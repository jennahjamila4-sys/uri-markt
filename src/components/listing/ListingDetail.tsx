"use client"
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { DealFlow } from './DealFlow'
import { CommentSection } from './CommentSection'
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
            id, title, description, type, status, price, price_type,
            category, gemeinde, image_url, image_urls, is_boosted,
            boost_expires_at, fomo_expires_at, views, created_at, user_id,
            event_date, event_location, max_capacity, current_bookings, ticket_price,
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

  if (loading || !listing) {
    return (
      <div className="p-6 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent mx-auto" />
      </div>
    )
  }

  const price = listing.price_type === 'free' ? 'Gratis' : `CHF ${(listing.price || 0).toLocaleString('de-CH')}`

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
              {listing.profiles?.level && <div className="text-xs text-gold font-display">{listing.profiles.level}</div>}
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

          {/* Deal-Flow (Kaufen / Status / Verkäufer-Hinweis) */}
          {listing.type === 'Angebot' && (
            <DealFlow listing={listing} currentUser={currentUser} />
          )}

          <div className="flex gap-2">
            <button className="flex-1 rounded-xl border border-glass-border px-4 py-3" onClick={() => {}}>
              💛 Favorit
            </button>
            <button className="rounded-xl border border-glass-border px-4 py-3" onClick={handleShare}>📤</button>
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
