'use server'

import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { PaymentInfoSchema } from '@/lib/validations/profile'

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
  return { success: true }
}
