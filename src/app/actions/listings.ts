'use server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { AngebotSchema } from '@/lib/validations/listing'
import { GesuchSchema } from '@/lib/validations/onboarding'
import { calculateSmartMatches } from '@/lib/smartMatch'
import type { Database } from '@/types/database'

// Status, in denen ein Inserat noch verändert werden darf. Sobald ein Deal läuft
// (reserved) oder abgeschlossen ist (sold), ist Bearbeiten/Deaktivieren gesperrt.
// 'cancelled' = vom Nutzer deaktiviert/zurückgezogen (aus Feed + Kauf raus).
const EDITABLE_STATUSES = ['active', 'cancelled'] as const

/**
 * Liefert eine präzise, nutzerlesbare Begründung, WARUM eine Verwaltungs-Aktion
 * (Bearbeiten/Deaktivieren/Löschen) am aktuellen Status scheitert (Lektion 6).
 * Wird NUR auf dem Fehlerpfad aufgerufen (Lesabfrage), nachdem der atomare,
 * status-gesicherte Schreibversuch 0 Zeilen getroffen hat.
 */
async function explainBlockedListingAction(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  listingId: string,
  userId: string,
  verb: 'bearbeiten' | 'deaktivieren' | 'reaktivieren' | 'löschen'
): Promise<string> {
  const { data: cur } = await supabase
    .from('listings')
    .select('status, user_id')
    .eq('id', listingId)
    .maybeSingle()

  if (!cur) return 'Inserat nicht gefunden'
  if (cur.user_id !== userId) return 'Nur der Besitzer kann das Inserat verwalten'

  switch (cur.status) {
    case 'reserved':
      return `Reserviert – solange ein Deal läuft, kannst du das Inserat nicht ${verb}.`
    case 'sold':
      return verb === 'löschen'
        ? 'Verkauft – abgeschlossene Inserate bleiben als Nachweis erhalten und lassen sich nicht löschen.'
        : `Verkauft – abgeschlossene Inserate lassen sich nicht mehr ${verb}.`
    case 'cancelled':
      return verb === 'deaktivieren'
        ? 'Das Inserat ist bereits deaktiviert.'
        : `Aktion nicht möglich (Status: deaktiviert).`
    case 'active':
      return verb === 'reaktivieren'
        ? 'Das Inserat ist bereits aktiv.'
        : `Aktion derzeit nicht möglich.`
    default:
      return 'Aktion derzeit nicht möglich.'
  }
}

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
 * Eigenes Inserat bearbeiten. Nur erlaubt, solange KEIN Deal läuft/abgeschlossen
 * ist (Status active oder cancelled). Der Schreibversuch ist atomar über einen
 * Status-Filter abgesichert (kein Read-then-Write-Race): trifft er 0 Zeilen,
 * wird der aktuelle Status frisch gelesen und eine präzise Begründung geworfen.
 * Validierung schema-genau nach Typ (Angebot/Gesuch).
 */
export async function updateListingAction(
  listingId: string,
  listingType: 'Angebot' | 'Gesuch',
  rawData: unknown
) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  // Nur die editierbaren Felder werden gesetzt – NIE user_id/status/type/created_at.
  let patch: Database['public']['Tables']['listings']['Update']

  if (listingType === 'Gesuch') {
    const parsed = GesuchSchema.safeParse(rawData)
    if (!parsed.success) throw new Error('Ungültige Eingaben')
    patch = {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      gemeinde: parsed.data.gemeinde,
      price: parsed.data.max_budget ?? null,
      max_budget: parsed.data.max_budget ?? null,
    }
  } else {
    const parsed = AngebotSchema.safeParse(rawData)
    if (!parsed.success) throw new Error('Ungültige Eingaben')
    patch = {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      condition: parsed.data.condition,
      price_type: parsed.data.price_type,
      price: parsed.data.price_type === 'free' ? null : (parsed.data.price ?? null),
      gemeinde: parsed.data.gemeinde,
      image_urls: parsed.data.image_urls ?? [],
      // Anzeige (ListingCard/Feed/Profil) liest die Singular-Spalte image_url.
      image_url: parsed.data.image_urls?.[0] ?? null,
      pickup_available: parsed.data.pickup_available,
      shipping_available: parsed.data.shipping_available,
      shipping_cost: parsed.data.shipping_cost ?? null,
    }
  }

  const { data: updated, error } = await supabase
    .from('listings')
    .update(patch)
    .eq('id', listingId)
    .eq('user_id', user.id)
    .in('status', EDITABLE_STATUSES as unknown as string[])
    .select('id')

  if (error) throw new Error('Bearbeiten fehlgeschlagen')
  if (!updated || updated.length === 0) {
    throw new Error(
      await explainBlockedListingAction(supabase, listingId, user.id, 'bearbeiten')
    )
  }

  revalidatePath('/')
  revalidatePath('/profile')
}

/**
 * Inserat deaktivieren (active → cancelled) bzw. reaktivieren (cancelled → active).
 * Status-gesicherter atomarer Übergang: läuft ein Deal (reserved) oder ist das
 * Inserat verkauft (sold), schlägt die Aktion mit klarer Begründung fehl.
 */
export async function setListingActiveAction(listingId: string, active: boolean) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  const fromStatus = active ? 'cancelled' : 'active'
  const toStatus = active ? 'active' : 'cancelled'

  const { data: updated, error } = await supabase
    .from('listings')
    .update({ status: toStatus })
    .eq('id', listingId)
    .eq('user_id', user.id)
    .eq('status', fromStatus)
    .select('id')

  if (error) throw new Error('Aktion fehlgeschlagen')
  if (!updated || updated.length === 0) {
    throw new Error(
      await explainBlockedListingAction(
        supabase,
        listingId,
        user.id,
        active ? 'reaktivieren' : 'deaktivieren'
      )
    )
  }

  revalidatePath('/')
  revalidatePath('/profile')
}

/**
 * Inserat löschen. RLS + expliziter user_id-Filter stellen sicher, dass nur der
 * Besitzer löscht. Zusätzlich status-gesichert: ein laufender (reserved) oder
 * abgeschlossener (sold) Deal blockiert das Löschen mit klarer Begründung –
 * so bleibt die Deal-Historie erhalten und keine laufende Reservierung verwaist.
 */
export async function deleteListingAction(listingId: string) {
  const supabase = await createServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  const { data: deleted, error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)
    .eq('user_id', user.id)
    .in('status', EDITABLE_STATUSES as unknown as string[])
    .select('id')

  if (error) throw new Error('Löschen fehlgeschlagen')
  if (!deleted || deleted.length === 0) {
    throw new Error(
      await explainBlockedListingAction(supabase, listingId, user.id, 'löschen')
    )
  }

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
    .update({ dismissed: true })
    .eq('id', matchId)
    .eq('user_id', user.id)

  if (error) throw new Error('Aktion fehlgeschlagen')

  revalidatePath('/profile')
}
