import { createServerClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { BottomNav } from '@/components/layout/BottomNav'
import { FeedPage } from '@/components/feed/FeedPage'
import { Hero } from '@/components/feed/Hero'

export default async function Home() {
  const supabase = await createServerClient()

  const { data: listings } = await supabase
    .from('listings')
    .select(
      `
      id, title, description, type, status, price, price_type,
      category, gemeinde, image_url, image_urls, is_boosted,
      boost_expires_at, fomo_expires_at, views, created_at, user_id,
      event_date, event_location, max_capacity, current_bookings, ticket_price,
      profiles!listings_user_id_fkey (
        id, username, avatar_url, avg_rating, level
      )
    `
    )
    .in('status', ['active', 'reserved', 'sold'])
    .order('is_boosted', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(20)

  return (
    <>
      <Header />
      <main className="pb-24">
        <Hero />
        <FeedPage initialListings={listings ?? []} />
      </main>
      <BottomNav />
    </>
  )
}
