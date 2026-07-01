'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { submitReviewAction } from '@/app/actions/transactions'

interface Props {
  transactionId: string
  onClose: () => void
  onSubmitted?: () => void
}

/** Bewertungs-Modal nach abgeschlossener Transaktion (1–5 Sterne + Kommentar) */
export function ReviewModal({ transactionId, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (rating < 1) {
      toast.error('Bitte vergib mindestens 1 Stern')
      return
    }
    setIsSubmitting(true)
    try {
      await submitReviewAction({
        transaction_id: transactionId,
        rating,
        comment: comment || undefined,
      })
      toast.success('Danke für deine Bewertung! ⭐')
      onSubmitted?.()
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bewertung fehlgeschlagen')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-end sm:items-center sm:justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="animate-slide-up relative w-full max-w-md rounded-t-3xl border border-glass-border bg-obsidian-3 p-6 shadow-modal sm:rounded-3xl">
        <h3 className="font-display text-xl font-bold text-white">
          Wie war der Deal?
        </h3>
        <p className="mt-1 text-sm text-white/60">
          Deine Bewertung hilft der Community.
        </p>

        {/* Sterne */}
        <div className="mt-6 flex justify-center gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHover(star)}
              onMouseLeave={() => setHover(0)}
              className="text-4xl transition-transform hover:scale-110"
              aria-label={`${star} Sterne`}
            >
              <span
                className={
                  star <= (hover || rating) ? 'text-gold' : 'text-white/20'
                }
              >
                ★
              </span>
            </button>
          ))}
        </div>

        {/* Kommentar */}
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="Optionaler Kommentar… (max. 500 Zeichen)"
          className="mt-6 w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
        />

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-glass-border py-3 font-display font-bold text-white/60"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="btn-gold flex-1 rounded-lg py-3 disabled:opacity-50"
          >
            {isSubmitting ? 'Wird gesendet…' : 'Bewertung abgeben'}
          </button>
        </div>
      </div>
    </div>
  )
}
