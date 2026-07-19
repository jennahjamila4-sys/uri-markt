import type { CategoryId } from '@/types'

/**
 * BLOCK 10 — Chamäleon-Formular: kategorie-spezifische Smart-Felder.
 *
 * 1:1 extrahiert aus der V33-Referenz (`docs/referenz/Uri_V33.html`,
 * `categoryConfig`). Die 9 V33-Kategorien sind auf die kanonische App-
 * Kategorieliste (`CATEGORIES` in `src/types/index.ts`) gemappt:
 *   Kleidung→kleider · Fahrzeuge→fahrzeuge · Elektronik→elektronik ·
 *   Immobilien→immobilien · Jobs→jobs · Moebel→moebel · Sport→sport ·
 *   Events→events · Tiere→haustiere
 * Alle 9 V33-Kategorien haben ein App-Gegenstück (immobilien und events
 * existieren in CATEGORIES) — es fällt keine V33-Kategorie weg.
 *
 * Nicht starr: App-Kategorien ohne Eintrag hier nutzen das normale Formular
 * (Stufe 2 zeigt dann keine Chips, nichts blockiert). Neue Kategorie/neue
 * Chips später = ein Eintrag hier, kein Umbau.
 *
 * Die Reihenfolge der Einträge = Erkennungs-Priorität (wie V33): der erste
 * Keyword-Treffer gewinnt (z.B. „velo“ → fahrzeuge, da vor sport).
 */

export type SmartFieldType =
  | 'pills'
  | 'toggle'
  | 'slider'
  | 'select'
  | 'date'
  | 'text'
  | 'number'

export interface SmartField {
  id: string
  label: string
  type: SmartFieldType
  options?: string[]
  placeholder?: string
  min?: number
  max?: number
  step?: number
  defaultVal?: number
  unit?: string
}

export interface CategorySmartConfig {
  keywords: string[]
  fields: SmartField[]
}

export const categoryConfig: Partial<Record<CategoryId, CategorySmartConfig>> = {
  kleider: {
    keywords: ['pulli', 'pullover', 'hose', 'hemd', 'shirt', 'jacke', 'mantel', 'schuhe', 'stiefel', 'sandalen', 'kleid', 'rock', 'jeans', 'shorts', 'socken', 'unterwäsche', 'mütze', 'schal', 'handschuhe', 'gürtel', 'krawatte', 'anzug', 'kostüm', 'uniform', 'sportbekleidung', 'badehose', 'bikini', 'pyjama', 'jogginghose', 'hoodie', 'sweatshirt', 'bluse', 'top', 'leggings', 'strumpfhose', 'strümpfe', 'cap', 'hut', 'beanie'],
    fields: [
      { id: 'g-groesse', label: 'Grösse', type: 'select', options: ['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'Kinder 92', 'Kinder 104', 'Kinder 116', 'Kinder 128', 'Kinder 140', 'Kinder 152', 'Kinder 164'] },
      { id: 'g-geschlecht', label: 'Für wen?', type: 'pills', options: ['Damen', 'Herren', 'Unisex', 'Kinder', 'Baby'] },
      { id: 'g-farbe', label: 'Farbe', type: 'pills', options: ['Schwarz', 'Weiss', 'Grau', 'Blau', 'Rot', 'Grün', 'Gelb', 'Orange', 'Rosa', 'Lila', 'Braun', 'Beige', 'Bunt'] },
      { id: 'g-zustand', label: 'Zustand', type: 'pills', options: ['Neu mit Etikett', 'Wie neu', 'Gut', 'Akzeptabel'] },
    ],
  },
  fahrzeuge: {
    keywords: ['auto', 'wagen', 'car', 'velo', 'fahrrad', 'motorrad', 'roller', 'moped', 'traktor', 'lkw', 'lieferwagen', 'van', 'bus', 'camper', 'wohnmobil', 'quad', 'atv', 'ski', 'snowboard', 'boot', 'kanu', 'kajak', 'e-bike', 'ebike', 'elektroauto', 'elektrovelo', 'töff', 'mofa', 'scooter', 'anhänger', 'transporter'],
    fields: [
      { id: 'g-marke', label: 'Marke', type: 'text', placeholder: 'z.B. VW, Trek, Yamaha' },
      { id: 'g-modelljahr', label: 'Modelljahr (ab)', type: 'select', options: ['Egal', '2020', '2019', '2018', '2015', '2010', '2005', '2000', 'Vor 2000'] },
      { id: 'g-km', label: 'Max. Kilometerstand', type: 'select', options: ['Egal', 'bis 10000 km', 'bis 50000 km', 'bis 100000 km', 'bis 200000 km'] },
      { id: 'g-preislimit', label: 'Max. Budget (CHF)', type: 'number', placeholder: 'z.B. 5000' },
    ],
  },
  elektronik: {
    keywords: ['handy', 'smartphone', 'iphone', 'android', 'samsung', 'laptop', 'computer', 'pc', 'tablet', 'ipad', 'tv', 'fernseher', 'konsole', 'playstation', 'xbox', 'nintendo', 'kamera', 'kopfhörer', 'lautsprecher', 'drucker', 'monitor', 'tastatur', 'maus', 'festplatte', 'ssd', 'router', 'modem', 'smartwatch', 'uhr', 'apple watch', 'airpods', 'headset', 'mikrofon', 'beamer', 'projektor', 'gaming', 'grafikkarte', 'prozessor', 'ram', 'netzteil', 'ladekabel', 'powerbank'],
    fields: [
      { id: 'g-speicher', label: 'Speicherkapazität', type: 'pills', options: ['Egal', '64 GB', '128 GB', '256 GB', '512 GB', '1 TB'] },
      { id: 'g-akku', label: 'Akku-Zustand', type: 'pills', options: ['Egal', 'Sehr gut (>90%)', 'Gut (>80%)', 'OK (>70%)'] },
      { id: 'g-garantie', label: 'Garantie vorhanden?', type: 'pills', options: ['Egal', 'Ja', 'Nein'] },
      { id: 'g-preislimit', label: 'Max. Budget (CHF)', type: 'number', placeholder: 'z.B. 800' },
    ],
  },
  immobilien: {
    keywords: ['wohnung', 'zimmer', 'haus', 'villa', 'studio', 'atelier', 'büro', 'gewerbe', 'parkplatz', 'garage', 'hobbyraum', 'keller', 'lager', 'miete', 'kaufen', 'immobilie', 'wg', 'wohngemeinschaft', 'untermiete', 'ferienwohnung', 'chalet', 'ferienhaus', 'grundstück', 'bauland', 'stockwerk', 'etage', 'loft', 'penthouse', 'dachwohnung', 'erdgeschoss'],
    fields: [
      { id: 'g-zimmer', label: 'Anzahl Zimmer', type: 'pills', options: ['Egal', '1', '1.5', '2', '2.5', '3', '3.5', '4', '4.5', '5+'] },
      { id: 'g-qm', label: 'Min. Quadratmeter', type: 'select', options: ['Egal', '20 m²', '40 m²', '60 m²', '80 m²', '100 m²', '120 m²', '150 m²'] },
      { id: 'g-maxmiete', label: 'Max. Miete/Preis (CHF)', type: 'number', placeholder: 'z.B. 1500' },
      { id: 'g-region', label: 'Region', type: 'select', options: ['Egal', 'Altdorf', 'Schächental', 'Reusstal', 'Ursern', 'Urner Oberland', 'Seedorf/Bauen'] },
    ],
  },
  jobs: {
    keywords: ['job', 'arbeit', 'stelle', 'hilfe', 'mitarbeiter', 'praktikum', 'lehrstelle', 'anstellung', 'vollzeit', 'teilzeit', 'temporär', 'aushilfe', 'freelance', 'selbstständig', 'handwerker', 'reinigung', 'putzen', 'babysitter', 'kinderbetreuung', 'pflege', 'betreuung', 'nachhilfe', 'unterricht', 'fahrer', 'lieferant', 'monteur', 'elektriker', 'schreiner', 'maler', 'gärtner', 'landwirt', 'bauer', 'kellner', 'köchin', 'servicekraft', 'verkäufer', 'buchhalter', 'informatiker', 'programmierer', 'webdesigner', 'fotograf', 'videograf', 'suche hilfe', 'suche mitarbeiter', 'suche jemanden'],
    fields: [
      { id: 'g-anstellungsart', label: 'Anstellungsart', type: 'pills', options: ['Vollzeit', 'Teilzeit', 'Temporär', 'Mini-Job/Aushilfe', 'Freelance', 'Praktikum', 'Lehrstelle'] },
      { id: 'g-branche', label: 'Branche', type: 'select', options: ['Egal', 'Bau & Handwerk', 'Gastro & Tourismus', 'Büro & Verwaltung', 'Pflege & Gesundheit', 'Landwirtschaft', 'Detailhandel', 'IT & Technik', 'Bildung', 'Transport & Logistik', 'Reinigung & Haushalt', 'Kinderbetreuung', 'Sonstiges'] },
      { id: 'g-lohn', label: 'Lohnbereich (CHF/h)', type: 'slider', min: 15, max: 120, step: 5, defaultVal: 30, unit: 'CHF/h' },
      { id: 'g-erfahrung', label: 'Erfahrung erforderlich?', type: 'toggle', options: ['Nein (Quereinsteiger ok)', 'Ja, Berufserfahrung nötig', 'Lehre/Ausbildung'] },
      { id: 'g-wann', label: 'Wann?', type: 'select', options: ['Ab sofort', 'Innerhalb 1 Monat', 'In 1-3 Monaten', 'Datum wählbar'] },
    ],
  },
  moebel: {
    keywords: ['sofa', 'couch', 'sessel', 'stuhl', 'tisch', 'schrank', 'bett', 'matratze', 'regal', 'kommode', 'sideboard', 'vitrine', 'kleiderschrank', 'küche', 'küchenzeile', 'herd', 'kühlschrank', 'geschirrspüler', 'waschmaschine', 'trockner', 'lampe', 'leuchte', 'spiegel', 'teppich', 'vorhang', 'gardine', 'bild', 'rahmen', 'deko', 'pflanze', 'topf', 'vase', 'kissen', 'decke', 'möbel', 'einrichtung', 'wohnen'],
    fields: [
      { id: 'g-masse', label: 'Max. Masse (B×H×T cm)', type: 'text', placeholder: 'z.B. 200×80×90' },
      { id: 'g-transport', label: 'Transport-Hilfe nötig?', type: 'pills', options: ['Nein', 'Ja, bitte anbieten', 'Ich bringe eigenes Fahrzeug'] },
      { id: 'g-zustand', label: 'Zustand', type: 'pills', options: ['Neu', 'Wie neu', 'Gut', 'Akzeptabel'] },
      { id: 'g-preislimit', label: 'Max. Budget (CHF)', type: 'number', placeholder: 'z.B. 300' },
    ],
  },
  sport: {
    keywords: ['sport', 'fitness', 'gym', 'training', 'yoga', 'pilates', 'ski', 'skifahren', 'snowboard', 'schlitteln', 'wandern', 'klettern', 'bouldern', 'schwimmen', 'tauchen', 'tennis', 'badminton', 'fussball', 'basketball', 'volleyball', 'handball', 'hockey', 'eishockey', 'golf', 'reiten', 'pferd', 'velo', 'cycling', 'laufen', 'marathon', 'triathlon', 'crossfit', 'gewichte', 'hantel', 'fahrrad', 'mountainbike', 'rennvelo', 'e-bike', 'inline', 'skateboard', 'longboard', 'surfboard', 'wakeboard', 'kajak', 'kanu', 'rudern', 'segeln'],
    fields: [
      { id: 'g-sportart', label: 'Sportart', type: 'text', placeholder: 'z.B. Ski, Tennis, Yoga' },
      { id: 'g-niveau', label: 'Niveau', type: 'pills', options: ['Anfänger', 'Fortgeschritten', 'Profi', 'Egal'] },
      { id: 'g-groesse', label: 'Grösse/Masse', type: 'text', placeholder: 'z.B. Ski 170cm, Schuh Gr. 42' },
      { id: 'g-preislimit', label: 'Max. Budget (CHF)', type: 'number', placeholder: 'z.B. 200' },
    ],
  },
  events: {
    keywords: ['event', 'konzert', 'festival', 'party', 'feier', 'hochzeit', 'geburtstag', 'ticket', 'eintrittskarte', 'veranstaltung', 'show', 'theater', 'kino', 'museum', 'ausstellung', 'messe', 'markt', 'käsemarkt', 'dorffest', 'fasnacht', 'silvester', 'weihnachten', 'openair', 'openair-festival', 'live', 'musik', 'band', 'dj', 'afterparty', 'apéro', 'brunch', 'dinner', 'gala', 'charity', 'sport-event', 'turnier', 'wettkampf', 'rennen', 'lauf'],
    fields: [
      { id: 'g-datum', label: 'Datum / Zeitraum', type: 'date', placeholder: '' },
      { id: 'g-tickets', label: 'Anzahl Tickets', type: 'select', options: ['1', '2', '3', '4', '5+'] },
      { id: 'g-eventort', label: 'Event-Ort', type: 'text', placeholder: 'z.B. Altdorf, Andermatt' },
      { id: 'g-preislimit', label: 'Max. Budget pro Ticket (CHF)', type: 'number', placeholder: 'z.B. 50' },
    ],
  },
  haustiere: {
    keywords: ['hund', 'katze', 'vogel', 'fisch', 'aquarium', 'terrarium', 'hamster', 'kaninchen', 'hase', 'meerschweinchen', 'pferd', 'pony', 'kuh', 'ziege', 'schaf', 'huhn', 'ente', 'gans', 'tier', 'haustier', 'zubehör', 'futter', 'leine', 'käfig', 'stall', 'tierarzt'],
    fields: [
      { id: 'g-tierart', label: 'Tierart', type: 'text', placeholder: 'z.B. Labrador, Perserkatze' },
      { id: 'g-alter', label: 'Alter (max.)', type: 'select', options: ['Egal', 'Jungtier', 'bis 2 Jahre', 'bis 5 Jahre', 'bis 10 Jahre', 'Seniortier ok'] },
      { id: 'g-zubehoer', label: 'Zubehör benötigt?', type: 'pills', options: ['Nein', 'Ja, gerne', 'Nur Zubehör (kein Tier)'] },
    ],
  },
}

/**
 * Lokale Kategorie-Erkennung aus Freitext — case-insensitiv, KEIN API-Call.
 * Erster Keyword-Treffer in Einfüge-Reihenfolge gewinnt (wie V33). Gibt die
 * kanonische App-CategoryId zurück oder null (dann greift Fallback-Select
 * bzw. — nach 15+ Zeichen — der KI-Fallback).
 */
export function detectCategory(text: string): CategoryId | null {
  const lower = text.toLowerCase()
  for (const [cat, config] of Object.entries(categoryConfig) as [
    CategoryId,
    CategorySmartConfig,
  ][]) {
    if (config.keywords.some((kw) => lower.includes(kw))) return cat
  }
  return null
}

/**
 * Liefert das Label eines Smart-Feldes (für die Detail-Anzeige). Fällt auf
 * einen aufgeräumten Key zurück, falls die Kategorie/das Feld nicht (mehr)
 * in der Config existiert — so bleibt gespeichertes smart_data lesbar.
 */
export function smartFieldLabel(category: string | null, fieldId: string): string {
  const cfg = category ? categoryConfig[category as CategoryId] : undefined
  const field = cfg?.fields.find((f) => f.id === fieldId)
  if (field) return field.label
  return fieldId.replace(/^g-/, '').replace(/[-_]/g, ' ')
}
