import { z } from 'zod'

export const RegisterSchema = z.object({
  email: z.string().email('Ungültige E-Mail'),
  password: z.string().min(8, 'Min. 8 Zeichen'),
  username: z
    .string()
    .min(3, 'Min. 3 Zeichen')
    .max(20, 'Max. 20 Zeichen')
    .regex(/^[a-zA-Z0-9_]+$/, 'Nur Buchstaben, Zahlen und _'),
  gemeinde: z.string().min(1, 'Bitte Gemeinde wählen'),
  acceptTerms: z.boolean().refine((v) => v === true, {
    message: 'Bitte AGB und Datenschutzerklärung zustimmen',
  }),
})

export const LoginSchema = z.object({
  email: z.string().email('Ungültige E-Mail'),
  password: z.string().min(1, 'Passwort erforderlich'),
})
