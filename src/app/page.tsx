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
      *,
      profiles!listings_user_id_fkey (
        id, username, avatar_url, avg_rating, level
      )
    `
    )
    .in('status', ['active', 'reserved'])
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
