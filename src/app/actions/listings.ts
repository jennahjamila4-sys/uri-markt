'use server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { AngebotSchema } from '@/lib/validations/listing'
import { GesuchSchema } from '@/lib/validations/onboarding'
import type { Database } from '@/types/database'

export async function createListingAction(rawData: unknown) {
  const supabase = createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  const validated = AngebotSchema.safeParse(rawData)
  if (!validated.success) throw new Error('Ungültige Eingaben')

  const insertData: Database['public']['Tables']['listings']['Insert'] = {
    ...validated.data,
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
  const supabase = createServerClient()

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

    // Calculate smart matches
    // TODO: Implement via RPC or use direct DB query
    // await calculateSmartMatches(listing.id, supabase)

    revalidatePath('/')
    revalidatePath('/profile')

    return { id: listing.id, title: listing.title }
  } catch (err) {
    console.error('[createGesuch]', err)
    throw err
  }
}
