/**
 * Zentrale Definition der Zahlungswege für den Deal-Flow.
 * Eine Quelle für Auswahl (DealFlow) UND Anzeige (Seller-/BuyerDashboard),
 * damit ein neuer Weg (z.B. Bank) überall konsistent auftaucht.
 */
export const PAYMENT_METHODS = [
  { value: 'cash', label: '💵 Bar bei Übergabe', short: '💵 Bar' },
  { value: 'twint', label: '📱 TWINT', short: '📱 TWINT' },
  { value: 'bank', label: '🏦 Banküberweisung (IBAN)', short: '🏦 Bank' },
] as const

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['value']

/** Kurzlabel für Listen/Karten; unbekannt → neutraler Fallback */
export function paymentMethodShort(method: string | null): string {
  return PAYMENT_METHODS.find((p) => p.value === method)?.short ?? '💳 Zahlung'
}
