import { describe, it, expect } from 'vitest'
import {
  checkSwissIban,
  isValidSwissIban,
  isValidSwissPhone,
  normalizeSwissPhone,
} from './swiss'

describe('Schweizer IBAN', () => {
  it('akzeptiert die offizielle Beispiel-IBAN (auch mit Leerzeichen/klein)', () => {
    expect(isValidSwissIban('CH9300762011623852957')).toBe(true)
    expect(isValidSwissIban('CH93 0076 2011 6238 5295 7')).toBe(true)
    expect(isValidSwissIban('ch9300762011623852957')).toBe(true)
    // Zweite bekannt gültige CH-IBAN (PostFinance-Beispiel)
    expect(isValidSwissIban('CH4431999123000889012')).toBe(true)
  })

  it('erkennt falsche Prüfziffer als "checksum"', () => {
    // letzte Ziffer verändert → Format ok, Prüfsumme falsch
    expect(checkSwissIban('CH9300762011623852958')).toBe('checksum')
  })

  it('erkennt falsche Länge als "format"', () => {
    expect(checkSwissIban('CH930076201162385295')).toBe('format') // 20 Zeichen
    expect(checkSwissIban('CH93007620116238529570')).toBe('format') // 22 Zeichen
  })

  it('erkennt falsches Land als "format"', () => {
    expect(checkSwissIban('DE89370400440532013000')).toBe('format')
  })

  it('gültige IBAN ist "ok"', () => {
    expect(checkSwissIban('CH9300762011623852957')).toBe('ok')
  })
})

describe('Schweizer Telefon', () => {
  it('akzeptiert gültige Nummern (mit/ohne Leerzeichen, +41, 0041)', () => {
    for (const n of [
      '079 123 45 67',
      '0791234567',
      '041 870 11 22',
      '+41 79 123 45 67',
      '+41791234567',
      '0041 79 123 45 67',
      '079-123-45-67',
    ]) {
      expect(isValidSwissPhone(n), n).toBe(true)
    }
  })

  it('normalisiert +41 und 0041 auf nationale 0-Form', () => {
    expect(normalizeSwissPhone('+41 79 123 45 67')).toBe('0791234567')
    expect(normalizeSwissPhone('0041791234567')).toBe('0791234567')
  })

  it('lehnt ungültige Nummern ab', () => {
    expect(isValidSwissPhone('123')).toBe(false)
    expect(isValidSwissPhone('79 123 45 67')).toBe(false) // fehlende 0/+41
    expect(isValidSwissPhone('+49 30 1234567')).toBe(false) // Deutschland
    expect(isValidSwissPhone('079 123 45')).toBe(false) // zu kurz
  })
})
