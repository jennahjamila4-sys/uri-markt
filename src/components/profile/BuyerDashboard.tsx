'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ContactSection } from '@/components/listing/ContactSection'
import { ReviewModal } from '@/components/listing/ReviewModal'
import { completeTransactionAction } from '@/app/actions/transactions'
import { paymentMethodShort } from '@/lib/paymentMethod'
import { useMinuteTick, dealRemainingText } from '@/lib/reservation'

export interface BuyerTransaction {
  id: string
  status: string
  amount: number
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
  transactions: BuyerTransaction[]
  /** Transaktions-IDs, die der Nutzer bereits bewertet hat */
  reviewedTxIds: string[]
}

/**
 * Käufer-Sicht auf die eigenen Käufe mit Statusverlauf:
 *  - pending   → „Wartet auf Bestätigung"
 *  - confirmed → Kontaktdaten (NUR via get_transaction_contact-RPC) + eigene
 *                Übergabe-Bestätigung. Beidseitiger Abschluss: erst wenn Käufer
 *                UND Verkäufer bestätigt haben, wird der Deal `completed`.
 *  - completed → Kontakt weg, Badge + Bewertungs-Aufforderung.
 *
 * SICHERHEIT: Kontaktdaten werden nie hier geladen, sondern ausschliesslich in
 * <ContactSection role="buyer" />, die die SECURITY-DEFINER-RPC aufruft. Diese
 * liefert den Verkäufer-Kontakt nur an Beteiligte und nur bei status='confirmed'.
 */
export function BuyerDashboard({ transactions, reviewedTxIds }: Props) {
  const router = useRouter()
  const now = useMinuteTick()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [reviewTxId, setReviewTxId] = useState<string | null>(null)

  // Übergabe bestätigen: die RPC schliesst erst ab, wenn BEIDE bestätigt haben.
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

  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-glass-border bg-obsidian-3 p-6 text-center">
        <p className="text-white/60">Noch keine Käufe.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {transactions.map((tx) => {
        const busy = pendingId === tx.id
        // Hat der Käufer selbst die Übergabe schon bestätigt?
        const selfCompleted = !!tx.buyer_completed_at
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
                <p className="text-sm text-white/60">
                  {paymentMethodShort(tx.payment_method)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-gold">
                  CHF {tx.amount.toFixed(2)}
                </p>
              </div>
            </div>

            {/* PENDING: Wartet auf Verkäufer */}
            {tx.status === 'pending' && (
              <div className="mt-4 rounded-xl border border-amber-600/40 bg-amber-900/20 p-4 text-center">
                <p className="font-display font-semibold text-amber-400">
                  ⏳ Wartet auf Bestätigung
                </p>
                <p className="mt-1 text-sm text-white/60">
                  Sobald der Verkäufer bestätigt, werden die Kontaktdaten
                  freigeschaltet.
                </p>
                <p className="mt-2 text-xs text-amber-300/80">
                  ⏳ Bis zu 48h reserviert — danach wird das Inserat wieder frei.
                </p>
              </div>
            )}

            {/* CONFIRMED: Kontakt bleibt sichtbar. Solange der Käufer NICHT
                selbst bestätigt hat → Übergabe-Button. Danach → Warten auf
                die Gegenseite (Kontakt bleibt sichtbar). */}
            {tx.status === 'confirmed' && (
              <div className="mt-4 space-y-3">
                {remaining && (
                  <p
                    data-testid="buyer-countdown"
                    className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-sm font-semibold text-gold"
                  >
                    ⏳ Noch {remaining.replace(/^noch /, '')} — schliesst euren Deal
                    zu „{tx.listing?.title ?? 'diesem Inserat'}“ ab, sonst geht er
                    automatisch zurück in den Markt und jemand anderes greift zu.
                  </p>
                )}
                <ContactSection transactionId={tx.id} role="buyer" />
                {selfCompleted ? (
                  <div className="rounded-xl border border-amber-600/40 bg-amber-900/20 p-4 text-center">
                    <p className="font-display font-semibold text-amber-400">
                      ⏳ Wartet auf Bestätigung der Gegenseite
                    </p>
                    <p className="mt-1 text-sm text-white/60">
                      Du hast die Übergabe bestätigt. Sobald der Verkäufer auch
                      bestätigt, ist der Deal abgeschlossen.
                    </p>
                  </div>
                ) : (
                  <button
                    disabled={busy}
                    onClick={() => handleComplete(tx.id)}
                    className="w-full rounded-lg bg-gold py-3 font-display font-bold text-obsidian transition hover:opacity-90 disabled:opacity-40"
                  >
                    {busy ? '…' : '✅ Übergabe bestätigen'}
                  </button>
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
                  Übergabe erledigt. Danke für deinen Kauf!
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
    </div>
  )
}
