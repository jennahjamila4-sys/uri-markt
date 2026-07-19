'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { createBuyIntentAction } from '@/app/actions/transactions'
import { getMyContactAction, rememberContactAction } from '@/app/actions/profile'
import { useMinuteTick, reservedRemainingText } from '@/lib/reservation'
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/paymentMethod'
import type { Listing, Profile } from '@/types'

interface Props {
  listing: Listing
  currentUser: Profile | null
}

export function DealFlow({ listing, currentUser }: Props) {
  const [showBuyModal, setShowBuyModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [buyerContact, setBuyerContact] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [agreedToIntent, setAgreedToIntent] = useState(false)
  // TEIL 2: Prefill aus profiles_private + „für nächstes Mal merken".
  const [remember, setRemember] = useState(true)
  const [prefillError, setPrefillError] = useState<string | null>(null)
  const now = useMinuteTick()

  // Beim Öffnen des Kaufformulars die eigenen Kontaktdaten laden und das Feld
  // vorbefüllen (editierbar). Leere Zeile = leeres Feld, kein Fehler. „Merken"
  // ist standardmässig AN, wenn noch nichts hinterlegt war (Erst-Käufer), sonst
  // AUS (kein ungewolltes Überschreiben). Nur beim Öffnen — ein späterer
  // Methodenwechsel überschreibt eine manuelle Eingabe nicht.
  useEffect(() => {
    if (!showBuyModal) return
    let active = true
    ;(async () => {
      const c = await getMyContactAction()
      if (!active) return
      if (c.error) {
        setPrefillError(c.error)
        return
      }
      setPrefillError(null)
      const stored =
        paymentMethod === 'twint' ? c.twint_phone ?? c.phone ?? '' : c.phone ?? ''
      // Prefill füllt NUR ein leeres Feld. Der async Prefill darf eine bereits
      // getippte Eingabe NIEMALS überschreiben (sonst verliert ein schnell
      // tippender Nutzer seinen Text, sobald der Server-Roundtrip auflöst).
      setBuyerContact((prev) => (prev.trim().length > 0 ? prev : stored))
      setRemember(stored.trim().length === 0)
    })()
    return () => {
      active = false
    }
    // Absichtlich nur beim Öffnen (kein paymentMethod in den Deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showBuyModal])

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

  // Case 2: Listing is reserved – Countdown aus reserved_until (TEIL 4)
  if (listing.status === 'reserved') {
    return (
      <div className="bg-amber-900/20 border border-amber-600 rounded-lg p-4 text-center">
        <p className="text-amber-400 font-semibold" data-testid="reserved-badge">
          {reservedRemainingText(listing.reserved_until, now)}
        </p>
        <p className="text-white/60 text-sm mt-1">
          Jemand anderes interessiert sich gerade dafür — schau später nochmal vorbei.
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

  // Case 3b: Nicht (mehr) aktiv (z.B. deaktiviert/zurückgezogen) – kein Kauf möglich.
  // create_buy_intent verlangt serverseitig status='active'; hier ehrlich anzeigen.
  if (listing.status !== 'active') {
    return (
      <div className="bg-obsidian-2 border border-glass-border rounded-lg p-4 text-center">
        <p className="text-white/70">Dieses Inserat ist zurzeit nicht verfügbar.</p>
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
              <label className="block text-white/70 text-sm mb-3">
                Wie möchtest du bezahlen?
              </label>
              <div className="space-y-2">
                {PAYMENT_METHODS.map((pm) => (
                  <label
                    key={pm.value}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="payment"
                      value={pm.value}
                      checked={paymentMethod === pm.value}
                      onChange={(e) =>
                        setPaymentMethod(e.target.value as PaymentMethod)
                      }
                      className="w-4 h-4 accent-gold"
                    />
                    <span className="text-white">{pm.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Contact info – kurze Angabe genügt (Details tauscht ihr nach der
                Bestätigung aus). */}
            <div className="mb-6">
              <label className="block text-white/70 text-sm mb-2">
                Wie erreicht dich der Verkäufer?{' '}
                {paymentMethod === 'twint' ? '(TWINT-Name oder -Nummer)' : '(Name oder Telefon)'}
              </label>
              <input
                type="text"
                value={buyerContact}
                onChange={(e) => setBuyerContact(e.target.value)}
                placeholder={
                  paymentMethod === 'twint' ? 'z.B. max.mueller' : 'z.B. Max, 079 123 45 67'
                }
                className="w-full px-4 py-3 bg-obsidian-2 border border-glass-border rounded-lg text-white placeholder:text-white/30 focus:outline-none focus:border-gold"
              />
              {prefillError && (
                <p className="mt-2 text-xs text-uri-danger">{prefillError}</p>
              )}
              {/* „Für nächstes Mal merken" – speichert die Angabe in profiles_private zurück. */}
              <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-white/70">
                <input
                  type="checkbox"
                  data-testid="remember-contact"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 accent-gold"
                />
                💾 Für nächstes Mal merken
              </label>
            </div>

            {/* Checkbox */}
            <label className="flex items-start gap-3 mb-6 cursor-pointer">
              <input
                type="checkbox"
                data-testid="agree-intent"
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
                  if (buyerContact.trim().length < 2) {
                    toast.error('Kurz sagen, wie der Verkäufer dich erreicht 🙂')
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

                    // „Merken" ist nicht Teil des Kaufs: der Kauf ist bereits
                    // durch. Schlägt das Zurückschreiben fehl, sichtbar melden
                    // (Lektion 6), aber nie den erfolgreichen Kauf zurücknehmen.
                    if (remember) {
                      try {
                        await rememberContactAction(
                          paymentMethod === 'twint' ? 'twint_phone' : 'phone',
                          buyerContact
                        )
                      } catch {
                        toast.error(
                          'Kaufanfrage ist raus – deine Angabe konnte ich nur nicht merken 🙈'
                        )
                      }
                    }
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
