'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Props {
  transactionId: string
  /** Rolle des aktuellen Users in dieser Transaktion */
  role: 'buyer' | 'seller'
}

interface ContactData {
  buyer_contact: string | null
  seller_contact: string | null
}

/**
 * SICHERHEIT: Kontaktdaten werden NUR über die SECURITY-DEFINER-RPC
 * `get_transaction_contact` geladen. Diese gibt buyer_contact/seller_contact
 * ausschliesslich an Beteiligte (Käufer/Verkäufer) und erst nach Freigabe
 * heraus. Es wird NIEMALS display:none o.ä. als Schutz verwendet – sind die
 * Daten nicht freigegeben, liefert die Funktion gar nichts erst zurück.
 */
export function ContactSection({ transactionId, role }: Props) {
  const supabase = createClient()
  const [data, setData] = useState<ContactData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)(
        'get_transaction_contact',
        { p_transaction_id: transactionId }
      )
      if (mounted) {
        if (error) console.warn('[ContactSection]', error.message)
        // Die RPC gibt einen Record (oder eine 1-elementige Liste) zurück.
        const rec = Array.isArray(data) ? data[0] : data
        setData(rec ?? null)
        setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [transactionId, supabase])

  // Kontakt der Gegenseite (erst nach Freigabe von der RPC geliefert)
  const contact = role === 'buyer' ? data?.seller_contact : data?.buyer_contact

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-gold border-t-transparent" />
      </div>
    )
  }

  // Noch nicht freigegeben → Wartehinweis (die RPC liefert die Kontaktdaten noch nicht)
  if (!data || !contact) {
    return (
      <div className="rounded-xl border border-amber-600/40 bg-amber-900/20 p-4 text-center">
        <p className="font-display font-semibold text-amber-400">
          ⏳ Wartet auf Verkäufer-Bestätigung
        </p>
        <p className="mt-1 text-sm text-white/60">
          Sobald der Verkäufer bestätigt, werden die Kontaktdaten hier
          freigeschaltet.
        </p>
      </div>
    )
  }

  // Freigegeben → Kontaktdaten der Gegenseite anzeigen
  const label = role === 'buyer' ? 'Verkäufer-Kontakt' : 'Käufer-Kontakt'

  return (
    <div className="rounded-xl border border-uri-success/40 bg-emerald-900/20 p-4">
      <p className="font-display font-semibold text-uri-success">
        ✅ Kontaktdaten freigeschaltet
      </p>
      <div className="mt-3 rounded-lg border border-glass-border bg-obsidian-4 p-3">
        <p className="text-xs text-white/60">{label}</p>
        <p className="select-all font-body text-lg font-semibold text-white">
          {contact ?? '—'}
        </p>
      </div>
      <p className="mt-2 text-xs text-white/50">
        Macht einen Termin zur Übergabe aus. Bezahlt wird direkt vor Ort.
      </p>
    </div>
  )
}
