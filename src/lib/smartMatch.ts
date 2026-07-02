import { createServerClient } from '@/lib/supabase/server'

/**
 * Regelbasiertes Smart Matching (Basis, ohne KI – KI-Upgrade in Phase 3).
 *
 * Scoring:
 *  - Kategorie passt (Pflicht-Filter)         → 40 Basis-Punkte
 *  - Angebotspreis <= Max-Budget des Gesuchs  → +30
 *  - Gleiche Gemeinde                          → +30
 *
 * Nur Treffer mit Score >= 60 werden gespeichert.
 */
export async function calculateSmartMatches(gesuchId: string): Promise<void> {
  const supabase = await createServerClient()

  // Gesuch laden
  const { data: gesuch } = await supabase
    .from('listings')
    .select('id, category, price, gemeinde, title, user_id')
    .eq('id', gesuchId)
    .single()

  if (!gesuch) return

  // max_budget liegt für Gesuche im Feld `price`
  const maxBudget = gesuch.price

  // Passende Angebote finden (gleiche Kategorie, aktiv, nicht eigene)
  const { data: offers } = await supabase
    .from('listings')
    .select('id, price, gemeinde, user_id')
    .eq('type', 'Angebot')
    .eq('status', 'active')
    .eq('category', gesuch.category)
    .neq('user_id', gesuch.user_id)

  if (!offers || offers.length === 0) return

  const rows = []
  for (const offer of offers) {
    let score = 40 // Kategorie matcht (Basis)
    if (maxBudget && offer.price && offer.price <= maxBudget) score += 30
    if (offer.gemeinde === gesuch.gemeinde) score += 30

    if (score >= 60) {
      rows.push({
        gesuch_id: gesuchId,
        matched_listing_id: offer.id,
        user_id: gesuch.user_id,
        score,
      })
    }
  }

  if (rows.length === 0) return

  const { error } = await supabase
    .from('smart_matches')
    .upsert(rows, {
      onConflict: 'gesuch_id,matched_listing_id',
      ignoreDuplicates: true,
    })

  if (error) console.error('[calculateSmartMatches]', error.message)
}
