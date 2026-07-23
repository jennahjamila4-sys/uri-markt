/**
 * BLOCK 14 — Zentrale Zustands-Konfiguration (Single Source of Truth).
 *
 * 8 kanonische Zustands-Grade (Slug → Label) + Anwendbarkeits-Map je Kategorie,
 * Smart-Default-Keyword-Erkennung (für den Nicht-KI-Fall) und Fallback-Labels
 * für die 4 Altwerte (new/like_new/good/acceptable), die nach dem Backfill
 * (Migration M14-2) noch in Altdaten stehen können.
 *
 * WICHTIG: Die Altwerte sind NUR Anzeige-Fallback — sie sind nie neu wählbar.
 */

export type ConditionSlug =
  | 'neu_mit_etikett'
  | 'neu_ohne_etikett'
  | 'einmal_genutzt'
  | 'sehr_gut'
  | 'gut'
  | 'gebrauchsspuren'
  | 'maengel'
  | 'defekt'

export interface ConditionGrade {
  slug: ConditionSlug
  /** Volles Label (Detail-Anzeige, Zusammenfassung). */
  label: string
  /** Kurzes Chip-Label (Auswahl-Card). */
  short: string
  /** Kurzer, empathischer Hilfetext unter dem Chip. */
  hint?: string
  /** Blendet ein Pflichtfeld ein: 'maengel' → Mängel-Text, 'defekt' → Beschreibung. */
  requiresDetail?: 'maengel' | 'defekt'
}

/** Die 8 kanonischen Grade in fester Reihenfolge (neu → defekt). */
export const CONDITION_GRADES: ConditionGrade[] = [
  {
    slug: 'neu_mit_etikett',
    label: 'Neu mit Etikett',
    short: 'Neu mit Etikett',
    hint: 'Original-Etikett noch dran — nie benutzt.',
  },
  {
    slug: 'neu_ohne_etikett',
    label: 'Neu, ungetragen/unbenutzt',
    short: 'Neuwertig',
    hint: 'Nie benutzt, aber ohne Etikett.',
  },
  {
    slug: 'einmal_genutzt',
    label: 'Einmal getragen/genutzt',
    short: 'Einmal genutzt',
    hint: 'Genau einmal im Einsatz gewesen.',
  },
  {
    slug: 'sehr_gut',
    label: 'Selten gebraucht — sehr guter Zustand',
    short: 'Sehr gut',
    hint: 'Kaum Spuren, gepflegt.',
  },
  {
    slug: 'gut',
    label: 'Gebraucht — guter Zustand (normale Gebrauchsspuren)',
    short: 'Gut',
    hint: 'Normale, ehrliche Gebrauchsspuren.',
  },
  {
    slug: 'gebrauchsspuren',
    label: 'Gebraucht — sichtbare Gebrauchsspuren',
    short: 'Gebrauchsspuren',
    hint: 'Deutlich benutzt, aber voll funktionsfähig.',
  },
  {
    slug: 'maengel',
    label: 'Mit kleinen Mängeln',
    short: 'Kleine Mängel',
    hint: 'Sag kurz, was — so bleibt alles fair.',
    requiresDetail: 'maengel',
  },
  {
    slug: 'defekt',
    label: 'Defekt / Bastlerartikel',
    short: 'Defekt / Bastler',
    hint: 'Für Bastler:innen — beschreib den Defekt.',
    requiresDetail: 'defekt',
  },
]

const GRADE_BY_SLUG = new Map(CONDITION_GRADES.map((g) => [g.slug, g]))

/** Zusatz-Chip (kein Grad, kombinierbar) — landet in smart_data. */
export const GEREINIGT_KEY = 'gereinigt'
export const GEREINIGT_LABEL = 'Frisch gewaschen/gereinigt'

/**
 * Fallback-Labels für die 4 Altwerte (nur Anzeige, nie neu wählbar).
 * (siehe Plan 3.1)
 */
export const LEGACY_CONDITION_LABELS: Record<string, string> = {
  new: 'Neu',
  like_new: 'Wie neu',
  good: 'Guter Zustand',
  acceptable: 'Gebrauchsspuren',
}

/**
 * Liefert das anzeigbare Zustands-Label für einen beliebigen gespeicherten Wert:
 * zuerst kanonisch (8 Grade), dann Altwert-Fallback, sonst leer.
 */
export function conditionLabel(value: string | null | undefined): string | null {
  if (!value) return null
  const grade = GRADE_BY_SLUG.get(value as ConditionSlug)
  if (grade) return grade.label
  return LEGACY_CONDITION_LABELS[value] ?? null
}

// ---------------------------------------------------------------------------
// Anwendbarkeit pro Kategorie (Fallback ohne KI). Erweiterbar.
// ---------------------------------------------------------------------------

/** Textil-Kategorien: hier sind reine Textil-Grade sinnvoll. */
const TEXTIL_CATEGORIES = new Set(['kleider', 'kindersachen', 'sport'])
/** Kategorien, in denen „Defekt / Bastler" sinnvoll ist. */
const DEFEKT_CATEGORIES = new Set([
  'elektronik',
  'moebel',
  'fahrzeuge',
  'sport',
  'werkzeug',
])
/** Kategorien OHNE Zustands-Card (immaterielle Angebote). */
const NO_CONDITION_CATEGORIES = new Set(['dienstleistungen', 'jobs'])

/** Grade, die nur bei Textil (bzw. Schuh-Subtyp) angeboten werden. */
const TEXTIL_ONLY_GRADES = new Set<ConditionSlug>([
  'neu_mit_etikett',
  'einmal_genutzt',
])

/** Zeigt die Kategorie überhaupt eine Zustands-Card? */
export function showsConditionCard(category: string | null | undefined): boolean {
  if (!category) return true
  return !NO_CONDITION_CATEGORIES.has(category)
}

/**
 * Fallback-Anwendbarkeit (ohne KI): welche der 8 Grade passen zur Kategorie?
 * Der optionale `subtypeIsShoe` schaltet Textil-Grade auch bei sonst
 * nicht-textilen Kategorien frei (Schuh-Subtyp).
 */
export function conditionOptionsForCategory(
  category: string | null | undefined,
  subtypeIsShoe = false
): ConditionSlug[] {
  if (!showsConditionCard(category)) return []
  const isTextil = (category ? TEXTIL_CATEGORIES.has(category) : false) || subtypeIsShoe
  const allowsDefekt = category ? DEFEKT_CATEGORIES.has(category) : true
  return CONDITION_GRADES.filter((g) => {
    if (TEXTIL_ONLY_GRADES.has(g.slug) && !isTextil) return false
    if (g.slug === 'defekt' && !allowsDefekt && category) return false
    return true
  }).map((g) => g.slug)
}

/** Ist der `gereinigt`-Zusatz-Chip für diese Kategorie/Subtyp sinnvoll? */
export function gereinigtSinnvoll(
  category: string | null | undefined,
  subtypeIsShoe = false
): boolean {
  if (!category) return false
  return category === 'kleider' || category === 'kindersachen' || subtypeIsShoe
}

// ---------------------------------------------------------------------------
// Smart Default: Zustand aus Titel/Beschreibung erraten (nur Vorschlag).
// ---------------------------------------------------------------------------

const CONDITION_KEYWORDS: { slug: ConditionSlug; kws: string[] }[] = [
  { slug: 'neu_mit_etikett', kws: ['neu mit etikett', 'mit etikett', 'ungetragen mit etikett', 'nwt'] },
  { slug: 'neu_ohne_etikett', kws: ['ungetragen', 'unbenutzt', 'nagelneu', 'originalverpackt', 'ovp', 'neuwertig'] },
  { slug: 'einmal_genutzt', kws: ['einmal getragen', 'einmal genutzt', 'nur einmal', 'einmalig getragen'] },
  { slug: 'sehr_gut', kws: ['kaum getragen', 'kaum benutzt', 'wie neu', 'sehr guter zustand', 'top zustand'] },
  { slug: 'defekt', kws: ['defekt', 'bastler', 'kaputt', 'funktioniert nicht', 'für ersatzteile', 'ersatzteil'] },
  { slug: 'maengel', kws: ['fleck', 'flecken', 'kratzer', 'riss', 'loch', 'macke', 'delle', 'mit mängeln', 'kleiner mangel'] },
  { slug: 'gebrauchsspuren', kws: ['gebrauchsspuren', 'stark benutzt', 'sichtbare spuren', 'abgenutzt'] },
]

/**
 * Rät einen Zustands-Slug aus Freitext (Titel + Beschreibung). Nur Vorschlag —
 * nie stumm übernehmen. Erster Treffer in Prioritäts-Reihenfolge gewinnt.
 */
export function detectConditionFromText(text: string): ConditionSlug | null {
  const lower = (text ?? '').toLowerCase()
  if (!lower.trim()) return null
  for (const { slug, kws } of CONDITION_KEYWORDS) {
    if (kws.some((kw) => lower.includes(kw))) return slug
  }
  return null
}

/** Schuh-Subtyp aus Freitext erkennen (schaltet Textil-Grade + gereinigt frei). */
export function detectShoeSubtype(text: string): boolean {
  const lower = (text ?? '').toLowerCase()
  return ['schuh', 'schuhe', 'stiefel', 'sneaker', 'sandalen', 'turnschuh', 'boots'].some(
    (kw) => lower.includes(kw)
  )
}
