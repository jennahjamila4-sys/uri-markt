'use server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { AngebotSchema } from '@/lib/validations/listing'
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

  revalidatePath('/')
  return { id: listing.id, title: listing.title }
}
