import { z } from 'zod'

export const BuyIntentSchema = z.object({
  listing_id: z.string().uuid('Ungültige Inserat-ID'),
  payment_method: z.enum(['cash', 'twint', 'bank'], {
    errorMap: () => ({ message: 'Zahlungsart erforderlich (Bar, TWINT oder Bank)' }),
  }),
  // Kurze Kontaktangabe genügt: der Verkäufer muss nur wissen, wie er den
  // Käufer erreicht (Name/Telefon). Die vollständigen Kontaktdaten tauschen
  // beide Seiten ohnehin erst NACH der Bestätigung aus (get_transaction_contact).
  // Darum min. 2 (erlaubt z.B. „JJ"), nicht 5.
  buyer_contact: z.string()
    .trim()
    .min(2, 'Bitte eine kurze Kontaktangabe (z.B. Name oder Telefon)')
    .max(100, 'Kontakt darf max. 100 Zeichen lang sein'),
})

export type BuyIntentInput = z.infer<typeof BuyIntentSchema>

export const ReviewSchema = z.object({
  transaction_id: z.string().uuid('Ungültige Transaktions-ID'),
  rating: z.number().int().min(1, 'Bewertung muss mindestens 1 Stern sein').max(5, 'Bewertung darf max. 5 Sterne sein'),
  comment: z.string().max(500, 'Kommentar darf max. 500 Zeichen lang sein').optional(),
})

export type ReviewInput = z.infer<typeof ReviewSchema>

// Kommentar-Validierung EXAKT passend zur DB-CHECK-Constraint
// comments_content_check: char_length(btrim(content)) BETWEEN 1 AND 1000.
// Deshalb .trim() vor min/max — leer/nur-Leerzeichen wird zu '' und von min(1)
// blockiert; keine willkürliche Mindestlänge (Lektion 2).
export const CommentSchema = z.object({
  listing_id: z.string().uuid('Ungültige Inserat-ID'),
  text: z.string()
    .trim()
    .min(1, 'Kommentar darf nicht leer sein')
    .max(1000, 'Kommentar darf max. 1000 Zeichen lang sein'),
})

export type CommentInput = z.infer<typeof CommentSchema>
