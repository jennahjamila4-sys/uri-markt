import { z } from 'zod'
import { checkSwissIban, isValidSwissPhone } from '@/lib/validators/swiss'
import { GEMEINDEN } from '@/types'

/** Präzise IBAN-Fehlermeldungen: Länge/Land vs. Prüfziffer unterscheiden. */
export const IBAN_MSG = {
  format: 'Bitte eine Schweizer IBAN: beginnt mit CH und hat 21 Zeichen (CH + 19).',
  checksum:
    'Die Prüfziffer stimmt nicht 🤔 — bitte IBAN nochmals von Karte/E-Banking abtippen.',
} as const

export const PHONE_MSG =
  'Diese Nummer sieht nicht schweizerisch aus 🇨🇭 (z.B. 079 123 45 67)'

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
    if (val.iban) {
      const res = checkSwissIban(val.iban)
      if (res !== 'ok') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['iban'],
          message: res === 'checksum' ? IBAN_MSG.checksum : IBAN_MSG.format,
        })
      }
    }
    if (val.twint_phone && !isValidSwissPhone(val.twint_phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['twint_phone'],
        message: PHONE_MSG,
      })
    }
    if (val.phone && !isValidSwissPhone(val.phone)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['phone'],
        message: PHONE_MSG,
      })
    }
  })

export type PaymentInfoInput = z.infer<typeof PaymentInfoSchema>

/**
 * Basis-Profil bearbeiten (Tabelle `profiles`).
 * Name optional; Gemeinde nur aus der bekannten Uri-Liste oder leer;
 * bevorzugte Kategorien als freie ID-Liste (max. 10). Leere Werte werden in der
 * Action zu null. Gleiches Schema wird im Formular und serverseitig genutzt.
 */
export const EditProfileSchema = z.object({
  full_name: z.string().trim().max(100, 'Name darf max. 100 Zeichen lang sein').default(''),
  gemeinde: z.union([z.enum(GEMEINDEN), z.literal('')]).default(''),
  preferred_categories: z.array(z.string()).max(10, 'Max. 10 Kategorien').default([]),
})

export type EditProfileInput = z.infer<typeof EditProfileSchema>
