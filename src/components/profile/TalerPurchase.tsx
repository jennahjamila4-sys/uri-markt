'use client'

/**
 * Taler-Kauf-UI. Zeigt die Pakete (src/lib/taler.ts) und startet pro Paket einen
 * Stripe-Checkout via Server Action. Guthaben immer credits/100 als Taler.
 * Doppelklick-/Doppelkauf-Schutz: busyRef greift sofort, alle Buttons werden
 * waehrend der Anfrage deaktiviert. Fehler werden sichtbar gemeldet (Lektion 7).
 */
import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { TALER_PACKAGES, rappenToTaler } from '@/lib/taler'
import { createTalerCheckoutAction } from '@/app/actions/taler'

export function TalerPurchase({ credits }: { credits: number }) {
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const busyRef = useRef(false)

  // Rueckkehr von Stripe (success_url/cancel_url) sichtbar quittieren und den
  // Query-Parameter wieder aus der URL entfernen.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const state = params.get('taler')
    if (state === 'success') {
      toast.success('Zahlung erhalten! Deine Taler werden gutgeschrieben.')
    } else if (state === 'cancel') {
      toast.info('Kauf abgebrochen – es wurde nichts belastet.')
    }
    if (state) {
      params.delete('taler')
      const q = params.toString()
      window.history.replaceState({}, '', window.location.pathname + (q ? `?${q}` : ''))
    }
  }, [])

  async function buy(id: string) {
    if (busyRef.current) return // sofortiger Doppelklick-Schutz
    busyRef.current = true
    setLoadingId(id)
    setError(null)
    try {
      const { url } = await createTalerCheckoutAction(id)
      window.location.href = url // Weiterleitung zum Stripe-Checkout
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Kauf konnte nicht gestartet werden'
      setError(msg)
      toast.error(msg)
      busyRef.current = false
      setLoadingId(null)
    }
  }

  return (
    <div data-testid="taler-purchase" className="space-y-4">
      {/* Block 12: entlastend-ehrlicher Ton, Zahlen faktisch, keine Cash-out-Andeutung */}
      <div className="rounded-2xl border border-gold/30 bg-gold/[0.06] p-4">
        <h3 className="font-display text-lg font-bold text-gold">
          Uri-Taler — dein Beitrag, wenn&apos;s klappt.
        </h3>
        <p className="mt-1.5 text-sm leading-relaxed text-white/70">
          Inserieren ist kostenlos. Erst wenn du verkaufst, gehen 10% als Taler an die
          Plattform — so bleibt Uri-Markt werbefrei und fair.
        </p>
      </div>

      <div className="rounded-2xl border border-glass-border bg-obsidian-3 p-4 text-center">
        <p className="text-xs text-white/60">Aktuelles Guthaben</p>
        <p
          data-testid="taler-balance"
          className="font-display text-2xl font-bold text-gold"
        >
          {rappenToTaler(credits)} Taler
        </p>
      </div>

      {error && (
        <p
          data-testid="taler-purchase-error"
          className="rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300"
        >
          {error}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {TALER_PACKAGES.map((p) => (
          <div
            key={p.id}
            className={`relative rounded-2xl border p-4 ${
              p.popular
                ? 'border-gold/50 bg-gold/10'
                : 'border-glass-border bg-obsidian-3'
            }`}
          >
            {p.popular && (
              <span className="absolute right-3 top-3 rounded-full bg-gold px-2 py-0.5 text-xs font-bold text-obsidian">
                Beliebt
              </span>
            )}
            <div className="text-2xl">🪙</div>
            <p className="mt-1 font-display text-xl font-bold text-white">
              {p.taler} Taler
            </p>
            <p className="text-sm text-white/60">CHF {(p.rappen / 100).toFixed(2)}</p>
            {p.popular && (
              <p className="mt-1.5 text-xs leading-snug text-white/50">
                Genug für deine nächsten Deals — ohne dass du an Gebühren denken musst.
              </p>
            )}
            <button
              data-testid={`taler-buy-${p.id}`}
              onClick={() => buy(p.id)}
              disabled={loadingId !== null}
              className="mt-3 w-full rounded-xl bg-gold py-2 font-display font-bold text-obsidian transition hover:brightness-110 disabled:opacity-50"
            >
              {loadingId === p.id ? 'Wird geöffnet…' : 'Kaufen'}
            </button>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-white/40">
        Sichere Zahlung über Stripe. 1 Taler = CHF 1.00.
      </p>
    </div>
  )
}
