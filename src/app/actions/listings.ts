'use server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { AngebotSchema } from '@/lib/validations/listing'
import { GesuchSchema } from '@/lib/validations/onboarding'
import { calculateSmartMatches } from '@/lib/smartMatch'
import type { Database } from '@/types/database'

export async function createListingAction(rawData: unknown) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  const validated = AngebotSchema.safeParse(rawData)
  if (!validated.success) throw new Error('Ungültige Eingaben')

  const insertData: Database['public']['Tables']['listings']['Insert'] = {
    ...validated.data,
    // Anzeige (ListingCard/Feed/Profil) liest die Singular-Spalte image_url;
    // das Formular lädt Bilder als image_urls[]. Erstes Bild spiegeln.
    image_url: validated.data.image_urls?.[0] ?? null,
    user_id: user.id,
    type: 'Angebot',
    status: 'active',
  }

  const { data: listing, error } = await supabase
    .from('listings')
    .insert([insertData])
    .select('id, title')
    .single()

  if (error) throw new Error('Inserat konnte nicht erstellt werden')

  // Award XP for listing creation
  await supabase.rpc('award_xp', {
    p_user_id: user.id,
    p_amount: 10,
    p_reason: 'Angebot erstellt',
    p_idempotency_key: `listing_created_${listing.id}`,
  })

  revalidatePath('/')
  return { id: listing.id, title: listing.title }
}

/**
 * Create Gesuch (wish/request) listing
 * Triggers Smart Match calculation automatically
 */
export async function createGesuchAction(rawData: unknown) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  const validated = GesuchSchema.safeParse(rawData)
  if (!validated.success) throw new Error('Ungültige Eingaben')

  try {
    // Create Gesuch listing
    const { data: listing, error: insertError } = await supabase
      .from('listings')
      .insert({
        user_id: user.id,
        title: validated.data.title,
        description: validated.data.description,
        type: 'Gesuch',
        status: 'active',
        category: validated.data.category,
        gemeinde: validated.data.gemeinde,
        price: validated.data.max_budget || null,
        price_type: 'fixed',
      })
      .select('id, title')
      .single()

    if (insertError) throw insertError

    // Award XP
    await supabase.rpc('award_xp', {
      p_user_id: user.id,
      p_amount: 10,
      p_reason: 'Gesuch erstellt',
      p_idempotency_key: `gesuch_created_${listing.id}`,
    })

    // Smart Matches berechnen (regelbasiert)
    await calculateSmartMatches(listing.id)

    revalidatePath('/')
    revalidatePath('/profile')

    return { id: listing.id, title: listing.title }
  } catch (err) {
    console.error('[createGesuch]', err)
    throw err
  }
}

/**
 * Inserat löschen – RLS stellt sicher, dass nur der Besitzer löschen kann
 */
export async function deleteListingAction(listingId: string) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)
    .eq('user_id', user.id)

  if (error) throw new Error('Löschen fehlgeschlagen')

  revalidatePath('/')
  revalidatePath('/profile')
}

/**
 * Smart Match verwerfen (dismissed=true) – RLS schützt über user_id
 */
export async function dismissMatchAction(matchId: string) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  const { error } = await supabase
    .from('smart_matches')
    .update({ dismissed: true, dismissed_at: new Date().toISOString() })
    .eq('id', matchId)
    .eq('user_id', user.id)

  if (error) throw new Error('Aktion fehlgeschlagen')

  revalidatePath('/profile')
}
