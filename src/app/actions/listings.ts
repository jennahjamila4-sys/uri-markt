'use server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { AngebotSchema } from '@/lib/validations/listing'
import { GesuchSchema } from '@/lib/validations/onboarding'
import { CATEGORIES } from '@/types'
import { CLAUDE_MODEL_FAST } from '@/lib/ai'
import type { Database } from '@/types/database'

type SmartDataInsert = Database['public']['Tables']['listings']['Insert']['smart_data']

/**
 * Smart-Match-Berechnung anstossen (Edge Function `calculate-smart-matches`,
 * matcht beide Richtungen: Gesuch→Angebote und Angebot→Gesuche).
 * Fire-and-forget: Ein Fehler wird geloggt, die Veröffentlichung schlägt
 * dadurch NIEMALS fehl und der Fehler wird nicht uminterpretiert (Lektion 7).
 */
async function triggerSmartMatches(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  listingId: string
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke('calculate-smart-matches', {
      body: { listing_id: listingId },
    })
    if (error) {
      console.error('[triggerSmartMatches]', listingId, error)
    }
  } catch (err) {
    console.error('[triggerSmartMatches]', listingId, err)
  }
}

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

  // Block 10: eine oder mehrere Gemeinden. gemeinde = erste (Kompatibilität mit
  // Feed/Karte), gemeinden = alle. Fallback auf die primäre gemeinde.
  const gemeinden =
    validated.data.gemeinden && validated.data.gemeinden.length > 0
      ? validated.data.gemeinden
      : [validated.data.gemeinde]

  const insertData: Database['public']['Tables']['listings']['Insert'] = {
    ...validated.data,
    gemeinde: gemeinden[0],
    gemeinden,
    // Block 10: nur befüllte Match-Signale (das Formular entfernt leere Keys).
    smart_data: (validated.data.smart_data ?? null) as Database['public']['Tables']['listings']['Insert']['smart_data'],
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

  // Angebot→Gesuche matchen (fire-and-forget, blockiert nie)
  await triggerSmartMatches(supabase, listing.id)

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

  const gemeinden =
    validated.data.gemeinden && validated.data.gemeinden.length > 0
      ? validated.data.gemeinden
      : [validated.data.gemeinde]

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
        gemeinde: gemeinden[0],
        gemeinden,
        // Block 10: kategorie-spezifische Match-Signale (jsonb).
        smart_data: (validated.data.smart_data ?? null) as Database['public']['Tables']['listings']['Insert']['smart_data'],
        price: validated.data.max_budget || null,
        // Edge Function calculate-smart-matches liest max_budget (Budget-Scoring)
        max_budget: validated.data.max_budget || null,
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

    // Gesuch→Angebote matchen (Edge Function, fire-and-forget, blockiert nie)
    await triggerSmartMatches(supabase, listing.id)

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

// ============================================================================
// BLOCK 10 — Entwürfe (Drafts) + KI-Kategorie-Fallback
// ============================================================================

/**
 * Entwurf: bewusst permissiv. Einzige harte Anforderung ist ein Titel (≥3).
 * NOT-NULL-Spalten ohne Nutzereingabe werden als Leerstring/Default gespeichert
 * (category ''/gemeinde '' erfüllen NOT NULL; price_type default 'fixed';
 * gemeinden default []). Kein triggerSmartMatches — ein Entwurf matcht nie.
 */
const DraftSchema = z.object({
  type: z.enum(['Angebot', 'Gesuch']),
  title: z.string().min(3, 'Titel muss mindestens 3 Zeichen lang sein').max(150),
  category: z.string().optional(),
  description: z.string().max(2000).optional(),
  condition: z.enum(['new', 'like_new', 'good', 'acceptable']).optional(),
  price_type: z.enum(['fixed', 'vhb', 'free', 'auction']).optional(),
  price: z.number().min(0).optional(),
  max_budget: z.number().min(0).optional(),
  gemeinde: z.string().optional(),
  gemeinden: z.array(z.string()).optional(),
  smart_data: z
    .record(z.string(), z.union([z.string(), z.array(z.string()), z.number()]))
    .optional(),
  image_urls: z.array(z.string().url()).max(5).optional(),
})

export async function saveDraftAction(rawData: unknown) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  const parsed = DraftSchema.safeParse(rawData)
  if (!parsed.success) {
    throw new Error(parsed.error.errors[0]?.message ?? 'Titel fehlt (mind. 3 Zeichen)')
  }
  const d = parsed.data
  const gemeinden = d.gemeinden ?? (d.gemeinde ? [d.gemeinde] : [])

  const insertData: Database['public']['Tables']['listings']['Insert'] = {
    user_id: user.id,
    type: d.type,
    status: 'draft',
    title: d.title,
    // NOT-NULL erfüllen; Entwurf darf unvollständig sein.
    category: d.category ?? '',
    gemeinde: gemeinden[0] ?? '',
    gemeinden,
    price_type: d.price_type ?? 'fixed',
    price: d.type === 'Gesuch' ? (d.max_budget ?? null) : (d.price ?? null),
    max_budget: d.type === 'Gesuch' ? (d.max_budget ?? null) : null,
    condition: d.type === 'Angebot' ? (d.condition ?? null) : null,
    description: d.description ?? null,
    smart_data: (d.smart_data ?? null) as SmartDataInsert,
    image_urls: d.image_urls ?? [],
    image_url: d.image_urls?.[0] ?? null,
  }

  const { data: draft, error } = await supabase
    .from('listings')
    .insert([insertData])
    .select('id, title')
    .single()

  if (error) throw new Error('Entwurf konnte nicht gespeichert werden')

  revalidatePath('/profile')
  return { id: draft.id, title: draft.title }
}

/**
 * Entwurf veröffentlichen: vollständige Validierung nach Typ; Übergang
 * status draft → active ist atomar über den Status-Filter abgesichert.
 * WICHTIG (Lektion 1): Nach erfolgreicher Veröffentlichung wird
 * triggerSmartMatches aufgerufen — sonst matcht ein veröffentlichter Entwurf nie.
 */
export async function publishDraftAction(draftId: string, rawData: unknown) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  // Typ des Entwurfs frisch aus der DB lesen (nicht dem Client vertrauen).
  const { data: existing } = await supabase
    .from('listings')
    .select('type, status, user_id')
    .eq('id', draftId)
    .maybeSingle()
  if (!existing) throw new Error('Entwurf nicht gefunden')
  if (existing.user_id !== user.id) throw new Error('Nur der Besitzer kann veröffentlichen')
  if (existing.status !== 'draft') throw new Error('Dieses Inserat ist kein Entwurf mehr')

  let patch: Database['public']['Tables']['listings']['Update']

  if (existing.type === 'Gesuch') {
    const parsed = GesuchSchema.safeParse(rawData)
    if (!parsed.success) throw new Error('Ungültige Eingaben')
    const gemeinden =
      parsed.data.gemeinden && parsed.data.gemeinden.length > 0
        ? parsed.data.gemeinden
        : [parsed.data.gemeinde]
    patch = {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      gemeinde: gemeinden[0],
      gemeinden,
      smart_data: (parsed.data.smart_data ?? null) as SmartDataInsert,
      price: parsed.data.max_budget ?? null,
      max_budget: parsed.data.max_budget ?? null,
      price_type: 'fixed',
      status: 'active',
    }
  } else {
    const parsed = AngebotSchema.safeParse(rawData)
    if (!parsed.success) throw new Error('Ungültige Eingaben')
    const gemeinden =
      parsed.data.gemeinden && parsed.data.gemeinden.length > 0
        ? parsed.data.gemeinden
        : [parsed.data.gemeinde]
    patch = {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      category: parsed.data.category,
      condition: parsed.data.condition,
      price_type: parsed.data.price_type,
      price: parsed.data.price_type === 'free' ? null : (parsed.data.price ?? null),
      gemeinde: gemeinden[0],
      gemeinden,
      smart_data: (parsed.data.smart_data ?? null) as SmartDataInsert,
      image_urls: parsed.data.image_urls ?? [],
      image_url: parsed.data.image_urls?.[0] ?? null,
      pickup_available: parsed.data.pickup_available,
      shipping_available: parsed.data.shipping_available,
      shipping_cost: parsed.data.shipping_cost ?? null,
      status: 'active',
    }
  }

  const { data: updated, error } = await supabase
    .from('listings')
    .update(patch)
    .eq('id', draftId)
    .eq('user_id', user.id)
    .eq('status', 'draft')
    .select('id')

  if (error) throw new Error('Veröffentlichen fehlgeschlagen')
  if (!updated || updated.length === 0) {
    throw new Error('Entwurf konnte nicht veröffentlicht werden (nicht mehr Entwurf?)')
  }

  // Lektion 1: neuer Codepfad zum Veröffentlichen → Matches JETZT anstossen.
  await triggerSmartMatches(supabase, draftId)

  revalidatePath('/')
  revalidatePath('/profile')
  return { id: draftId }
}

/**
 * Entwurf löschen. Nur eigener Entwurf (status='draft'); aktive/laufende
 * Inserate werden hier bewusst NICHT angefasst (dafür gilt deleteListingAction).
 */
export async function deleteDraftAction(draftId: string) {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  const { data: deleted, error } = await supabase
    .from('listings')
    .delete()
    .eq('id', draftId)
    .eq('user_id', user.id)
    .eq('status', 'draft')
    .select('id')

  if (error) throw new Error('Löschen fehlgeschlagen')
  if (!deleted || deleted.length === 0) {
    throw new Error('Entwurf nicht gefunden')
  }

  revalidatePath('/profile')
}

/**
 * KI-Kategorie-Fallback: nur wenn die lokale Keyword-Erkennung nichts fand.
 * Nutzt CLAUDE_MODEL_FAST (src/lib/ai.ts). Nie blockierend — jeder Fehler wird
 * geloggt und als { category: null } zurückgegeben (Lektion 7: kein Swallowing,
 * aber ein KI-Ausfall darf das Formular nie brechen).
 */
export async function suggestCategoryAction(
  text: string
): Promise<{ category: string | null }> {
  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (!user || authError) return { category: null }

  const clean = (text ?? '').trim()
  if (clean.length < 15) return { category: null }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[suggestCategory] ANTHROPIC_API_KEY fehlt')
    return { category: null }
  }

  const list = CATEGORIES.map((c) => `${c.id} = ${c.label}`).join('\n')

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL_FAST,
        max_tokens: 12,
        messages: [
          {
            role: 'user',
            content: `Ordne den Text genau einer Kategorie-ID zu. Antworte NUR mit der ID (kleingeschrieben) oder mit "none", wenn nichts klar passt.\n\nKategorien:\n${list}\n\nText: ${clean.slice(0, 200)}`,
          },
        ],
      }),
    })
    if (!res.ok) {
      console.error('[suggestCategory] http', res.status)
      return { category: null }
    }
    const data = await res.json()
    const block = (data.content ?? []).find((b: { type: string }) => b.type === 'text')
    const raw = String(block?.text ?? '').trim().toLowerCase().replace(/[^a-z]/g, '')
    const match = CATEGORIES.find((c) => c.id === raw)
    return { category: match ? match.id : null }
  } catch (err) {
    console.error('[suggestCategory]', err)
    return { category: null }
  }
}
