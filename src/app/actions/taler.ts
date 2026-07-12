'use server'

import { headers } from 'next/headers'
import { createServerClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { findTalerPackage } from '@/lib/taler'

/**
 * Startet einen Stripe-Checkout fuer ein Taler-Paket.
 * SECURITY: user_id kommt vom Server via getUser(), nie vom Client. Betrag kommt
 * aus der server-seitigen Paket-Definition, nie aus dem Request-Body.
 */
export async function createTalerCheckoutAction(
  packageId: string
): Promise<{ url: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const pkg = findTalerPackage(packageId)
  if (!pkg) throw new Error('Unbekanntes Taler-Paket')

  // Rueckkehr-URLs an den echten Origin binden (lokal wie prod korrekt).
  const h = await headers()
  const origin =
    h.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

  const stripe = getStripe()
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    // KEIN payment_method_types – Stripe waehlt die im Dashboard aktivierten
    // Zahlungsmethoden automatisch (Vorgabe CLAUDE.md / Stripe-Best-Practice).
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: 'chf',
          unit_amount: pkg.rappen,
          product_data: {
            name: `${pkg.taler} Uri-Taler`,
            description: 'Guthaben fuer Provisionen auf Uri-Markt',
          },
        },
      },
    ],
    client_reference_id: user.id,
    metadata: {
      user_id: user.id,
      amount_rappen: String(pkg.rappen),
      package_id: pkg.id,
    },
    // Metadaten zusaetzlich am PaymentIntent, damit sie unabhaengig vom
    // Session-Objekt am Zahlungsvorgang haengen.
    payment_intent_data: {
      metadata: {
        user_id: user.id,
        amount_rappen: String(pkg.rappen),
        package_id: pkg.id,
      },
    },
    success_url: `${origin}/profile?taler=success`,
    cancel_url: `${origin}/profile?taler=cancel`,
  })

  if (!session.url) {
    throw new Error('Stripe-Checkout konnte nicht gestartet werden')
  }
  return { url: session.url }
}
