'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'

/**
 * BLOCK 10 — Kaffee-Modal im Provisions-Moment.
 * Erscheint EINMAL, nachdem der Verkäufer eine Kaufanfrage zu einem
 * price_type='free'-Inserat erfolgreich angenommen hat (die Annahme ist zu
 * diesem Zeitpunkt schon durch — dieses Modal ist nie blockierend).
 * Spende via RPC donate_coffee (100/300/500/1000 Rappen). RPC-Antwort wird
 * ehrlich angezeigt (Lektion 7).
 */

const AMOUNTS = [
  { chf: 1, rappen: 100 },
  { chf: 3, rappen: 300 },
  { chf: 5, rappen: 500 },
  { chf: 10, rappen: 1000 },
] as const

interface CoffeeModalProps {
  onClose: () => void
  /** Liefert den neuen Guthaben-Stand (Rappen) nach erfolgreicher Spende. */
  onDonated?: (newBalanceRappen: number) => void
}

export function CoffeeModal({ onClose, onDonated }: CoffeeModalProps) {
  const [busy, setBusy] = useState<number | null>(null)

  const donate = async (rappen: number) => {
    setBusy(rappen)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.rpc('donate_coffee', {
        p_amount_rappen: rappen,
      })
      if (error) {
        toast.error(`Spende fehlgeschlagen: ${error.message}`)
        return
      }
      const res = (data ?? {}) as {
        success?: boolean
        new_balance?: number
        error?: string
      }
      if (!res.success) {
        // Ehrlich anzeigen, was schiefging (Lektion 7) — nie stumm schlucken.
        toast.error(res.error ?? 'Spende fehlgeschlagen')
        return
      }
      const taler = (res.new_balance ?? 0) / 100
      toast.success(`Merci fürs Käffeli! ☕ Neuer Stand: ${taler.toFixed(2)} Taler`)
      if (res.new_balance != null) onDonated?.(res.new_balance)
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Spende fehlgeschlagen')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div
        data-testid="coffee-modal"
        className="relative w-full max-w-sm rounded-2xl border border-glass-border bg-obsidian-3 p-6 text-center shadow-modal"
      >
        <div className="text-4xl">🎉</div>
        <h3 className="mt-2 font-display text-xl font-bold text-white">Vergeben!</h3>
        <p className="mt-2 text-sm text-white/70">
          Dein Geschenk macht gerade jemanden aus Uri glücklich. Wenn dich das freut:
          Magst du Uri-Markt einen Kaffee spendieren? ☕
        </p>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {AMOUNTS.map((a) => (
            <button
              key={a.rappen}
              disabled={busy !== null}
              onClick={() => donate(a.rappen)}
              data-testid={`coffee-donate-${a.chf}`}
              className="btn-gold rounded-lg py-2 text-sm font-bold disabled:opacity-50"
            >
              CHF {a.chf}
            </button>
          ))}
        </div>
        <button
          onClick={onClose}
          disabled={busy !== null}
          data-testid="coffee-no-thanks"
          className="mt-3 w-full rounded-lg border border-glass-border py-2 text-sm text-white/60 disabled:opacity-50"
        >
          Nein danke
        </button>
      </div>
    </div>
  )
}
