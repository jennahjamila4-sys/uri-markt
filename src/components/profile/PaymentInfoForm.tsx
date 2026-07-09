'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { savePaymentInfoAction } from '@/app/actions/profile'
import { PaymentInfoSchema } from '@/lib/validations/profile'
import { isValidSwissIban, isValidSwissPhone } from '@/lib/validators/swiss'

export interface PaymentInfo {
  iban: string | null
  twint_phone: string | null
  phone: string | null
  address: string | null
  show_iban: boolean
  show_twint: boolean
  show_phone: boolean
  show_address: boolean
}

interface Props {
  /** Bereits gespeicherte Daten (serverseitig geladen) – null wenn noch nichts hinterlegt */
  initial: PaymentInfo | null
}

type FieldKey = 'iban' | 'twint_phone' | 'phone' | 'address'
type ShowKey = 'show_iban' | 'show_twint' | 'show_phone' | 'show_address'

const FIELDS: {
  key: FieldKey
  show: ShowKey
  label: string
  emoji: string
  placeholder: string
}[] = [
  { key: 'iban', show: 'show_iban', label: 'IBAN', emoji: '🏦', placeholder: 'CH.. .... .... .... ....' },
  { key: 'twint_phone', show: 'show_twint', label: 'TWINT-Nummer', emoji: '📲', placeholder: '079 123 45 67' },
  { key: 'phone', show: 'show_phone', label: 'Telefon', emoji: '📞', placeholder: '079 123 45 67' },
  { key: 'address', show: 'show_address', label: 'Adresse (für Abholung)', emoji: '📍', placeholder: 'Strasse Nr, PLZ Ort' },
]

/** Sofortige, freundliche Einzelfeld-Prüfung (nur wenn befüllt). */
function validateField(key: FieldKey, value: string): string | null {
  const v = value.trim()
  if (!v) return null
  if (key === 'iban' && !isValidSwissIban(v))
    return 'Hoppla, die IBAN stimmt so nicht 🤔 (Schweizer IBAN: CH + 19 Zeichen)'
  if ((key === 'twint_phone' || key === 'phone') && !isValidSwissPhone(v))
    return 'Diese Nummer sieht nicht schweizerisch aus 🇨🇭 (z.B. 079 123 45 67)'
  return null
}

export function PaymentInfoForm({ initial }: Props) {
  const [form, setForm] = useState({
    iban: initial?.iban ?? '',
    twint_phone: initial?.twint_phone ?? '',
    phone: initial?.phone ?? '',
    address: initial?.address ?? '',
    show_iban: initial?.show_iban ?? false,
    show_twint: initial?.show_twint ?? false,
    show_phone: initial?.show_phone ?? false,
    show_address: initial?.show_address ?? false,
  })
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    // Clientseitige Prüfung mit demselben Schema wie der Server (doppelt).
    const parsed = PaymentInfoSchema.safeParse(form)
    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors
      const next: Partial<Record<FieldKey, string>> = {}
      ;(['iban', 'twint_phone', 'phone', 'address'] as FieldKey[]).forEach((k) => {
        const msg = fieldErrors[k]?.[0]
        if (msg) next[k] = msg
      })
      setErrors(next)
      toast.error('Bitte kurz die markierten Felder prüfen 👀')
      return
    }

    setErrors({})
    setSaving(true)
    try {
      await savePaymentInfoAction(form)
      toast.success('Zahlungs-Infos gespeichert! 💪')
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : 'Speichern hat nicht geklappt 😕'
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4">
        <p className="font-display font-bold text-gold">
          💳 So wirst du bezahlt
        </p>
        <p className="mt-1 text-sm text-white/70">
          Hinterlege einmal deine Zahlungs- und Abhol-Infos. Mit dem Haken
          „Käufer darf das sehen“ gibst du frei, was der Käufer{' '}
          <b className="text-white/90">erst nach deiner Bestätigung</b> zu sehen
          bekommt – niemand sonst. 🔒
        </p>
      </div>

      {FIELDS.map((f) => (
        <div
          key={f.key}
          className="space-y-2 rounded-2xl border border-glass-border bg-obsidian-3 p-4"
        >
          <label className="flex items-center gap-2 text-sm font-semibold text-white/90">
            <span>{f.emoji}</span>
            {f.label}
          </label>
          <input
            type="text"
            value={form[f.key]}
            onChange={(e) => {
              const value = e.target.value
              setForm((p) => ({ ...p, [f.key]: value }))
              // Vorhandenen Fehler beim Tippen wegnehmen
              if (errors[f.key]) setErrors((p) => ({ ...p, [f.key]: undefined }))
            }}
            onBlur={(e) => {
              const msg = validateField(f.key, e.target.value)
              setErrors((p) => ({ ...p, [f.key]: msg ?? undefined }))
            }}
            placeholder={f.placeholder}
            className={`w-full rounded-xl border bg-obsidian-4 px-3 py-2.5 text-white placeholder:text-white/30 focus:outline-none ${
              errors[f.key]
                ? 'border-uri-danger focus:border-uri-danger'
                : 'border-glass-border focus:border-gold/50'
            }`}
          />
          {errors[f.key] && (
            <p className="text-xs text-uri-danger">{errors[f.key]}</p>
          )}
          <label className="flex cursor-pointer items-center gap-2 text-sm text-white/70">
            <input
              type="checkbox"
              checked={form[f.show]}
              onChange={(e) =>
                setForm((p) => ({ ...p, [f.show]: e.target.checked }))
              }
              className="h-4 w-4 accent-gold"
            />
            👀 Käufer darf das sehen
          </label>
        </div>
      ))}

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-xl bg-gold py-3 font-display font-bold text-obsidian transition hover:bg-gold-lt active:scale-95 disabled:opacity-50"
      >
        {saving ? 'Speichert…' : '✅ Speichern'}
      </button>
    </div>
  )
}
