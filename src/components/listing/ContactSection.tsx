'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  transactionId: string
  /** Rolle des aktuellen Users in dieser Transaktion */
  role: 'buyer' | 'seller'
}

/**
 * Rückgabe der RPC `get_transaction_contact` (jsonb):
 *  - Käufer (status='confirmed'): nur die vom Verkäufer FREIGEGEBENEN Felder
 *    (iban/twint_phone/phone/address – nicht freigegebene sind null)
 *  - Verkäufer: buyer_contact
 *  - Fehler/kein Zugriff: { success: false, error: '...' }
 */
interface ContactResult {
  success?: boolean
  error?: string
  iban?: string | null
  twint_phone?: string | null
  phone?: string | null
  address?: string | null
  buyer_contact?: string | null
}

/**
 * SICHERHEIT: Kontaktdaten kommen AUSSCHLIESSLICH aus der SECURITY-DEFINER-RPC
 * `get_transaction_contact`. Die Funktion liefert nur an Beteiligte, nur bei
 * status='confirmed' und beim Käufer nur die freigegebenen Felder. Es wird nie
 * display:none o.ä. als „Schutz" verwendet – nicht Freigegebenes kommt gar nicht
 * erst über die Leitung. Alles läuft in try/catch: nie ein Endlos-Spinner.
 */
export function ContactSection({ transactionId, role }: Props) {
  const supabase = createClient()
  const [data, setData] = useState<ContactResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        const { data: rpcData, error } = await supabase.rpc(
          'get_transaction_contact',
          { p_transaction_id: transactionId }
        )
        if (!mounted) return
        if (error) {
          console.warn('[ContactSection]', error.message)
          setFailed(true)
          return
        }
        const rec = (rpcData ?? null) as unknown as ContactResult | null
        if (rec && rec.success === false) {
          console.warn('[ContactSection]', rec.error)
          setFailed(true)
          return
        }
        setData(rec)
      } catch (err) {
        if (mounted) {
          console.error('[ContactSection]', err)
          setFailed(true)
        }
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [transactionId, supabase])

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    )
  }

  if (failed) {
    return (
      <div className="rounded-xl border border-amber-600/40 bg-amber-900/20 p-4 text-center">
        <p className="font-display font-semibold text-amber-400">
          😬 Hoppla, das hat gerade nicht geklappt
        </p>
        <p className="mt-1 text-sm text-white/60">
          Die Kontaktdaten liessen sich nicht laden. Lade die Seite kurz neu.
        </p>
      </div>
    )
  }

  // Käufer-Sicht: die vom Verkäufer freigegebenen Zahlungs-/Abhol-Felder
  if (role === 'buyer') {
    const fields = [
      { label: '🏦 IBAN', value: data?.iban },
      { label: '📲 TWINT', value: data?.twint_phone },
      { label: '📞 Telefon', value: data?.phone },
      { label: '📍 Adresse', value: data?.address },
    ].filter((f) => f.value)

    if (fields.length === 0) {
      return (
        <div className="rounded-xl border border-glass-border bg-obsidian-3 p-4 text-center">
          <p className="font-display font-semibold text-white/80">
            📭 Noch keine Kontaktdaten
          </p>
          <p className="mt-1 text-sm text-white/55">
            Der Verkäufer hat noch keine Kontaktdaten hinterlegt. Stupse ihn doch
            kurz an! 👋
          </p>
        </div>
      )
    }

    return (
      <div className="rounded-xl border border-uri-success/40 bg-emerald-900/20 p-4">
        <p className="font-display font-semibold text-uri-success">
          ✅ Kontaktdaten freigeschaltet – ab zur Übergabe! 🤝
        </p>
        <div className="mt-3 space-y-2">
          {fields.map((f) => (
            <div
              key={f.label}
              className="rounded-lg border border-glass-border bg-obsidian-4 p-3"
            >
              <p className="text-xs text-white/60">{f.label}</p>
              <p className="select-all font-body text-lg font-semibold text-white">
                {f.value}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-white/50">
          Macht einen Termin zur Übergabe aus. Bezahlt wird direkt zwischen euch.
        </p>
      </div>
    )
  }

  // Verkäufer-Sicht: Kontakt des Käufers
  const buyerContact = data?.buyer_contact
  if (!buyerContact) {
    return (
      <div className="rounded-xl border border-glass-border bg-obsidian-3 p-4 text-center">
        <p className="font-display font-semibold text-white/80">
          📭 Noch keine Kontaktdaten
        </p>
        <p className="mt-1 text-sm text-white/55">
          Der Käufer hat noch keine Kontaktdaten hinterlegt.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-uri-success/40 bg-emerald-900/20 p-4">
      <p className="font-display font-semibold text-uri-success">
        ✅ Käufer-Kontakt freigeschaltet – ab zur Übergabe! 🤝
      </p>
      <div className="mt-3 rounded-lg border border-glass-border bg-obsidian-4 p-3">
        <p className="text-xs text-white/60">👤 Käufer-Kontakt</p>
        <p className="select-all font-body text-lg font-semibold text-white">
          {buyerContact}
        </p>
      </div>
      <p className="mt-2 text-xs text-white/50">
        Macht einen Termin zur Übergabe aus. Bezahlt wird direkt zwischen euch.
      </p>
    </div>
  )
}
