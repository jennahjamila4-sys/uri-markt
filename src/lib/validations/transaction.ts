import { z } from 'zod'

export const BuyIntentSchema = z.object({
  listing_id: z.string().uuid('Ungültige Inserat-ID'),
  payment_method: z.enum(['cash', 'twint'], {
    errorMap: () => ({ message: 'Zahlungsart erforderlich (Bar oder TWINT)' }),
  }),
  buyer_contact: z.string()
    .min(5, 'Kontakt muss mindestens 5 Zeichen lang sein')
    .max(100, 'Kontakt darf max. 100 Zeichen lang sein'),
})

export type BuyIntentInput = z.infer<typeof BuyIntentSchema>

export const ReviewSchema = z.object({
  transaction_id: z.string().uuid('Ungültige Transaktions-ID'),
  rating: z.number().int().min(1, 'Bewertung muss mindestens 1 Stern sein').max(5, 'Bewertung darf max. 5 Sterne sein'),
  comment: z.string().max(500, 'Kommentar darf max. 500 Zeichen lang sein').optional(),
})

export type ReviewInput = z.infer<typeof ReviewSchema>

export const CommentSchema = z.object({
  listing_id: z.string().uuid('Ungültige Inserat-ID'),
  text: z.string()
    .min(1, 'Kommentar erforderlich')
    .max(500, 'Kommentar darf max. 500 Zeichen lang sein'),
})

export type CommentInput = z.infer<typeof CommentSchema>
