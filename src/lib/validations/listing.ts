import { z } from 'zod'

// Block 10: kategorie-spezifische Match-Signale. Nur befüllte Werte landen hier
// (das Formular entfernt leere Keys); Werte sind Strings, String-Arrays (Pills)
// oder Zahlen. Persistiert als jsonb in listings.smart_data.
export const SmartDataSchema = z
  .record(z.string(), z.union([z.string(), z.array(z.string()), z.number()]))
  .optional()

// Block 14: 8 kanonische Zustands-Slugs (neu wählbar) + 4 Altwerte (nur noch
// zur Validierung bestehender/bearbeiteter Inserate, nie neu in der UI wählbar).
export const CONDITION_VALUES = [
  'neu_mit_etikett',
  'neu_ohne_etikett',
  'einmal_genutzt',
  'sehr_gut',
  'gut',
  'gebrauchsspuren',
  'maengel',
  'defekt',
  // Legacy (Altdaten / EditListingModal-Kompatibilität bis Backfill M14-2):
  'new',
  'like_new',
  'good',
  'acceptable',
] as const

export const AngebotSchema = z.object({
  title: z.string().min(3, 'Min. 3 Zeichen').max(100, 'Max. 100 Zeichen'),
  description: z.string().max(2000).optional(),
  category: z.string().min(1, 'Kategorie wählen'),
  // Block 14: Dienstleistungen/Jobs zeigen keine Zustands-Card → condition optional.
  condition: z.enum(CONDITION_VALUES).optional(),
  auto_release: z.boolean().optional(),
  price_type: z.enum(['fixed', 'vhb', 'free', 'auction']),
  price: z.number().min(0).optional(),
  gemeinde: z.string().min(1, 'Gemeinde wählen'),
  // Block 10: eine oder mehrere Gemeinden. gemeinde = erste (Kompatibilität),
  // gemeinden = alle. Muss die primäre gemeinde enthalten.
  gemeinden: z.array(z.string().min(1)).min(1).optional(),
  smart_data: SmartDataSchema,
  image_url: z.string().url().optional(),
  image_urls: z.array(z.string().url()).max(5).optional(),
  pickup_available: z.boolean().default(true),
  shipping_available: z.boolean().default(false),
  shipping_cost: z.number().min(0).optional(),
}).refine(
  (d) =>
    d.price_type === 'free' || (d.price !== undefined && d.price >= 0),
  {
    message: 'Preis erforderlich',
    path: ['price'],
  }
)
