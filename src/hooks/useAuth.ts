'use client'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/appStore'
import type { Profile } from '@/types'

export function useAuth() {
  const user = useAppStore((s) => s.user)
  const setUser = useAppStore((s) => s.setUser)

  useEffect(() => {
    const supabase = createClient()
    // Initial user load
    supabase.auth.getUser().then(({ data: { user: u }, error: getUserErr }) => {
      // [AUTH-DIAG] TEMP (D1) – nach Beweis wieder entfernen. Lektion 7:
      // Fehler ≠ leeres Ergebnis ≠ nicht eingeloggt sauber trennen.
      console.log('[AUTH-DIAG] initial getUser →', {
        hasUser: !!u,
        userId: u?.id ?? null,
        getUserError: getUserErr ? { name: getUserErr.name, message: getUserErr.message, status: (getUserErr as { status?: number }).status } : null,
      })
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
        .then(({ data, error, status }) => {
          console.log('[AUTH-DIAG] initial profiles.single() →', {
            httpStatus: status,
            error: error ? { code: error.code, message: error.message, details: error.details, hint: error.hint } : null,
            dataIsNull: data == null,
            data,
          })
          setUser(data as Profile | null)
        })
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('[AUTH-DIAG] onAuthStateChange →', {
          event,
          hasSession: !!session,
          hasSessionUser: !!session?.user,
          userId: session?.user?.id ?? null,
        })
        if (!session?.user) {
          setUser(null)
          return
        }
        const { data, error, status } = await supabase
          .from('profiles')
          .select(
            'id,username,full_name,avatar_url,gemeinde,xp_points,level,credits,avg_rating,review_count,pioneer_badge,strikes,is_banned,can_buy,referral_code,preferred_categories'
          )
          .eq('id', session.user.id)
          .single()
        console.log('[AUTH-DIAG] onAuthStateChange profiles.single() →', {
          event,
          httpStatus: status,
          error: error ? { code: error.code, message: error.message, details: error.details, hint: error.hint } : null,
          dataIsNull: data == null,
          data,
        })
        setUser(data as Profile | null)
      }
    )
    return () => subscription.unsubscribe()
  }, [setUser])

  const signOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    setUser(null)
  }

  return { user, signOut }
}
