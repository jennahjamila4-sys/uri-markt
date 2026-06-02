'use client'
import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { CategoryFilter } from './CategoryFilter'
import { ListingCard } from './ListingCard'
import { useAppStore } from '@/store/appStore'
import type { ListingWithProfile } from '@/types'

interface FeedPageProps {
  initialListings: ListingWithProfile[]
}

export function FeedPage({ initialListings }: FeedPageProps) {
  const supabase = createClient()
  const [listings, setListings] = useState<ListingWithProfile[]>(initialListings)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [cursor, setCursor] = useState<string | null>(null)
  const observerTarget = useRef<HTMLDivElement>(null)
  const setSelectedListingId = useAppStore((s) => s.setSelectedListingId)

  // Infinite scroll
  useEffect(() => {
    if (!supabase) return

    const observer = new IntersectionObserver(
      async (entries) => {
        if (entries[0].isIntersecting && !isLoading && hasMore) {
          setIsLoading(true)
          try {
            let query = supabase
              .from('listings')
              .select(
                `
              id, title, description, type, status, price, price_type,
              category, gemeinde, image_url, is_boosted,
              boost_expires_at, fomo_expires_at, views, created_at, user_id,
              profiles!listings_user_id_fkey (
                id, username, avatar_url, avg_rating, level
              )
            `
              )
              .in('status', ['active', 'sold'])
              .order('is_boosted', { ascending: false })
              .order('created_at', { ascending: false })
              .limit(10)

            if (selectedCategory) {
              query = query.eq('category', selectedCategory)
            }

            if (cursor) {
              query = query.lt('created_at', cursor)
            }

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
        }
      },
      { threshold: 0.1 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [isLoading, hasMore, selectedCategory, cursor, supabase])

  // Initial load and category change: fetch first page
  useEffect(() => {
    let mounted = true
    ;(async () => {
      setIsLoading(true)
      try {
        let query = supabase
          .from('listings')
          .select(
            `
              id, title, description, type, status, price, price_type,
              category, gemeinde, image_url, is_boosted,
              boost_expires_at, fomo_expires_at, views, created_at, user_id,
              profiles!listings_user_id_fkey (
                id, username, avatar_url, avg_rating, level
              )
            `
          )
          .in('status', ['active', 'sold'])
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
  }, [selectedCategory, supabase])

  const handleCategoryChange = (category: string | null) => {
    setSelectedCategory(category)
    setListings([])
    setCursor(null)
    setHasMore(true)
  }

  return (
    <div className="space-y-4">
      <CategoryFilter
        selectedCategory={selectedCategory}
        onCategoryChange={handleCategoryChange}
      />

      <div className="grid gap-4 px-4 sm:grid-cols-2 lg:grid-cols-3">
        {listings.map((listing) => (
          <ListingCard
            key={listing.id}
            listing={listing}
            onClick={() => setSelectedListingId(listing.id)}
          />
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

      <div ref={observerTarget} className="h-10" />
      {isLoading && (
        <div className="flex justify-center py-4">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
        </div>
      )}
    </div>
  )
}
