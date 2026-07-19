'use server'

import { createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revalidatePath } from 'next/cache'
import { PaymentInfoSchema, EditProfileSchema } from '@/lib/validations/profile'

/**
 * Zahlungs-/Kontaktdaten speichern (Tabelle `profiles_private`).
 * SICHERHEIT: id = eigene user_id vom Server (nie vom Client). RLS lässt
 * ohnehin nur den Eigentümer schreiben – die Server-Prüfung ist die erste Wand.
 * Leere Textfelder werden als null gespeichert, damit die RPC sie sauber als
 * „nicht hinterlegt" behandeln kann.
 */
export async function savePaymentInfoAction(rawData: unknown) {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  const validated = PaymentInfoSchema.safeParse(rawData)
  if (!validated.success) throw new Error('Ungültige Eingaben')

  const v = validated.data
  const nn = (s: string) => (s.length > 0 ? s : null)

  const { error } = await supabase.from('profiles_private').upsert(
    {
      id: user.id,
      iban: nn(v.iban),
      twint_phone: nn(v.twint_phone),
      phone: nn(v.phone),
      address: nn(v.address),
      show_iban: v.show_iban,
      show_twint: v.show_twint,
      show_phone: v.show_phone,
      show_address: v.show_address,
    },
    { onConflict: 'id' }
  )

  if (error) {
    console.error('[savePaymentInfo]', error)
    throw new Error('Speichern fehlgeschlagen')
  }

  revalidatePath('/profile')
  return { success: true as const }
}

/**
 * Eigene Kontaktdaten für das Prefill des Kaufformulars laden.
 * RLS lässt nur die eigene `profiles_private`-Zeile lesen. Fehlende Zeile
 * (maybeSingle → data null, error null) = leeres Formular, KEIN Fehler
 * (Lektion 7: Fehler ≠ leeres Ergebnis). Ein echter Query-Fehler wird als
 * `error`-Text zurückgegeben, damit das Formular ihn sichtbar machen kann,
 * ohne den Kauf zu blockieren.
 */
export async function getMyContactAction(): Promise<{
  phone: string | null
  twint_phone: string | null
  error: string | null
}> {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { phone: null, twint_phone: null, error: null }

  const { data, error, status } = await supabase
    .from('profiles_private')
    .select('phone, twint_phone')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[getMyContact]', status, error)
    return {
      phone: null,
      twint_phone: null,
      error: 'Deine gespeicherten Angaben konnte ich gerade nicht laden.',
    }
  }

  return {
    phone: data?.phone ?? null,
    twint_phone: data?.twint_phone ?? null,
    error: null,
  }
}

/**
 * Käufer-Kontakt aus dem Kaufformular für „💾 Für nächstes Mal merken"
 * zurückschreiben. PARTIELLER Upsert: berührt NUR die eine Kontaktspalte
 * (`phone` bzw. `twint_phone`), niemals IBAN/Adresse/Sichtbarkeits-Flags
 * (Lektion 1). Länge auf 30 gekappt; keine strikte Format-Prüfung, da dies ein
 * Kontakt-Hinweis ist (Name/Telefon frei), kein Auszahlungs-Feld.
 */
export async function rememberContactAction(
  field: 'phone' | 'twint_phone',
  value: string
) {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  if (field !== 'phone' && field !== 'twint_phone') {
    throw new Error('Ungültiges Feld')
  }

  const v = value.trim().slice(0, 30)
  const patch: { id: string; phone?: string | null; twint_phone?: string | null } = {
    id: user.id,
  }
  if (field === 'twint_phone') patch.twint_phone = v || null
  else patch.phone = v || null

  const { error } = await supabase
    .from('profiles_private')
    .upsert(patch, { onConflict: 'id' })

  if (error) {
    console.error('[rememberContact]', error)
    throw new Error('Konnte deine Angabe nicht merken')
  }

  return { success: true as const }
}

/**
 * Basis-Profil aktualisieren (Name, Gemeinde, bevorzugte Kategorien).
 * user_id kommt vom Server (nie vom Client); RLS erlaubt nur das eigene Profil.
 * Leere Textfelder → null.
 */
export async function updateProfileAction(rawData: unknown) {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  const validated = EditProfileSchema.safeParse(rawData)
  if (!validated.success) throw new Error('Ungültige Eingaben')

  const v = validated.data

  const { error } = await supabase
    .from('profiles')
    .update({
      full_name: v.full_name.length > 0 ? v.full_name : null,
      gemeinde: v.gemeinde.length > 0 ? v.gemeinde : null,
      preferred_categories: v.preferred_categories,
    })
    .eq('id', user.id)

  if (error) {
    console.error('[updateProfile]', error)
    throw new Error('Speichern fehlgeschlagen')
  }

  revalidatePath('/profile')
  return { success: true as const }
}

/**
 * Konto endgültig löschen (Schweizer Rechtspflicht auf Verlangen).
 * Ablauf:
 *  1. user_id serverseitig aus der Session (nie vom Client).
 *  2. Offene Deals (status pending/confirmed, als Käufer ODER Verkäufer)
 *     blockieren die Löschung mit sichtbarer Begründung – so verliert kein
 *     Handelspartner mitten im Deal die Gegenseite (Lektion 6).
 *  3. Erst wenn keine offenen Deals: `auth.admin.deleteUser` über den
 *     Service-Role-Client. Das CASCADE-/SET-NULL-Schema räumt profiles,
 *     profiles_private und die Inserate auf; Bewertungen/Transaktionen bleiben
 *     als „Gelöschter Nutzer" erhalten.
 * Rückgabe: { success:false, error } bei blockierten offenen Deals (kein Wurf,
 * damit das UI die Begründung sauber anzeigen kann); Erfolg → { success:true }.
 */
export async function deleteAccountAction(): Promise<
  { success: true } | { success: false; error: string; openDeals: number }
> {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (!user || authError) throw new Error('Nicht angemeldet')

  const { count, error: cErr } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .in('status', ['pending', 'confirmed'])

  if (cErr) {
    console.error('[deleteAccount:openDeals]', cErr)
    throw new Error('Offene Deals konnten nicht geprüft werden')
  }

  const open = count ?? 0
  if (open > 0) {
    return {
      success: false,
      openDeals: open,
      error: `Du hast noch ${open} offene${open === 1 ? 'n' : ''} Deal${
        open === 1 ? '' : 's'
      }. Bitte zuerst abschliessen oder stornieren – danach kannst du dein Konto löschen.`,
    }
  }

  const admin = createAdminClient()
  const { error: dErr } = await admin.auth.admin.deleteUser(user.id)
  if (dErr) {
    console.error('[deleteAccount]', dErr)
    throw new Error('Löschen fehlgeschlagen: ' + dErr.message)
  }

  return { success: true }
}
