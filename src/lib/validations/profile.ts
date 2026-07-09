import { z } from 'zod'
import { isValidSwissIban, isValidSwissPhone } from '@/lib/validators/swiss'

/**
 * Zahlungs-/Kontaktdaten des Verkäufers (Tabelle `profiles_private`).
 * Alle Textfelder sind optional – leere Eingaben werden serverseitig zu null.
 * Die `show_*`-Flags steuern, was der Käufer NACH Bestätigung sieht.
 *
 * Format-Prüfung (IBAN/Telefon) NUR wenn befüllt – identische Regeln werden im
 * Formular (sofortige Rückmeldung) und in der Save-Action angewandt.
 */
export const PaymentInfoSchema = z
  .object({
    iban: z.string().trim().max(40, 'IBAN ist zu lang').default(''),
    twint_phone: z.string().trim().max(30, 'TWINT-Nummer ist zu lang').default(''),
    phone: z.string().trim().max(30, 'Telefonnummer ist zu lang').default(''),
    address: z.string().trim().max(300, 'Adresse ist zu lang').default(''),
    show_iban: z.boolean().default(false),
    show_twint: z.boolean().default(false),
    show_phone: z.boolean().default(false),
    show_address: z.boolean().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.iban && !isValidSwissIban(val.iban)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['iban'],
        message: 'Hoppla, die IBAN stimmt so nicht 🤔 (Schweizer IBAN: CH + 19 Zeichen)',
      })
    }
    if (val.twint_phone && !isValidSwissPhone(val.twint_phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['twint_phone'],
        message: 'Diese TWINT-Nummer sieht nicht schweizerisch aus 🇨🇭 (z.B. 079 123 45 67)',
      })
    }
    if (val.phone && !isValidSwissPhone(val.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: 'Diese Telefonnummer sieht nicht schweizerisch aus 🇨🇭 (z.B. 079 123 45 67)',
      })
    }
  })

export type PaymentInfoInput = z.infer<typeof PaymentInfoSchema>
