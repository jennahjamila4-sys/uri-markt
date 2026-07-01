import { createServerClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import { Header } from '@/components/layout/Header'
import { BottomNav } from '@/components/layout/BottomNav'
import { LevelBadge } from '@/components/gamification/LevelBadge'
import {
  PublicListingGrid,
  type PublicListing,
} from '@/components/profile/PublicListingGrid'
import type { UserLevel } from '@/types'

interface Props {
  params: Promise<{ username: string }>
}

/**
 * Öffentliches Profil – zeigt NUR öffentliche Daten.
 * NICHT: Telefon, E-Mail, Taler-Guthaben, Transaktionen.
 */
export default async function PublicProfilePage({ params }: Props) {
  const supabase = createServerClient()
  const { username } = await params

  const { data: profile } = await supabase
    .from('profiles')
    .select('id,username,full_name,avatar_url,gemeinde,level,xp_points,avg_rating,review_count,pioneer_badge')
    .eq('username', username)
    .single()

  if (!profile) notFound()

  const { data: listings } = await supabase
    .from('listings')
    .select('id,title,price,price_type,image_url,status')
    .eq('user_id', profile.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(30)

  return (
    <>
      <Header />
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6 pb-24">
        <div className="flex items-center gap-4">
          <div className="relative h-20 w-20 overflow-hidden rounded-full bg-obsidian-4">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.username}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl">
                👤
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-2xl font-bold text-white">
              {profile.full_name || profile.username}
            </h1>
            <p className="text-sm text-white/60">@{profile.username}</p>
            <div className="mt-1 flex items-center gap-2 text-sm text-white/60">
              <span>⭐ {(profile.avg_rating ?? 0).toFixed(1)}</span>
              <span>·</span>
              <span>{profile.review_count ?? 0} Bewertungen</span>
              {profile.gemeinde && (
                <>
                  <span>·</span>
                  <span>📍 {profile.gemeinde}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <LevelBadge
            level={profile.level as UserLevel | null}
            xp={profile.xp_points ?? 0}
          />
          {profile.pioneer_badge && (
            <span className="rounded-full border border-gold/60 bg-gold/10 px-3 py-2 text-sm font-bold text-gold">
              🏆 Pionier
            </span>
          )}
        </div>

        <div>
          <h2 className="mb-3 font-display text-xl font-bold text-white">
            Aktive Inserate
          </h2>
          <PublicListingGrid listings={(listings ?? []) as PublicListing[]} />
        </div>
      </main>
      <BottomNav />
    </>
  )
}
