'use client'

import { ContactSection } from '@/components/listing/ContactSection'

export interface BuyerTransaction {
  id: string
  status: string
  amount: number
  payment_method: string | null
  created_at: string | null
  listing: {
    id: string
    title: string
    image_url: string | null
  } | null
}

interface Props {
  transactions: BuyerTransaction[]
}

/**
 * Käufer-Sicht auf die eigenen Käufe mit Statusverlauf:
 *  - pending   → „Wartet auf Bestätigung"
 *  - confirmed → „Bestätigt" + Kontaktdaten (NUR via get_transaction_contact-RPC)
 *  - completed → „Abgeschlossen"
 *
 * SICHERHEIT: Kontaktdaten werden nie hier geladen, sondern ausschliesslich in
 * <ContactSection role="buyer" />, die die SECURITY-DEFINER-RPC aufruft. Diese
 * liefert den Verkäufer-Kontakt nur an Beteiligte und nur bei status='confirmed'.
 */
export function BuyerDashboard({ transactions }: Props) {
  if (transactions.length === 0) {
    return (
      <div className="rounded-xl border border-glass-border bg-obsidian-3 p-6 text-center">
        <p className="text-white/60">Noch keine Käufe.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {transactions.map((tx) => (
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
                {tx.payment_method === 'twint' ? '📱 TWINT' : '💵 Bar'}
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
            </div>
          )}

          {/* CONFIRMED: Kontaktdaten via RPC freigeschaltet */}
          {tx.status === 'confirmed' && (
            <div className="mt-4">
              <ContactSection transactionId={tx.id} role="buyer" />
            </div>
          )}

          {/* COMPLETED: Deal abgeschlossen */}
          {tx.status === 'completed' && (
            <div className="mt-4 rounded-xl border border-uri-success/40 bg-emerald-900/20 p-4 text-center">
              <p className="font-display font-semibold text-uri-success">
                🏆 Abgeschlossen
              </p>
              <p className="mt-1 text-sm text-white/60">
                Übergabe erledigt. Danke für deinen Kauf!
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
