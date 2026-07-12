import { NextResponse, type NextRequest } from 'next/server'
import type Stripe from 'stripe'
import { getStripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase/admin'

// Rohen Body fuer die Signaturpruefung → Node-Runtime, immer dynamisch.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!secret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET fehlt')
    return NextResponse.json({ error: 'Webhook nicht konfiguriert' }, { status: 500 })
  }

  const sig = req.headers.get('stripe-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Signatur fehlt' }, { status: 400 })
  }

  const raw = await req.text()
  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, sig, secret)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'unbekannt'
    console.error('[stripe-webhook] Signaturpruefung fehlgeschlagen:', msg)
    return NextResponse.json({ error: 'Signatur ungueltig' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session

    // Nur gutschreiben, wenn wirklich bezahlt.
    if (session.payment_status !== 'paid') {
      return NextResponse.json({ received: true, skipped: 'not_paid' })
    }

    const userId = session.metadata?.user_id
    const amountRappen = Number(session.metadata?.amount_rappen)
    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : (session.payment_intent?.id ?? null)

    if (!userId || !Number.isFinite(amountRappen) || amountRappen <= 0 || !paymentIntentId) {
      console.error('[stripe-webhook] Unvollstaendige Metadaten', {
        userId,
        amountRappen,
        hasPaymentIntent: Boolean(paymentIntentId),
      })
      // 200, damit Stripe nicht endlos retryt – aber sichtbar geloggt.
      return NextResponse.json({ received: true, skipped: 'missing_metadata' })
    }

    // Gutschrift AUSSCHLIESSLICH via SECURITY-DEFINER-RPC credit_taler mit
    // Service-Client. Idempotent (unique auf stripe_payment_intent_id) → ein
    // doppelt zugestellter Webhook schreibt nie doppelt gut.
    const admin = createAdminClient()
    const { data, error } = await admin.rpc('credit_taler', {
      p_user_id: userId,
      p_amount_rappen: amountRappen,
      p_stripe_payment_intent_id: paymentIntentId,
      p_description: 'Taler-Kauf',
    })

    if (error) {
      console.error('[stripe-webhook] credit_taler DB-Fehler:', error.message)
      // 500 → Stripe wiederholt den Webhook (idempotent abgesichert).
      return NextResponse.json({ error: 'Gutschrift fehlgeschlagen' }, { status: 500 })
    }

    const result = data as {
      success: boolean
      already_processed?: boolean
      error?: string
    }
    if (result?.success === false) {
      console.error('[stripe-webhook] credit_taler abgelehnt:', result.error)
      return NextResponse.json({ error: result.error ?? 'Gutschrift abgelehnt' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
