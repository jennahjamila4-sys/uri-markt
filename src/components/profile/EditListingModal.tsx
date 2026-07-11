'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useForm, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { updateListingAction } from '@/app/actions/listings'
import { AngebotSchema } from '@/lib/validations/listing'
import { GesuchSchema } from '@/lib/validations/onboarding'
import { uploadListingImage } from '@/lib/supabase/storage'
import { useAppStore } from '@/store/appStore'
import { CATEGORIES, GEMEINDEN } from '@/types'

type AngebotData = typeof AngebotSchema._type
type GesuchData = typeof GesuchSchema._type

interface Props {
  listingId: string
  listingType: 'Angebot' | 'Gesuch'
  /** Wird nach erfolgreichem Speichern mit dem neuen Titel aufgerufen. */
  onSaved: (patch: { title: string }) => void
  onClose: () => void
}

export function EditListingModal({ listingId, listingType, onSaved, onClose }: Props) {
  const supabase = createClient()
  const router = useRouter()
  const user = useAppStore((s) => s.user)
  const bumpFeedVersion = useAppStore((s) => s.bumpFeedVersion)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [images, setImages] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const isGesuch = listingType === 'Gesuch'

  const angebotForm = useForm<AngebotData>({
    resolver: zodResolver(AngebotSchema),
    defaultValues: {
      title: '', description: '', category: '', condition: 'good',
      price_type: 'fixed', price: 0, gemeinde: '',
      pickup_available: true, shipping_available: false, shipping_cost: 0,
      image_urls: [],
    },
  })
  const gesuchForm = useForm<GesuchData>({
    resolver: zodResolver(GesuchSchema),
    defaultValues: { title: '', description: '', category: '', gemeinde: 'Altdorf', max_budget: undefined },
  })

  // Vollständiges Inserat laden und Formular prefillen (RLS: public select).
  useEffect(() => {
    let mounted = true
    ;(async () => {
      const { data, error, status } = await supabase
        .from('listings')
        .select('*')
        .eq('id', listingId)
        .single()
      if (!mounted) return
      if (error || !data) {
        // Fehler ≠ leeres Ergebnis getrennt behandeln (Lektion 7)
        setLoadError(status === 406 || !data ? 'Inserat nicht gefunden' : 'Konnte Inserat nicht laden')
        setLoading(false)
        return
      }
      if (isGesuch) {
        gesuchForm.reset({
          title: data.title ?? '',
          description: data.description ?? '',
          category: data.category ?? '',
          gemeinde: (data.gemeinde ?? 'Altdorf') as GesuchData['gemeinde'],
          max_budget: data.max_budget ?? data.price ?? undefined,
        })
      } else {
        const urls = (data.image_urls ?? (data.image_url ? [data.image_url] : [])) as string[]
        setImages(urls)
        angebotForm.reset({
          title: data.title ?? '',
          description: data.description ?? '',
          category: data.category ?? '',
          condition: (data.condition ?? 'good') as AngebotData['condition'],
          price_type: (data.price_type ?? 'fixed') as AngebotData['price_type'],
          price: data.price ?? 0,
          gemeinde: data.gemeinde ?? '',
          pickup_available: data.pickup_available ?? true,
          shipping_available: data.shipping_available ?? false,
          shipping_cost: data.shipping_cost ?? 0,
          image_urls: urls,
        })
      }
      setLoading(false)
    })()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listingId])

  const onImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || !user) return
    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const url = await uploadListingImage(file, user.id)
        setImages((prev) => [...prev, url])
      }
      toast.success('Bilder hochgeladen')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsUploading(false)
    }
  }

  const scrollToFirstError = (errs: FieldErrors<AngebotData> | FieldErrors<GesuchData>) => {
    const first = Object.keys(errs)[0] ?? ''
    toast.error('Da fehlt noch was! 👀 Bitte die rot markierten Felder ausfüllen.')
    requestAnimationFrame(() => {
      document.getElementById(`edit-field-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const submit = async (payload: unknown, title: string) => {
    try {
      await updateListingAction(listingId, listingType, payload)
      toast.success('Inserat aktualisiert ✅')
      bumpFeedVersion()
      router.refresh()
      onSaved({ title })
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Bearbeiten fehlgeschlagen')
    }
  }

  const onAngebotSubmit = (data: AngebotData) =>
    submit({ ...data, image_urls: images }, data.title)
  const onGesuchSubmit = (data: GesuchData) => submit(data, data.title)

  const inputCls =
    'mt-1 w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-gold'
  const errCls = 'text-xs text-uri-danger mt-1'

  return (
    <div className="fixed inset-0 z-[60] flex items-end" data-testid="edit-listing-modal">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[92dvh] w-full animate-slide-up overflow-y-auto rounded-t-3xl border border-glass-border bg-obsidian-3 p-6 shadow-modal">
        <button onClick={onClose} className="absolute top-4 right-4 text-white/60 hover:text-white" aria-label="Schliessen">
          <X size={24} />
        </button>
        <h3 className="mb-5 font-display text-xl font-bold text-white">
          {isGesuch ? 'Gesuch bearbeiten' : 'Inserat bearbeiten'}
        </h3>

        {loading ? (
          <div className="py-10 text-center">
            <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-gold border-t-transparent" />
            <p className="mt-3 text-sm text-white/50">Wird geladen…</p>
          </div>
        ) : loadError ? (
          <div className="py-10 text-center">
            <p className="font-display font-bold text-white">{loadError}</p>
            <button onClick={onClose} className="mt-4 rounded-xl border border-glass-border px-6 py-3 font-display font-bold text-white">
              Zurück
            </button>
          </div>
        ) : isGesuch ? (
          <form onSubmit={gesuchForm.handleSubmit(onGesuchSubmit, scrollToFirstError)} className="space-y-4">
            <div id="edit-field-title">
              <label className="text-sm font-display font-bold text-white">Titel</label>
              <input {...gesuchForm.register('title')} maxLength={150} className={inputCls} data-testid="edit-title" />
              {gesuchForm.formState.errors.title && <p className={errCls}>{gesuchForm.formState.errors.title.message}</p>}
            </div>
            <div id="edit-field-category">
              <label className="text-sm font-display font-bold text-white">Kategorie</label>
              <select {...gesuchForm.register('category')} className={inputCls}>
                <option value="">Kategorie wählen</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              {gesuchForm.formState.errors.category && <p className={errCls}>{gesuchForm.formState.errors.category.message}</p>}
            </div>
            <div id="edit-field-gemeinde">
              <label className="text-sm font-display font-bold text-white">Gemeinde</label>
              <select {...gesuchForm.register('gemeinde')} className={inputCls}>
                {GEMEINDEN.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              {gesuchForm.formState.errors.gemeinde && <p className={errCls}>{gesuchForm.formState.errors.gemeinde.message}</p>}
            </div>
            <div id="edit-field-max_budget">
              <label className="text-sm font-display font-bold text-white">Budget (CHF, optional)</label>
              <input type="number" min="0" step="0.01" {...gesuchForm.register('max_budget', { setValueAs: (v) => (v === '' || v == null ? undefined : Number(v)) })} className={inputCls} />
              {gesuchForm.formState.errors.max_budget && <p className={errCls}>{gesuchForm.formState.errors.max_budget.message}</p>}
            </div>
            <div>
              <label className="text-sm font-display font-bold text-white">Beschreibung (optional)</label>
              <textarea {...gesuchForm.register('description')} maxLength={1000} rows={4} className={inputCls} />
            </div>
            <SubmitRow onClose={onClose} pending={gesuchForm.formState.isSubmitting} />
          </form>
        ) : (
          <form onSubmit={angebotForm.handleSubmit(onAngebotSubmit, scrollToFirstError)} className="space-y-4">
            <div id="edit-field-title">
              <label className="text-sm font-display font-bold text-white">Titel</label>
              <input {...angebotForm.register('title')} maxLength={100} className={inputCls} data-testid="edit-title" />
              {angebotForm.formState.errors.title && <p className={errCls}>{angebotForm.formState.errors.title.message}</p>}
            </div>

            <div id="edit-field-category">
              <label className="text-sm font-display font-bold text-white">Kategorie</label>
              <select {...angebotForm.register('category')} className={inputCls}>
                <option value="">Kategorie wählen</option>
                {CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
              {angebotForm.formState.errors.category && <p className={errCls}>{angebotForm.formState.errors.category.message}</p>}
            </div>

            <div>
              <label className="text-sm font-display font-bold text-white">Zustand</label>
              <select
                value={angebotForm.watch('condition')}
                onChange={(e) => angebotForm.setValue('condition', e.target.value as AngebotData['condition'])}
                className={inputCls}
              >
                <option value="new">Neu</option>
                <option value="like_new">Wie neu</option>
                <option value="good">Gut</option>
                <option value="acceptable">Akzeptabel</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-display font-bold text-white">Preistyp</label>
              <div className="mt-2 grid grid-cols-4 gap-2">
                {[
                  { value: 'fixed', label: 'Fest' },
                  { value: 'vhb', label: 'VHB' },
                  { value: 'free', label: 'Gratis' },
                  { value: 'auction', label: 'Auktion' },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => angebotForm.setValue('price_type', opt.value as AngebotData['price_type'])}
                    className={`rounded-lg p-2 text-sm transition ${
                      angebotForm.watch('price_type') === opt.value
                        ? 'bg-gold text-obsidian font-bold'
                        : 'glass-card text-white/80'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {angebotForm.watch('price_type') !== 'free' && (
              <div id="edit-field-price">
                <label className="text-sm font-display font-bold text-white">Preis (CHF)</label>
                <input type="number" min="0" step="0.01" {...angebotForm.register('price', { valueAsNumber: true })} className={inputCls} />
                {angebotForm.formState.errors.price && <p className={errCls}>{angebotForm.formState.errors.price.message}</p>}
              </div>
            )}

            <div>
              <label className="text-sm font-display font-bold text-white">Bilder (max 5)</label>
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={onImageUpload}
                disabled={isUploading || images.length >= 5}
                className="mt-2 w-full"
              />
              {images.length > 0 && (
                <div className="mt-3 grid grid-cols-5 gap-2">
                  {images.map((url, idx) => (
                    <div key={idx} className="relative aspect-square overflow-hidden rounded-lg">
                      <Image src={url} alt={`Bild ${idx + 1}`} fill className="object-cover" />
                      <button
                        type="button"
                        onClick={() => setImages((u) => u.filter((_, i) => i !== idx))}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-uri-danger text-xs text-white"
                        aria-label="Bild entfernen"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div id="edit-field-gemeinde">
              <label className="text-sm font-display font-bold text-white">Gemeinde</label>
              <select {...angebotForm.register('gemeinde')} className={inputCls}>
                <option value="">Gemeinde wählen</option>
                {GEMEINDEN.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              {angebotForm.formState.errors.gemeinde && <p className={errCls}>{angebotForm.formState.errors.gemeinde.message}</p>}
            </div>

            <div>
              <label className="text-sm font-display font-bold text-white">Beschreibung (optional)</label>
              <textarea {...angebotForm.register('description')} maxLength={2000} rows={4} className={inputCls} />
            </div>

            <SubmitRow onClose={onClose} pending={angebotForm.formState.isSubmitting} />
          </form>
        )}
      </div>
    </div>
  )
}

function SubmitRow({ onClose, pending }: { onClose: () => void; pending: boolean }) {
  return (
    <div className="flex gap-2 pt-2">
      <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-glass-border px-4 py-2 font-display font-bold text-white/60">
        Abbrechen
      </button>
      <button
        type="submit"
        disabled={pending}
        data-testid="edit-save"
        className="flex-1 btn-gold rounded-lg px-4 py-2 font-display font-bold disabled:opacity-50"
      >
        {pending ? 'Wird gespeichert…' : 'Speichern'}
      </button>
    </div>
  )
}
