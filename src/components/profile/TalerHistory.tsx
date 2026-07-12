'use client'

/**
 * Taler-Transaktionshistorie (Tabelle `wallet_transactions`, RLS: nur eigene).
 * Beträge sind in Rappen gespeichert → Anzeige immer /100 als Taler.
 * Typen werden generisch gerendert (fällt auf Beschreibung/rohen Typ zurück),
 * damit später ergänzte Typen (z.B. Taler-Kauf via Stripe in Block 6) ohne
 * Code-Änderung sauber erscheinen.
 */
export interface WalletTxItem {
  id: string
  amount: number | null
  type: string | null
  description: string | null
  created_at: string | null
}

const TYPE_LABEL: Record<string, string> = {
  commission: 'Provision',
  commission_refund: 'Provision zurückerstattet',
  topup: 'Taler gekauft',
  purchase: 'Taler gekauft',
  boost: 'Inserat-Boost',
  referral: 'Einladungs-Bonus',
  signup_bonus: 'Startguthaben',
}

function fmtDate(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}

function fmtTaler(rappen: number): string {
  const taler = rappen / 100
  const prefix = taler > 0 ? '+' : '' // negative Werte tragen ihr eigenes Minus
  return `${prefix}${taler.toFixed(2)} Taler`
}

export function TalerHistory({ items }: { items: WalletTxItem[] }) {
  if (items.length === 0) {
    return (
      <div
        data-testid="taler-history-empty"
        className="rounded-2xl border border-glass-border bg-obsidian-3 p-6 text-center text-sm text-white/60"
      >
        🪙 Noch keine Taler-Bewegungen. Sobald du kaufst, verkaufst oder Taler
        auflädst, erscheint hier deine Historie.
      </div>
    )
  }

  return (
    <ul data-testid="taler-history-list" className="space-y-2">
      {items.map((t) => {
        const rappen = t.amount ?? 0
        const positive = rappen >= 0
        const label =
          (t.type && TYPE_LABEL[t.type]) || t.description || t.type || 'Bewegung'
        const showDesc = !!t.description && !!t.type && !!TYPE_LABEL[t.type]
        return (
          <li
            key={t.id}
            data-testid="taler-history-item"
            className="flex items-center justify-between gap-3 rounded-2xl border border-glass-border bg-obsidian-3 p-4"
          >
            <div className="min-w-0">
              <p className="truncate font-semibold text-white">{label}</p>
              {showDesc && (
                <p className="truncate text-xs text-white/50">{t.description}</p>
              )}
              <p className="mt-0.5 text-xs text-white/40">
                {fmtDate(t.created_at)}
              </p>
            </div>
            <span
              className={`shrink-0 font-display font-bold ${
                positive ? 'text-uri-success' : 'text-uri-danger'
              }`}
            >
              {fmtTaler(rappen)}
            </span>
          </li>
        )
      })}
    </ul>
  )
}
