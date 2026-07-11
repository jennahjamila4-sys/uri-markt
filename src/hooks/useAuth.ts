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

    // Auth-Zustand ueber onAuthStateChange fuehren: der Callback feuert direkt
    // nach dem Abo `INITIAL_SESSION` mit der gespeicherten Session (kein separater,
    // netzabhaengiger getUser()-Aufruf, der beim Seitenaufbau transient fehlschlagen
    // und eine gueltige Session faelschlich auf null kippen wuerde – Lektion 7).
    //
    // WICHTIG (Root-Cause Session-Verlust nach Navigation): KEINE awaited
    // supabase-Aufrufe DIREKT im Callback. supabase-js haelt waehrend des Callbacks
    // den Auth-Lock (navigator.locks); ein PostgREST-Aufruf braucht intern
    // getSession() → denselben Lock → DEADLOCK, die Profil-Query loest nie auf und
    // der Nutzer wirkt nach der Navigation ausgeloggt. Deshalb wird das Laden der
    // Profildaten mit setTimeout(0) aus dem Callback herausgeschoben (offizielle
    // Supabase-Empfehlung).
    const loadProfile = (userId: string) => {
      setTimeout(async () => {
        const { data, error } = await supabase
          .from('profiles')
          .select(
            'id,username,full_name,avatar_url,gemeinde,xp_points,level,credits,avg_rating,review_count,pioneer_badge,strikes,is_banned,can_buy,referral_code,preferred_categories'
          )
          .eq('id', userId)
          .single()
        // Lektion 7: Query-Fehler (RLS/Netz) NICHT als „ausgeloggt" behandeln.
        if (error) {
          console.warn('[useAuth] Profil-Query fehlgeschlagen:', error.code, error.message)
          return
        }
        setUser((data as Profile | null) ?? null)
      }, 0)
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session?.user) {
          setUser(null)
          return
        }
        loadProfile(session.user.id)
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
