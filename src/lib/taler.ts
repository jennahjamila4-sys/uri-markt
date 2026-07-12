/**
 * Uri-Taler-Kaufpakete – Single Source of Truth (client- UND serverseitig nutzbar,
 * enthaelt KEINE Secrets). 1 Taler = 1 CHF = 100 Rappen. `rappen` ist zugleich der
 * Stripe-Betrag (kleinste CHF-Einheit) und der Gutschrift-Betrag fuer credit_taler
 * (profiles.credits wird in Rappen gefuehrt).
 */
export interface TalerPackage {
  id: string
  taler: number
  /** Preis in Rappen = Stripe unit_amount = Gutschrift fuer credit_taler */
  rappen: number
  popular?: boolean
}

export const TALER_PACKAGES: TalerPackage[] = [
  { id: 'taler_5', taler: 5, rappen: 500 },
  { id: 'taler_10', taler: 10, rappen: 1000, popular: true },
  { id: 'taler_20', taler: 20, rappen: 2000 },
  { id: 'taler_50', taler: 50, rappen: 5000 },
]

export function findTalerPackage(id: string): TalerPackage | undefined {
  return TALER_PACKAGES.find((p) => p.id === id)
}

/** Rappen (credits/bigint) → Anzeige als "X.XX" Taler. Immer /100. */
export function rappenToTaler(rappen: number): string {
  return (rappen / 100).toFixed(2)
}
