import { z } from 'zod'

/**
 * Zahlungs-/Kontaktdaten des Verkäufers (Tabelle `profiles_private`).
 * Alle Textfelder sind optional – leere Eingaben werden serverseitig zu null.
 * Die `show_*`-Flags steuern, was der Käufer NACH Bestätigung sieht.
 */
export const PaymentInfoSchema = z.object({
  iban: z.string().trim().max(40, 'IBAN ist zu lang').default(''),
  twint_phone: z.string().trim().max(30, 'TWINT-Nummer ist zu lang').default(''),
  phone: z.string().trim().max(30, 'Telefonnummer ist zu lang').default(''),
  address: z.string().trim().max(300, 'Adresse ist zu lang').default(''),
  show_iban: z.boolean().default(false),
  show_twint: z.boolean().default(false),
  show_phone: z.boolean().default(false),
  show_address: z.boolean().default(false),
})

export type PaymentInfoInput = z.infer<typeof PaymentInfoSchema>
