'use client'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { createListingAction } from '@/app/actions/listings'
import { AngebotSchema } from '@/lib/validations/listing'
import { uploadListingImage } from '@/lib/supabase/storage'
import { useAppStore } from '@/store/appStore'
import { CATEGORIES, GEMEINDEN } from '@/types'
import { toast } from 'sonner'
import Image from 'next/image'

interface AngebotFormProps {
  onSuccess?: () => void
}

export function AngebotForm({ onSuccess }: AngebotFormProps) {
  const { user } = useAppStore()
  const [step, setStep] = useState(1)
  const [uploadedImages, setUploadedImages] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const form = useForm<typeof AngebotSchema._type>({
    resolver: zodResolver(AngebotSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
      condition: 'good',
      price_type: 'fixed',
      price: 0,
      gemeinde: '',
      pickup_available: true,
      shipping_available: false,
      shipping_cost: 0,
      image_urls: [],
    },
  })

  const onImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !user) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const url = await uploadListingImage(file, user.id)
        setUploadedImages((prev) => [...prev, url])
      }
      toast.success('Bilder hochgeladen')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsUploading(false)
    }
  }

  const onSubmit = async (data: typeof AngebotSchema._type) => {
    try {
      await createListingAction({
        ...data,
        image_urls: uploadedImages,
      })
      toast.success('Inserat erfolgreich erstellt! 🎉')
      form.reset()
      setUploadedImages([])
      setStep(1)
      onSuccess?.()
    } catch (err) {
      toast.error((err as Error).message)
    }
  }

  if (!user) {
    return (
      <div className="space-y-4 text-center py-8">
        <p className="text-white/60">Bitte melde dich an, um ein Inserat zu erstellen.</p>
      </div>
    )
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Step Indicator */}
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((s) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full ${
              s <= step ? 'bg-gold' : 'bg-glass'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Category & Condition */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-display font-bold text-white">
              Kategorie
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => form.setValue('category', cat.id)}
                  className={`rounded-lg p-3 text-sm font-body transition ${
                    form.watch('category') === cat.id
                      ? 'glass-card border-gold/50 ring-1 ring-gold'
                      : 'glass-card glass-card-hover'
                  }`}
                >
                  <div className="text-2xl mb-1">{cat.emoji}</div>
                  <div className="text-white/80 line-clamp-2">{cat.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-sm font-display font-bold text-white">
              Zustand
            </label>
            <div className="mt-2 space-y-2">
              {[
                { value: 'new', label: 'Neu' },
                { value: 'like_new', label: 'Wie neu' },
                { value: 'good', label: 'Gut' },
                { value: 'acceptable', label: 'Akzeptabel' },
              ].map((opt) => (
                <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    value={opt.value}
                    checked={form.watch('condition') === opt.value}
                    onChange={(e) => form.setValue('condition', e.target.value as 'new' | 'like_new' | 'good' | 'acceptable')}
                    className="w-4 h-4"
                  />
                  <span className="text-white/80">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setStep(2)}
            className="btn-gold w-full rounded-lg px-4 py-2 font-display font-bold"
          >
            Weiter
          </button>
        </div>
      )}

      {/* Step 2: Title & Description */}
      {step === 2 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-display font-bold text-white">
              Titel {form.watch('title').length}/100
            </label>
            <input
              {...form.register('title')}
              maxLength={100}
              className="mt-1 w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gold"
              placeholder="Was verkaufst du?"
            />
            {form.formState.errors.title?.message && (
              <p className="text-xs text-uri-danger mt-1">
                {form.formState.errors.title.message}
              </p>
            )}
          </div>

          <div>
            <label className="text-sm font-display font-bold text-white">
              Beschreibung (optional) {form.watch('description')?.length || 0}/2000
            </label>
            <textarea
              {...form.register('description')}
              maxLength={2000}
              rows={4}
              className="mt-1 w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gold"
              placeholder="Mehr Details..."
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
              onClick={() => setStep(3)}
              className="flex-1 btn-gold rounded-lg px-4 py-2 font-display font-bold"
            >
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Price, Images & Location */}
      {step === 3 && (
        <div className="space-y-4">
          <div>
            <label className="text-sm font-display font-bold text-white">
              Preistyp
            </label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {[
                { value: 'fixed', label: 'Festpreis' },
                { value: 'vhb', label: 'VHB' },
                { value: 'free', label: 'Gratis' },
                { value: 'auction', label: 'Auktion' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => form.setValue('price_type', opt.value as 'fixed' | 'vhb' | 'free' | 'auction')}
                  className={`rounded-lg p-2 text-sm font-body transition ${
                    form.watch('price_type') === opt.value
                      ? 'bg-gold text-obsidian font-bold'
                      : 'glass-card glass-card-hover text-white/80'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {form.watch('price_type') !== 'free' && (
            <div>
              <label className="text-sm font-display font-bold text-white">
                Preis (CHF)
              </label>
              <input
                {...form.register('price', { valueAsNumber: true })}
                type="number"
                min="0"
                step="0.01"
                className="mt-1 w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-display font-bold text-white">
              Bilder (max 5)
            </label>
            <input
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={onImageUpload}
              disabled={isUploading || uploadedImages.length >= 5}
              className="mt-2 w-full"
            />
            {uploadedImages.length > 0 && (
              <div className="mt-3 grid grid-cols-5 gap-2">
                {uploadedImages.map((url, idx) => (
                  <div key={idx} className="relative aspect-square rounded-lg overflow-hidden">
                    <Image
                      src={url}
                      alt={`Upload ${idx}`}
                      fill
                      className="object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setUploadedImages(u => u.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-uri-danger text-white text-xs flex items-center justify-center"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="text-sm font-display font-bold text-white">
              Gemeinde
            </label>
            <select
              {...form.register('gemeinde')}
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
              onClick={() => setStep(4)}
              className="flex-1 btn-gold rounded-lg px-4 py-2 font-display font-bold"
            >
              Weiter
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-glass-border bg-obsidian-4 p-4 space-y-3">
            <div>
              <p className="text-xs text-white/60">Titel</p>
              <p className="font-display font-bold text-white">{form.watch('title')}</p>
            </div>
            <div>
              <p className="text-xs text-white/60">Kategorie</p>
              <p className="font-display font-bold text-white">
                {CATEGORIES.find(c => c.id === form.watch('category'))?.label}
              </p>
            </div>
            <div>
              <p className="text-xs text-white/60">Preis</p>
              <p className="font-display font-bold text-gold">
                {form.watch('price_type') === 'free'
                  ? 'Gratis'
                  : `CHF ${form.watch('price')?.toLocaleString('de-CH')}`}
              </p>
            </div>
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...form.register('condition')}
              className="mt-1"
              required
            />
            <span className="text-xs text-white/80">
              Ich bestätige, dass das Inserat rechtlich korrekt ist.
            </span>
          </label>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 rounded-lg border border-glass-border px-4 py-2 font-display font-bold text-white/60"
            >
              Zurück
            </button>
            <button
              type="submit"
              disabled={form.formState.isSubmitting}
              className="flex-1 btn-gold rounded-lg px-4 py-2 font-display font-bold disabled:opacity-50"
            >
              {form.formState.isSubmitting ? 'Wird erstellt...' : 'Veröffentlichen'}
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
