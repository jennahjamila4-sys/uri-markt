import { describe, it, expect } from 'vitest'
import { BuyIntentSchema } from './transaction'
import { PaymentInfoSchema } from './profile'

const UUID = '00000000-0000-0000-0000-000000000001'

describe('BuyIntentSchema', () => {
  it('akzeptiert bank + kurze Kontaktangabe "JJ"', () => {
    const r = BuyIntentSchema.safeParse({
      listing_id: UUID,
      payment_method: 'bank',
      buyer_contact: 'JJ',
    })
    expect(r.success).toBe(true)
  })

  it('akzeptiert cash und twint', () => {
    expect(
      BuyIntentSchema.safeParse({
        listing_id: UUID,
        payment_method: 'cash',
        buyer_contact: 'JJ',
      }).success
    ).toBe(true)
    expect(
      BuyIntentSchema.safeParse({
        listing_id: UUID,
        payment_method: 'twint',
        buyer_contact: 'max.mueller',
      }).success
    ).toBe(true)
  })

  it('lehnt zu kurze Kontaktangabe (<2) und unbekannte Zahlungsart ab', () => {
    expect(
      BuyIntentSchema.safeParse({
        listing_id: UUID,
        payment_method: 'bank',
        buyer_contact: 'J',
      }).success
    ).toBe(false)
    expect(
      BuyIntentSchema.safeParse({
        listing_id: UUID,
        payment_method: 'paypal',
        buyer_contact: 'JJ',
      }).success
    ).toBe(false)
  })
})

describe('PaymentInfoSchema', () => {
  it('akzeptiert die gültige Beispiel-IBAN + gültige Nummern', () => {
    const r = PaymentInfoSchema.safeParse({
      iban: 'CH9300762011623852957',
      twint_phone: '079 123 45 67',
      phone: '+41 79 123 45 67',
      address: 'Dorfstrasse 1, 6460 Altdorf',
      show_iban: true,
      show_twint: false,
      show_phone: true,
      show_address: false,
    })
    expect(r.success).toBe(true)
  })

  it('akzeptiert komplett leere Angaben (alles optional)', () => {
    const r = PaymentInfoSchema.safeParse({
      iban: '',
      twint_phone: '',
      phone: '',
      address: '',
      show_iban: false,
      show_twint: false,
      show_phone: false,
      show_address: false,
    })
    expect(r.success).toBe(true)
  })

  it('lehnt falsche IBAN-Prüfziffer ab und meldet die Prüfziffer', () => {
    const r = PaymentInfoSchema.safeParse({
      iban: 'CH9300762011623852958',
      twint_phone: '',
      phone: '',
      address: '',
      show_iban: false,
      show_twint: false,
      show_phone: false,
      show_address: false,
    })
    expect(r.success).toBe(false)
    if (!r.success) {
      const msg = r.error.flatten().fieldErrors.iban?.[0] ?? ''
      expect(msg).toContain('Prüfziffer')
    }
  })
})
