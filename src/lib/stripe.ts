import Stripe from 'stripe'

/**
 * Zentrale Stripe-Server-Konfiguration. NUR serverseitig importieren
 * (Server Actions / Route Handler) – der STRIPE_SECRET_KEY darf nie ins
 * Client-Bundle gelangen.
 *
 * Lazy-Init: Ein fehlender Key sprengt nicht schon die Modul-Auswertung (Build),
 * sondern faellt erst beim tatsaechlichen Aufruf klar auf. Die apiVersion ist
 * bewusst NICHT gesetzt → das SDK nutzt die zu seiner Version gepinnte Fassung.
 */
let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (_stripe) return _stripe
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY fehlt in der Server-Umgebung')
  }
  _stripe = new Stripe(key)
  return _stripe
}
