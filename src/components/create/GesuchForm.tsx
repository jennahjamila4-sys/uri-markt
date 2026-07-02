'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { createGesuchAction } from '@/app/actions/listings'
import { GesuchSchema } from '@/lib/validations/onboarding'
import { useAppStore } from '@/store/appStore'
import { CATEGORIES, GEMEINDEN } from '@/types'

interface GesuchFormProps {
  onSuccess?: () => void
}

export function GesuchForm({ onSuccess }: GesuchFormProps) {
  const { user } = useAppStore()
  const bumpFeedVersion = useAppStore((s) => s.bumpFeedVersion)
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [title, setTitle] = useState('')
  const [category, setCategory] = useState('')
  const [maxBudget, setMaxBudget] = useState('')
  const [gemeinde, setGemeinde] = useState('')
  const [neededBy, setNeededBy] = useState('')
  const [description, setDescription] = useState('')

  if (!user) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-white/60">
          Bitte melde dich an, um ein Gesuch zu erstellen.
        </p>
      </div>
    )
  }

  const handleSubmit = async () => {
    const payload = {
      title,
      category,
      gemeinde,
      max_budget: maxBudget ? parseFloat(maxBudget) : undefined,
      description: description || undefined,
      needed_by: neededBy ? new Date(neededBy).toISOString() : undefined,
    }

    const validated = GesuchSchema.safeParse(payload)
    if (!validated.success) {
      toast.error(validated.error.errors[0]?.message ?? 'Ungültige Eingaben')
      return
    }

    setIsSubmitting(true)
    try {
      await createGesuchAction(validated.data)
      toast.success('Gesuch erstellt! Wir suchen passende Angebote. 🎯')
      // Serverdaten neu laden: RSC-Refresh + Feed-Neuladen (Quelle bleibt der Server)
      bumpFeedVersion()
      router.refresh()
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Erstellen')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Step Indicator */}
      <div className="flex gap-2">
        {[1, 2, 3].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${s <= step ? 'bg-gold' : 'bg-glass'}`}
          />
        ))}
      </div>

      {/* Step 1: Was suchst du? */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-display font-bold text-white">
              Was suchst du? {title.length}/150
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={150}
              placeholder="z.B. Gebrauchtes Mountainbike, Grösse M"
              className="mt-1 w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div>
            <label className="text-sm font-display font-bold text-white">
              Kategorie
            </label>
            <div className="mt-2 grid max-h-64 grid-cols-2 gap-2 overflow-y-auto">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setCategory(cat.id)}
                  className={`rounded-lg p-3 text-sm font-body transition ${
                    category === cat.id
                      ? 'glass-card border-gold/50 ring-1 ring-gold'
                      : 'glass-card glass-card-hover'
                  }`}
                >
                  <div className="mb-1 text-2xl">{cat.emoji}</div>
                  <div className="line-clamp-2 text-white/80">{cat.label}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            disabled={title.length < 3 || !category}
            onClick={() => setStep(2)}
            className="btn-gold w-full rounded-lg px-4 py-2 disabled:opacity-50"
          >
            Weiter
          </button>
        </div>
      )}

      {/* Step 2: Details */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-display font-bold text-white">
              Max. Budget (CHF, optional)
            </label>
            <input
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="z.B. 500"
              className="mt-1 w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div>
            <label className="text-sm font-display font-bold text-white">
              Gemeinde
            </label>
            <select
              value={gemeinde}
              onChange={(e) => setGemeinde(e.target.value)}
              className="mt-1 w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gold"
            >
              <option value="">Wähle deine Gemeinde</option>
              {GEMEINDEN.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-display font-bold text-white">
              Bis wann gebraucht (optional)
            </label>
            <input
              value={neededBy}
              onChange={(e) => setNeededBy(e.target.value)}
              type="date"
              className="mt-1 w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div>
            <label className="text-sm font-display font-bold text-white">
              Zusätzliche Beschreibung (optional) {description.length}/1000
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder="Details, Wünsche, Zustand…"
              className="mt-1 w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 rounded-lg border border-glass-border px-4 py-2 font-display font-bold text-white/60"
            >
              Zurück
            </button>
            <button
              type="button"
              disabled={!gemeinde}
              onClick={() => setStep(3)}
              className="btn-gold flex-1 rounded-lg px-4 py-2 disabled:opacity-50"
            >
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Bestätigen */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-3 rounded-lg border border-glass-border bg-obsidian-4 p-4">
            <div>
              <p className="text-xs text-white/60">Gesucht</p>
              <p className="font-display font-bold text-white">{title}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">Kategorie</p>
              <p className="font-display font-bold text-white">
                {CATEGORIES.find((c) => c.id === category)?.label}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60">Budget</p>
              <p className="font-display font-bold text-gold">
                {maxBudget ? `bis CHF ${parseFloat(maxBudget).toFixed(2)}` : 'offen'}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60">Gemeinde</p>
              <p className="font-display font-bold text-white">{gemeinde}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 rounded-lg border border-glass-border px-4 py-2 font-display font-bold text-white/60"
            >
              Zurück
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              className="btn-gold flex-1 rounded-lg px-4 py-2 disabled:opacity-50"
            >
              {isSubmitting ? 'Wird erstellt…' : 'Gesuch aufgeben'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
