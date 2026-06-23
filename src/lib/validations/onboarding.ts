import { z } from 'zod'
import { GEMEINDEN } from '@/types'

export const OnboardingProfileSchema = z.object({
  username: z.string()
    .min(3, 'Benutzername muss mindestens 3 Zeichen lang sein')
    .max(30, 'Benutzername darf max. 30 Zeichen lang sein')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Nur Buchstaben, Zahlen, _ und - erlaubt'),
  full_name: z.string().max(100, 'Name darf max. 100 Zeichen lang sein').optional(),
  gemeinde: z.enum(GEMEINDEN, { errorMap: () => ({ message: 'Ungültige Gemeinde' }) }).optional(),
})

export type OnboardingProfileInput = z.infer<typeof OnboardingProfileSchema>

export const PreferredCategoriesSchema = z.object({
  categories: z.array(z.string()).min(1, 'Mindestens eine Kategorie erforderlich').max(10, 'Max. 10 Kategorien'),
})

export type PreferredCategoriesInput = z.infer<typeof PreferredCategoriesSchema>

export const GesuchSchema = z.object({
  title: z.string()
    .min(3, 'Gesuch-Titel muss mindestens 3 Zeichen lang sein')
    .max(150, 'Titel darf max. 150 Zeichen lang sein'),
  category: z.string().min(1, 'Kategorie erforderlich'),
  max_budget: z.number().positive('Budget muss > 0 sein').optional(),
  gemeinde: z.enum(GEMEINDEN, { errorMap: () => ({ message: 'Ungültige Gemeinde' }) }),
  description: z.string().max(1000, 'Beschreibung darf max. 1000 Zeichen lang sein').optional(),
  needed_by: z.string().datetime('Ungültiges Datumsformat').optional(),
})

export type GesuchInput = z.infer<typeof GesuchSchema>
