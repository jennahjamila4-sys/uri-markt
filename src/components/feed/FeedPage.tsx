'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CategoryFilter } from './CategoryFilter'
import { TypeTabs } from './TypeTabs'
import { ListingCard } from './ListingCard'
import { EventCard } from './EventCard'
import { FomoZone } from './FomoZone'
import { TikTokScroll } from './TikTokScroll'
import { useAppStore } from '@/store/appStore'
import type { ListingWithProfile, ListingType } from '@/types'

// Zentrale Spaltenliste für alle Feed-Queries (Initial-Load + loadMore) –
// eine Quelle, damit Grid und Vollbild-Modus garantiert dieselben Felder laden.
const LISTING_SELECT = `
  id, title, description, type, status, price, price_type,
  category, gemeinde, image_url, is_boosted,
  image_urls,
  boost_expires_at, fomo_expires_at, views, created_at, user_id,
  event_date, event_location, max_capacity, current_bookings, ticket_price,
  profiles!listings_user_id_fkey (
    id, username, avatar_url, avg_rating, level
  )
`

interface FeedPageProps {
  initialListings: ListingWithProfile[]
}

export function FeedPage({ initialListings }: FeedPageProps) {
  const supabase = createClient()
  const [listings, setListings] = useState<ListingWithProfile[]>(
    initialListings.filter((l) => l.type === 'Angebot')
  )
  const [selectedType, setSelectedType] = useState<ListingType>('Angebot')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const observerTarget = useRef<HTMLDivElement>(null)
  const [showTikTok, setShowTikTok] = useState(false)
  const setSelectedListingId = useAppStore((s) => s.setSelectedListingId)
  const feedVersion = useAppStore((s) => s.feedVersion)

  // Nächste Seite laden (cursor-basiert). EINE Funktion für Grid-Observer UND
  // Vollbild-Modus (TikTokScroll) – identische Pagination, kein Zweitpfad.
  const loadMore = useCallback(async () => {
    // cursor-Guard: lädt NUR weitere Seiten. Seite 1 lädt ausschließlich der
    // Initial-Load-Effekt. Ohne den Guard würde beim Mount (cursor=null) Seite 1
    // ein zweites Mal angehängt → Inserate doppelt.
    if (isLoading || !hasMore || !cursor) return

    setIsLoading(true)
    try {
      let query = supabase
        .from('listings')
        .select(LISTING_SELECT)
        .in('status', ['active', 'reserved'])
        .eq('type', selectedType)
        .order('is_boosted', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(10)
        .lt('created_at', cursor)

      if (selectedCategory) query = query.eq('category', selectedCategory)

      const { data, error } = await query
      if (!error && data) {
        setListings((prev) => [...prev, ...data])
        if (data.length < 10) {
          setHasMore(false)
        } else if (data.length > 0) {
          setCursor(data[data.length - 1].created_at ?? null)
        }
      }
    } catch (err) {
      console.error('Failed to load more listings:', err)
    } finally {
      setIsLoading(false)
    }
  }, [isLoading, hasMore, cursor, supabase, selectedType, selectedCategory])

  // Infinite scroll (Grid): Observer am Feed-Ende triggert loadMore
  useEffect(() => {
    if (!supabase) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore()
      },
      { threshold: 0.1 }
    )
    if (observerTarget.current) observer.observe(observerTarget.current)
    return () => observer.disconnect()
  }, [loadMore, supabase])

  // Initial load and category change: fetch first page
  useEffect(() => {
    let mounted = true
    ;(async () => {
      setIsLoading(true)
      try {
        let query = supabase
          .from('listings')
          .select(LISTING_SELECT)
          .in('status', ['active', 'reserved'])
          .eq('type', selectedType)
          .order('is_boosted', { ascending: false })
          .order('created_at', { ascending: false })
          .limit(10)

        if (selectedCategory) query = query.eq('category', selectedCategory)

        const { data, error } = await query
        if (!error && data && mounted) {
          setListings(data)
          setHasMore(data.length >= 10)
          setCursor(data.length > 0 ? data[data.length - 1].created_at ?? null : null)
        }
      } catch (err) {
        console.error('Failed to load listings:', err)
      } finally {
        if (mounted) setIsLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
    // feedVersion in den Deps: nach einem neuen Inserat (bumpFeedVersion)
    // wird die erste Seite frisch vom Server geladen – ohne Reload/Logout.
  }, [selectedType, selectedCategory, supabase, feedVersion])

  const handleTypeChange = (type: ListingType) => {
    if (type === selectedType) return
    setSelectedType(type)
    setListings([])
    setCursor(null)
    setHasMore(true)
  }

  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category)
    setListings([])
    setCursor(null)
    setHasMore(true)
  }

  return (
    <div className="space-y-4">
      <TypeTabs value={selectedType} onChange={handleTypeChange} />

      <CategoryFilter
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
      />

      {selectedType === 'Angebot' && !selectedCategory && <FomoZone />}

      <div className="grid grid-cols-2 gap-3 px-3.5 lg:grid-cols-3">
        {listings.map((listing, i) => (
          <div
            key={listing.id}
            className="reveal"
            style={{ animationDelay: `${0.3 + (i % 8) * 0.05}s` }}
          >
            {listing.type === 'Event' ? (
              <EventCard
                listing={listing}
                onClick={() => setSelectedListingId(listing.id)}
              />
            ) : (
              <ListingCard
                listing={listing}
                onClick={() => setSelectedListingId(listing.id)}
              />
            )}
          </div>
        ))}
      </div>

      {listings.length === 0 && !isLoading && (
        <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
          <div className="text-5xl">📦</div>
          <p className="text-white/60">
            Noch keine Inserate in Uri. Sei der Erste!
          </p>
        </div>
      )}

      {listings.length > 0 && (
        <div className="px-4 pt-2">
          <button
            onClick={() => setShowTikTok(true)}
            className="w-full rounded-xl border border-glass-border bg-obsidian-3 py-3 font-display font-bold text-white/80 transition hover:border-gold/40 hover:text-gold"
          >
            📱 Vollbild-Modus
          </button>
        </div>
      )}

      <div ref={observerTarget} className="h-10" />
      {isLoading && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      )}

      {showTikTok && (
        <TikTokScroll
          listings={listings}
          onExit={() => setShowTikTok(false)}
          onLoadMore={loadMore}
          hasMore={hasMore}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
