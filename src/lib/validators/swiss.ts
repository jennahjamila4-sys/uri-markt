/**
 * Schweizer Format-Validierung für Zahlungs-/Kontaktdaten.
 * Wird sowohl im Formular (sofortige Rückmeldung) als auch serverseitig in der
 * Save-Action verwendet – identische Regeln, kein Frontend-only-Schutz.
 */

/** Leerzeichen/Trennzeichen entfernen, Grossschreibung – für IBAN */
export function normalizeIban(raw: string): string {
  return raw.replace(/[\s]/g, '').toUpperCase()
}

/** ISO 7064 Mod-97-10 Prüfsumme (gültig, wenn Rest === 1) */
function ibanMod97(iban: string): number {
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let remainder = 0
  for (const ch of rearranged) {
    const code = ch.charCodeAt(0)
    // A–Z → 10–35, Ziffern bleiben Ziffern
    const chunk =
      code >= 65 && code <= 90 ? String(code - 55) : ch
    for (const d of chunk) {
      remainder = (remainder * 10 + (d.charCodeAt(0) - 48)) % 97
    }
  }
  return remainder
}

/**
 * Gültige Schweizer IBAN: „CH" + 2 Prüfziffern + 17 Zeichen = 21 gesamt
 * (also CH + 19 Zeichen) UND korrekte Mod-97-Prüfsumme.
 */
export function isValidSwissIban(raw: string): boolean {
  const iban = normalizeIban(raw)
  if (!/^CH\d{2}[A-Z0-9]{17}$/.test(iban)) return false
  return ibanMod97(iban) === 1
}

/** Trenn-/Formatzeichen entfernen, +41/0041 → 0 (nationale Form 0XXXXXXXXX) */
export function normalizeSwissPhone(raw: string): string {
  let s = raw.replace(/[\s\-/().]/g, '')
  if (s.startsWith('+41')) s = '0' + s.slice(3)
  else if (s.startsWith('0041')) s = '0' + s.slice(4)
  return s
}

/**
 * Gültige Schweizer Rufnummer: nationale Form mit führender 0 und
 * 9 weiteren Ziffern (Total 10), z.B. 079 123 45 67 oder +41 79 123 45 67.
 */
export function isValidSwissPhone(raw: string): boolean {
  return /^0\d{9}$/.test(normalizeSwissPhone(raw))
}
