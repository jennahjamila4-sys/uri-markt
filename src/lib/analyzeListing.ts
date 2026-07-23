/**
 * BLOCK 14 — KI-Feld-Engine: gemeinsame Typen + strikte Validierung der
 * KI-Antwort. Wird von der Route (`/api/analyze-listing`) UND vom Client
 * (Render-Engine) importiert. Die KI ERKENNT den Artikel und BESTIMMT die
 * sinnvollen Felder — das Formular rendert `felder[]` generisch, ohne
 * Kategorie-Logik.
 *
 * Sicherheitsprinzip (Plan 3.2): Nichts aus der KI-Antwort wird ungeprüft
 * gerendert. `validateAnalyzeResult` gibt bei jeder Regelverletzung `null`
 * zurück → der Flow fällt auf die lokale Block-10-Erkennung zurück.
 */

import type { ConditionSlug } from './conditionConfig'

export type AiFieldType = 'chips' | 'zahlen_skala' | 'toggle' | 'text'

export interface AiField {
  key: string
  label: string
  typ: AiFieldType
  /** nur bei typ='chips' */
  optionen?: string[]
  /** nur bei typ='zahlen_skala' */
  min?: number
  max?: number
  schritt?: number
}

export interface AnalyzeResult {
  feed_kategorie: string
  artikel_typ: string
  titel_vorschlag: string
  beschreibung_vorschlag: string
  felder: AiField[]
  zustand_optionen: ConditionSlug[]
  zustand_vorschlag: ConditionSlug | null
  gereinigt_sinnvoll: boolean
}

const ALLOWED_TYPES: AiFieldType[] = ['chips', 'zahlen_skala', 'toggle', 'text']
const MAX_FIELDS = 8
const MAX_OPTIONS = 24
const MAX_OPTION_LEN = 40
const MAX_LABEL_LEN = 60

/** Key normalisieren: lowercase, keine Leerzeichen, nur [a-z0-9-_]. */
export function normalizeKey(raw: string): string {
  return String(raw)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 40)
}

function isString(v: unknown): v is string {
  return typeof v === 'string'
}
function isFiniteNum(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v)
}

/**
 * Strikte Whitelist-Validierung. Gibt bei JEDER Regelverletzung `null` zurück.
 * @param categoryIds erlaubte feed_kategorie-Werte (kanonische App-Kategorien)
 * @param conditionSlugs erlaubte Zustands-Slugs (die 8 kanonischen)
 */
export function validateAnalyzeResult(
  raw: unknown,
  categoryIds: readonly string[],
  conditionSlugs: readonly string[]
): AnalyzeResult | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>

  if (!isString(o.feed_kategorie) || !categoryIds.includes(o.feed_kategorie)) return null
  if (!isString(o.artikel_typ)) return null
  if (!isString(o.titel_vorschlag)) return null
  if (!isString(o.beschreibung_vorschlag)) return null

  // felder[]
  if (!Array.isArray(o.felder)) return null
  if (o.felder.length > MAX_FIELDS) return null
  const seenKeys = new Set<string>()
  const felder: AiField[] = []
  for (const f of o.felder) {
    if (!f || typeof f !== 'object') return null
    const ff = f as Record<string, unknown>
    if (!isString(ff.key) || !isString(ff.label) || !isString(ff.typ)) return null
    if (!ALLOWED_TYPES.includes(ff.typ as AiFieldType)) return null
    if (ff.label.length > MAX_LABEL_LEN) return null
    const key = normalizeKey(ff.key)
    if (!key || seenKeys.has(key)) return null
    seenKeys.add(key)

    const field: AiField = { key, label: ff.label.trim(), typ: ff.typ as AiFieldType }

    if (field.typ === 'chips') {
      if (!Array.isArray(ff.optionen) || ff.optionen.length === 0) return null
      if (ff.optionen.length > MAX_OPTIONS) return null
      const opts: string[] = []
      for (const opt of ff.optionen) {
        if (!isString(opt) || opt.length === 0 || opt.length > MAX_OPTION_LEN) return null
        opts.push(opt.trim())
      }
      field.optionen = opts
    } else if (field.typ === 'zahlen_skala') {
      if (!isFiniteNum(ff.min) || !isFiniteNum(ff.max) || !isFiniteNum(ff.schritt)) return null
      if (ff.schritt <= 0 || ff.max <= ff.min) return null
      // Begrenzung: nie mehr als 200 Schritte (DoS-/UI-Schutz).
      if ((ff.max - ff.min) / ff.schritt > 200) return null
      field.min = ff.min
      field.max = ff.max
      field.schritt = ff.schritt
    }
    // 'toggle' und 'text' brauchen keine Zusatzdaten.

    felder.push(field)
  }

  // zustand_optionen ⊆ 8 Slugs
  if (!Array.isArray(o.zustand_optionen)) return null
  const zustand_optionen: ConditionSlug[] = []
  for (const s of o.zustand_optionen) {
    if (!isString(s) || !conditionSlugs.includes(s)) return null
    zustand_optionen.push(s as ConditionSlug)
  }

  let zustand_vorschlag: ConditionSlug | null = null
  if (o.zustand_vorschlag != null) {
    if (!isString(o.zustand_vorschlag)) return null
    if (!zustand_optionen.includes(o.zustand_vorschlag as ConditionSlug)) return null
    zustand_vorschlag = o.zustand_vorschlag as ConditionSlug
  }

  const gereinigt_sinnvoll = o.gereinigt_sinnvoll === true

  return {
    feed_kategorie: o.feed_kategorie,
    artikel_typ: o.artikel_typ.trim(),
    titel_vorschlag: o.titel_vorschlag.trim().slice(0, 100),
    beschreibung_vorschlag: o.beschreibung_vorschlag.trim().slice(0, 2000),
    felder,
    zustand_optionen,
    zustand_vorschlag,
    gereinigt_sinnvoll,
  }
}
