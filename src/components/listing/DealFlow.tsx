'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { createBuyIntentAction } from '@/app/actions/transactions'
import type { Listing, Profile } from '@/types'

interface Props {
  listing: Listing
  currentUser: Profile | null
}

export function DealFlow({ listing, currentUser }: Props) {
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'twint'>('cash')
  const [buyerContact, setBuyerContact] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [agreedToIntent, setAgreedToIntent] = useState(false)

  // Case 1: Listing is sold – show FOMO zone
  if (listing.status === 'sold') {
    const hoursRemaining = listing.fomo_expires_at
      ? Math.max(0, Math.round((new Date(listing.fomo_expires_at).getTime() - Date.now()) / 3600000))
      : 0

    return (
      <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 text-center">
        <p className="text-red-400 font-semibold">❌ Bereits verkauft</p>
        <p className="text-white/60 text-sm mt-1">
          Noch {hoursRemaining}h in der FOMO-Zone sichtbar
        </p>
      </div>
    )
  }

  // Case 2: Listing is reserved
  if (listing.status === 'reserved') {
    return (
      <div className="bg-amber-900/20 border border-amber-600 rounded-lg p-4 text-center">
        <p className="text-amber-400 font-semibold">⏳ Bereits reserviert</p>
        <p className="text-white/60 text-sm mt-1">
          Jemand anderes interessiert sich dafür
        </p>
      </div>
    )
  }

  // Case 3: User is seller
  if (currentUser && currentUser.id === listing.user_id) {
    return (
      <div className="bg-obsidian-2 border border-glass-border rounded-lg p-4 text-center">
        <p className="text-white/70">📍 Das ist dein Inserat</p>
      </div>
    )
  }

  // Case 4: Active listing – show buy button
  return (
    <>
      <div className="space-y-4">
        {/* Price section */}
        <div className="bg-gradient-to-r from-gold/10 to-amber-600/10 border border-gold/30 rounded-lg p-6 text-center">
          <div className="text-3xl font-bold text-gold">
            CHF {(listing.price ?? 0).toFixed(2)}
          </div>
          <p className="text-uri-success text-sm mt-2">
            Für dich provisionsfrei – du zahlst nur den Preis
          </p>
        </div>

        {/* Buy button */}
        <button
          onClick={() => {
            if (!currentUser) {
              toast.error('Bitte melde dich an')
              return
            }
            setShowBuyModal(true)
          }}
          className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white font-bold rounded-lg hover:shadow-lg hover:shadow-green-500/50 transition-all"
        >
          🛒 Kaufen
        </button>
      </div>

      {/* Buy Intent Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowBuyModal(false)}
          />

          <div className="relative max-h-[80dvh] w-full animate-slide-up overflow-y-auto rounded-t-3xl bg-obsidian-3 p-6 shadow-modal">
            <h3 className="text-xl font-display font-bold text-white mb-6">
              Kaufabsicht bestätigen
            </h3>

            {/* Price display – Käufer zahlt NUR den Preis, keine Provision */}
            <div className="bg-obsidian-2 rounded-lg p-4 mb-6">
              <div className="flex justify-between text-white">
                <span>Dein Preis:</span>
                <span className="font-bold">CHF {(listing.price ?? 0).toFixed(2)}</span>
              </div>
              <p className="mt-2 text-xs text-uri-success">
                Provisionsfrei – die Provision trägt der Verkäufer.
              </p>
            </div>

            {/* Payment method */}
            <div className="mb-6">
              <label className="block text-white/70 text-sm mb-3">Zahlungsart</label>
              <div className="space-y-2">
                {(['cash', 'twint'] as const).map((method) => (
                  <label key={method} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      name="payment"
                      value={method}
                      checked={paymentMethod === method}
                      onChange={(e) => setPaymentMethod(e.target.value as 'cash' | 'twint')}
                      className="w-4 h-4 accent-gold"
                    />
                    <span className="text-white">
                      {method === 'cash' ? '💵 Bar bezahlen' : '📱 TWINT'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Contact info */}
            <div className="mb-6">
              <label className="block text-white/70 text-sm mb-2">
                Deine Kontaktinfo {paymentMethod === 'twint' ? '(TWINT-Name)' : '(Telefon)'}
              </label>
              <input
                type="text"
                value={buyerContact}
                onChange={(e) => setBuyerContact(e.target.value)}
                placeholder={paymentMethod === 'twint' ? 'z.B. max.mueller' : '+41 79 123 45 67'}
                className="w-full px-4 py-3 bg-obsidian-2 border border-glass-border rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-gold"
              />
            </div>

            {/* Checkbox */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToIntent}
                onChange={(e) => setAgreedToIntent(e.target.checked)}
                className="w-4 h-4 accent-gold mt-1"
              />
              <span className="text-white/70 text-sm">
                Ich möchte dieses Inserat verbindlich kaufen und den Verkäufer kontaktieren.
              </span>
            </label>

            {/* Action buttons */}
            <div className="space-y-3">
              <button
                onClick={async () => {
                  if (!buyerContact) {
                    toast.error('Kontaktinfo erforderlich')
                    return
                  }
                  if (!agreedToIntent) {
                    toast.error('Bitte akzeptiere die Bedingungen')
                    return
                  }

                  setIsLoading(true)
                  try {
                    await createBuyIntentAction({
                      listing_id: listing.id,
                      payment_method: paymentMethod,
                      buyer_contact: buyerContact,
                    })

                    toast.success('✓ Kaufanfrage gesendet! Der Verkäufer wird benachrichtigt.')
                    setShowBuyModal(false)
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Fehler beim Senden')
                  } finally {
                    setIsLoading(false)
                  }
                }}
                disabled={isLoading || !agreedToIntent}
                className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 disabled:opacity-50 transition-all"
              >
                {isLoading ? 'Wird gesendet...' : '✓ Kaufabsicht senden'}
              </button>

              <button
                onClick={() => setShowBuyModal(false)}
                className="w-full py-3 bg-obsidian-2 border border-glass-border text-white font-bold rounded-lg hover:border-white/20 transition-all"
              >
                Abbrechen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
