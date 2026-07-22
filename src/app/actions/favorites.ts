'use server'

import { createServerClient } from '@/lib/supabase/server'

/**
 * Herz umschalten (Tabelle `favorites`). SICHERHEIT: user_id kommt IMMER
 * server-seitig aus der Session (`auth.uid()`), NIE vom Client (kritische Regel 1).
 * Idempotent: existiert der Favorit → löschen; sonst anlegen. Die UNIQUE-
 * Constraint (user_id, listing_id) fängt Doppel-Taps ab; ein 23505 beim Insert
 * wird als „bereits favorisiert" behandelt (favorited: true), nicht geworfen.
 * RLS lässt ohnehin nur eigene Zeilen zu — die Server-Prüfung ist die erste Wand.
 */
export async function toggleFavoriteAction(
  listingId: unknown
): Promise<{ favorited: boolean }> {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  if (typeof listingId !== 'string' || !/^[0-9a-f-]{36}$/i.test(listingId)) {
    throw new Error('Ungültige Inserat-ID')
  }

  // Ist es bereits favorisiert? (own-only via RLS)
  const { data: existing, error: selErr } = await supabase
    .from('favorites')
    .select('id')
    .eq('user_id', user.id)
    .eq('listing_id', listingId)
    .maybeSingle()

  if (selErr) {
    console.error('[toggleFavorite:select]', selErr)
    throw new Error('Favorit konnte nicht geprüft werden')
  }

  if (existing) {
    const { error: delErr } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('listing_id', listingId)
    if (delErr) {
      console.error('[toggleFavorite:delete]', delErr)
      throw new Error('Favorit konnte nicht entfernt werden')
    }
    return { favorited: false }
  }

  const { error: insErr } = await supabase
    .from('favorites')
    .insert({ user_id: user.id, listing_id: listingId })

  if (insErr) {
    // 23505 = UNIQUE-Verletzung (paralleler Doppel-Tap) → bereits favorisiert.
    if (insErr.code === '23505') return { favorited: true }
    console.error('[toggleFavorite:insert]', insErr)
    throw new Error('Favorit konnte nicht gespeichert werden')
  }

  return { favorited: true }
}
