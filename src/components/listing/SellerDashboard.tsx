'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  confirmSaleAction,
  rejectTransactionAction,
  completeTransactionAction,
  reportNoShowAction,
} from '@/app/actions/transactions'
import { ContactSection } from './ContactSection'
import { ReviewModal } from './ReviewModal'
import { CoffeeModal } from './CoffeeModal'
import { paymentMethodShort } from '@/lib/paymentMethod'
import { useMinuteTick, dealRemainingText } from '@/lib/reservation'

export interface SellerTransaction {
  id: string
  status: string
  amount: number
  commission: number
  payment_method: string | null
  created_at: string | null
  buyer_completed_at: string | null
  seller_completed_at: string | null
  listing: {
    id: string
    title: string
    image_url: string | null
    /** öffentlicher 48h-Ablauf; einzige Wahrheit für den Deal-Countdown (TEIL 6) */
    reserved_until: string | null
  } | null
}

interface Props {
  transactions: SellerTransaction[]
  /** Aktuelles Taler-Guthaben des Verkäufers */
  credits: number
  /** Transaktions-IDs, die der Nutzer bereits bewertet hat */
  reviewedTxIds: string[]
}

export function SellerDashboard({ transactions, credits, reviewedTxIds }: Props) {
  const router = useRouter()
  const now = useMinuteTick()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [reviewTxId, setReviewTxId] = useState<string | null>(null)
  // Block 10: Kaffee-Modal nach Annahme eines Gratis-Inserats (Provisions-Moment).
  const [coffeeOpen, setCoffeeOpen] = useState(false)
  // Guthaben lokal halten, damit eine Spende den angezeigten Stand sofort aktualisiert.
  const [walletCredits, setWalletCredits] = useState(credits)

  // credits ist in Rappen (1 Taler = 100). Für Anzeige und für den Vergleich
  // gegen die in Talern geführte Provision in Taler umrechnen.
  const creditsInTaler = walletCredits / 100

  // Verkauf annehmen (Provisions-Moment). Bei einem Gratis-Inserat erscheint
  // danach EINMAL das Kaffee-Modal — nie blockierend, die Annahme ist schon durch.
  const handleConfirm = async (id: string) => {
    setPendingId(id)
    try {
      const res = await confirmSaleAction(id)
      toast.success('Verkauf bestätigt – Kontaktdaten freigeschaltet!')
      if (res.isFree) setCoffeeOpen(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Aktion fehlgeschlagen')
    } finally {
      setPendingId(null)
    }
  }

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

  // Übergabe bestätigen: die RPC schliesst erst ab, wenn BEIDE bestätigt haben.
  // Rückmeldung je nach Ergebnis unterschiedlich (Lektion 6: nie stumm).
  const handleComplete = async (id: string) => {
    setPendingId(id)
    try {
      const res = await completeTransactionAction(id)
      if (res.status === 'completed') {
        toast.success('Übergabe abgeschlossen – XP verdient! 🏆')
        if (!reviewedTxIds.includes(id)) setReviewTxId(id)
      } else {
        toast.success('Deine Bestätigung ist da – warten auf die Gegenseite ⏳')
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Aktion fehlgeschlagen')
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
        // Hat der Verkäufer selbst die Übergabe schon bestätigt?
        const selfCompleted = !!tx.seller_completed_at
        const reviewed = reviewedTxIds.includes(tx.id)
        // TEIL 6: Deal-Countdown aus der einen Wahrheit reserved_until.
        const remaining = dealRemainingText(tx.listing?.reserved_until, now)

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
                  {paymentMethodShort(tx.payment_method)}
                </p>
              </div>
            </div>

            {/* PENDING: Bestätigen / Ablehnen */}
            {tx.status === 'pending' && (
              <div className="mt-4 space-y-3">
                <p
                  data-testid="seller-countdown"
                  className="rounded-lg border border-amber-600/30 bg-amber-900/15 px-3 py-2 text-xs text-amber-300"
                >
                  {remaining
                    ? `⏳ Noch ${remaining.replace(/^noch /, '')}, um die Anfrage anzunehmen — sonst wird das Inserat wieder frei.`
                    : '⏳ Bis zu 48h reserviert — danach wird das Inserat wieder frei.'}
                </p>
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
                    onClick={() => handleConfirm(tx.id)}
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

            {/* CONFIRMED: Kontakt bleibt sichtbar. Solange der Verkäufer NICHT
                selbst bestätigt hat → Übergabe-/No-Show-Buttons. Danach →
                Warten auf die Gegenseite (Kontakt bleibt sichtbar). */}
            {tx.status === 'confirmed' && (
              <div className="mt-4 space-y-3">
                {remaining && (
                  <p
                    data-testid="seller-countdown"
                    className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-semibold text-gold"
                  >
                    ⏳ Noch {remaining.replace(/^noch /, '')} — schliesst euren Deal
                    zu „{tx.listing?.title ?? 'diesem Inserat'}“ ab, sonst geht er
                    automatisch zurück in den Markt und jemand anderes greift zu.
                  </p>
                )}
                <ContactSection transactionId={tx.id} role="seller" />
                {selfCompleted ? (
                  <div className="rounded-xl border border-amber-600/40 bg-amber-900/20 p-4 text-center">
                    <p className="font-display font-semibold text-amber-400">
                      ⏳ Wartet auf Bestätigung der Gegenseite
                    </p>
                    <p className="mt-1 text-sm text-white/60">
                      Du hast die Übergabe bestätigt. Sobald der Käufer auch
                      bestätigt, ist der Deal abgeschlossen.
                    </p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      disabled={busy}
                      onClick={() => handleComplete(tx.id)}
                      className="flex-1 rounded-lg bg-gold py-3 font-display font-bold text-obsidian transition hover:opacity-90 disabled:opacity-40"
                    >
                      {busy ? '…' : '✅ Übergabe bestätigen'}
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
                )}
              </div>
            )}

            {/* COMPLETED: kein Kontakt mehr – Badge + Bewertungs-Aufforderung */}
            {tx.status === 'completed' && (
              <div className="mt-4 rounded-xl border border-uri-success/40 bg-emerald-900/20 p-4 text-center">
                <p className="font-display font-semibold text-uri-success">
                  🏆 Abgeschlossen
                </p>
                <p className="mt-1 text-sm text-white/60">
                  Übergabe erledigt. Provision wurde abgezogen.
                </p>
                {reviewed ? (
                  <p className="mt-3 text-sm font-semibold text-gold">
                    ⭐ Bewertet – merci!
                  </p>
                ) : (
                  <button
                    onClick={() => setReviewTxId(tx.id)}
                    className="btn-gold mt-3 rounded-lg px-4 py-2 font-display font-bold"
                  >
                    ⭐ Jetzt bewerten
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {reviewTxId && (
        <ReviewModal
          transactionId={reviewTxId}
          onClose={() => setReviewTxId(null)}
          onSubmitted={() => router.refresh()}
        />
      )}

      {coffeeOpen && (
        <CoffeeModal
          onDonated={(newBalanceRappen) => setWalletCredits(newBalanceRappen)}
          onClose={() => {
            setCoffeeOpen(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}
