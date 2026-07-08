'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  confirmSaleAction,
  rejectTransactionAction,
  completeTransactionAction,
  reportNoShowAction,
} from '@/app/actions/transactions'
import { ContactSection } from './ContactSection'
import { ReviewModal } from './ReviewModal'

export interface SellerTransaction {
  id: string
  status: string
  amount: number
  commission: number
  payment_method: string | null
  created_at: string | null
  listing: {
    id: string
    title: string
    image_url: string | null
  } | null
}

interface Props {
  transactions: SellerTransaction[]
  /** Aktuelles Taler-Guthaben des Verkäufers */
  credits: number
}

export function SellerDashboard({ transactions, credits }: Props) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [reviewTxId, setReviewTxId] = useState<string | null>(null)

  // credits ist in Rappen (1 Taler = 100). Für Anzeige und für den Vergleich
  // gegen die in Talern geführte Provision in Taler umrechnen.
  const creditsInTaler = credits / 100

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-glass-border bg-obsidian-3 p-6 text-center">
        <p className="text-white/60">Keine offenen Verkäufe.</p>
      </div>
    )
  }

  const run = async (
    id: string,
    fn: () => Promise<unknown>,
    successMsg: string
  ): Promise<boolean> => {
    setPendingId(id)
    try {
      await fn()
      toast.success(successMsg)
      return true
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Aktion fehlgeschlagen')
      return false
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="space-y-4">
      {transactions.map((tx) => {
        const busy = pendingId === tx.id
        // Vergleich in derselben Einheit: creditsInTaler (Taler) gegen die
        // in Talern geführte Provision tx.commission.
        const enoughCredits = creditsInTaler >= tx.commission

        return (
          <div
            key={tx.id}
            className="rounded-2xl border border-glass-border bg-obsidian-3 p-4"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-obsidian-4 text-xl">
                📦
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-display font-bold text-white">
                  {tx.listing?.title ?? 'Inserat'}
                </p>
                <p className="text-sm text-white/60">Kaufinteressent · anonym</p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-gold">
                  CHF {tx.amount.toFixed(2)}
                </p>
                <p className="text-xs text-white/50">
                  {tx.payment_method === 'twint' ? '📱 TWINT' : '💵 Bar'}
                </p>
              </div>
            </div>

            {/* PENDING: Bestätigen / Ablehnen */}
            {tx.status === 'pending' && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-glass-border bg-obsidian-4 p-3 text-sm">
                  <div className="flex justify-between text-white/70">
                    <span>Provision (10%, in Talern)</span>
                    <span className="font-semibold text-white">
                      {tx.commission.toFixed(2)} Taler
                    </span>
                  </div>
                  <div className="mt-1 flex justify-between text-white/70">
                    <span>Dein Guthaben</span>
                    <span
                      className={
                        enoughCredits ? 'text-uri-success' : 'text-uri-danger'
                      }
                    >
                      {creditsInTaler.toFixed(2)} Taler
                    </span>
                  </div>
                </div>

                {!enoughCredits && (
                  <p className="text-xs text-uri-danger">
                    Nicht genug Uri-Taler für die Provision. Wallet aufladen
                    (bald verfügbar).
                  </p>
                )}

                <div className="flex gap-2">
                  <button
                    disabled={busy || !enoughCredits}
                    onClick={() =>
                      run(
                        tx.id,
                        () => confirmSaleAction(tx.id),
                        'Verkauf bestätigt – Kontaktdaten freigeschaltet!'
                      )
                    }
                    className="flex-1 rounded-lg bg-uri-success py-3 font-display font-bold text-obsidian transition hover:opacity-90 disabled:opacity-40"
                  >
                    {busy ? '…' : '✅ Bestätigen'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(
                        tx.id,
                        () => rejectTransactionAction(tx.id),
                        'Anfrage abgelehnt'
                      )
                    }
                    className="flex-1 rounded-lg border border-glass-border py-3 font-display font-bold text-white/70 transition hover:border-uri-danger/60 hover:text-uri-danger disabled:opacity-40"
                  >
                    ❌ Ablehnen
                  </button>
                </div>
              </div>
            )}

            {/* CONFIRMED: Kontakt + Übergabe / No-Show */}
            {tx.status === 'confirmed' && (
              <div className="mt-4 space-y-3">
                <ContactSection transactionId={tx.id} role="seller" />
                <div className="flex gap-2">
                  <button
                    disabled={busy}
                    onClick={async () => {
                      const ok = await run(
                        tx.id,
                        () => completeTransactionAction(tx.id),
                        'Übergabe abgeschlossen – XP verdient! 🏆'
                      )
                      if (ok) setReviewTxId(tx.id)
                    }}
                    className="flex-1 rounded-lg bg-gold py-3 font-display font-bold text-obsidian transition hover:opacity-90 disabled:opacity-40"
                  >
                    {busy ? '…' : '🤝 Übergabe abgeschlossen'}
                  </button>
                  <button
                    disabled={busy}
                    onClick={() =>
                      run(
                        tx.id,
                        () => reportNoShowAction(tx.id),
                        'No-Show gemeldet – Provision zurückerstattet'
                      )
                    }
                    className="rounded-lg border border-glass-border px-4 py-3 font-display font-bold text-white/70 transition hover:border-uri-danger/60 hover:text-uri-danger disabled:opacity-40"
                  >
                    ⚠️ No-Show
                  </button>
                </div>
              </div>
            )}

            {/* COMPLETED: Verkauf abgeschlossen – nur Statusanzeige, kein Kontakt/Buttons */}
            {tx.status === 'completed' && (
              <div className="mt-4 rounded-xl border border-uri-success/40 bg-emerald-900/20 p-4 text-center">
                <p className="font-display font-semibold text-uri-success">
                  🏆 Abgeschlossen
                </p>
                <p className="mt-1 text-sm text-white/60">
                  Übergabe erledigt. Provision wurde abgezogen.
                </p>
              </div>
            )}
          </div>
        )
      })}

      {reviewTxId && (
        <ReviewModal
          transactionId={reviewTxId}
          onClose={() => setReviewTxId(null)}
        />
      )}
    </div>
  )
}
