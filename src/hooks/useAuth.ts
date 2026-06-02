'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'

export function useAuth() {
  const supabase = createClient()
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)

  useEffect(() => {
    // Initial user load
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (!u) {
        setUser(null)
        return
      }
      supabase
        .from('profiles')
        .select(
          'id,username,full_name,avatar_url,gemeinde,xp_points,level,credits,avg_rating,review_count,pioneer_badge,strikes,is_banned,can_buy,referral_code,preferred_categories'
        )
        .eq('id', u.id)
        .single()
        .then(({ data }) => setUser(data))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session?.user) {
          setUser(null)
          return
        }
        const { data } = await supabase
          .from('profiles')
          .select(
            'id,username,full_name,avatar_url,gemeinde,xp_points,level,credits,avg_rating,review_count,pioneer_badge,strikes,is_banned,can_buy,referral_code,preferred_categories'
          )
          .eq('id', session.user.id)
          .single()
        setUser(data)
      }
    )
    return () => subscription.unsubscribe()
  }, [setUser, supabase])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
  }

  return { user, signOut }
}
