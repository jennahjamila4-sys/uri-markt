'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Image from 'next/image'
import { useAppStore } from '@/store/appStore'
import { CATEGORIES, GEMEINDEN } from '@/types'
import { categoryConfig, detectCategory } from '@/lib/gesuchConfig'
import { SmartFields, type SmartData } from './SmartFields'
import { PhotoUploadField } from './PhotoUploadField'
import { uploadListingImage } from '@/lib/supabase/storage'
import {
  createListingAction,
  createGesuchAction,
  saveDraftAction,
  publishDraftAction,
  suggestCategoryAction,
} from '@/app/actions/listings'

/**
 * BLOCK 10 — Chamäleon-Formular für Angebot UND Gesuch.
 * Progressive Entlastung in 3 Stufen (siehe plaene/block-10-smart-formulare.md §3):
 *   Stufe 1: Freitext-Titel + lokale Kategorie-Erkennung (Banner, antippbar) +
 *            Fallback-Select + KI-Fallback (nur >15 Zeichen ohne lokalen Treffer);
 *            Preis-Modell Fixpreis|Gratis (Angebot) bzw. Budget (Gesuch);
 *            Gemeinden-Multi-Select vorbefüllt aus profiles.gemeinde.
 *   Stufe 2: kategorie-spezifische Chips → smart_data + ehrliche Match-Power.
 *   Stufe 3 (eingeklappt): Beschreibung, optionales Foto (Nudge), Versand/Abholung.
 */

export interface ChameleonInitial {
  draftId?: string
  title?: string
  category?: string
  priceType?: 'fixed' | 'free'
  price?: string
  maxBudget?: string
  gemeinden?: string[]
  smartData?: SmartData
  condition?: 'new' | 'like_new' | 'good' | 'acceptable'
  description?: string
  imageUrls?: string[]
}

interface ChameleonFormProps {
  mode: 'Angebot' | 'Gesuch'
  initial?: ChameleonInitial
  onSuccess?: () => void
}

type Errors = Partial<Record<'title' | 'category' | 'gemeinde' | 'price', string>>

export function ChameleonForm({ mode, initial, onSuccess }: ChameleonFormProps) {
  const user = useAppStore((s) => s.user)
  const bumpFeedVersion = useAppStore((s) => s.bumpFeedVersion)
  const router = useRouter()

  const draftId = initial?.draftId
  const isGesuch = mode === 'Gesuch'

  const [title, setTitle] = useState(initial?.title ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [manualCategory, setManualCategory] = useState(!!initial?.category)
  const [aiSuggested, setAiSuggested] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [showCatPicker, setShowCatPicker] = useState(false)

  const [priceType, setPriceType] = useState<'fixed' | 'free'>(initial?.priceType ?? 'fixed')
  const [price, setPrice] = useState(initial?.price ?? '')
  const [maxBudget, setMaxBudget] = useState(initial?.maxBudget ?? '')

  const [gemeinden, setGemeinden] = useState<string[]>(
    initial?.gemeinden ?? (user?.gemeinde ? [user.gemeinde] : [])
  )
  const [smartData, setSmartData] = useState<SmartData>(initial?.smartData ?? {})
  const [condition, setCondition] = useState<'new' | 'like_new' | 'good' | 'acceptable'>(
    initial?.condition ?? 'good'
  )
  const [description, setDescription] = useState(initial?.description ?? '')
  const [imageUrls, setImageUrls] = useState<string[]>(initial?.imageUrls ?? [])
  const [isUploading, setIsUploading] = useState(false)

  const [showDetails, setShowDetails] = useState(false)
  const [legalConfirmed, setLegalConfirmed] = useState(false)
  const [errors, setErrors] = useState<Errors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Refs gegen Stale-Closures in der debounced KI-Erkennung.
  const manualRef = useRef(manualCategory)
  const titleRef = useRef(title)
  useEffect(() => { manualRef.current = manualCategory }, [manualCategory])
  useEffect(() => { titleRef.current = title }, [title])

  // Lokale Erkennung (synchron, kein API-Call) + KI-Fallback (debounced).
  useEffect(() => {
    if (manualCategory) return
    const local = detectCategory(title)
    if (local) {
      setCategory(local)
      setAiSuggested(false)
      return
    }
    if (title.trim().length < 15) {
      setCategory('')
      return
    }
    const handle = setTimeout(async () => {
      setAiLoading(true)
      try {
        const { category: ai } = await suggestCategoryAction(title)
        // Nur anwenden, wenn Titel unverändert und keine manuelle Wahl erfolgte.
        if (ai && !manualRef.current && titleRef.current === title) {
          setCategory(ai)
          setAiSuggested(true)
        }
      } catch (err) {
        // Nie blockierend (Lektion 7): still geloggt, Formular läuft weiter.
        console.error('[chameleon ai-detect]', err)
      } finally {
        setAiLoading(false)
      }
    }, 600)
    return () => clearTimeout(handle)
  }, [title, manualCategory])

  if (!user) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-white/60">
          Bitte melde dich an, um ein {mode} zu erstellen.
        </p>
      </div>
    )
  }

  const cfg = category ? categoryConfig[category as keyof typeof categoryConfig] : undefined
  const categoryLabel = CATEGORIES.find((c) => c.id === category)?.label ?? ''

  const toggleGemeinde = (g: string) => {
    setGemeinden((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))
  }

  const onImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        const url = await uploadListingImage(file, user.id)
        setImageUrls((prev) => [...prev, url])
      }
      toast.success('Bild hochgeladen')
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsUploading(false)
    }
  }

  // Vollständige Validierung mit sichtbaren Fehlern + Scroll zum ersten Fehler.
  const validate = (): Errors => {
    const e: Errors = {}
    if (title.trim().length < 3) e.title = 'Titel: mindestens 3 Zeichen.'
    if (!category) e.category = 'Bitte eine Kategorie wählen.'
    if (gemeinden.length < 1) e.gemeinde = 'Bitte mindestens eine Gemeinde wählen.'
    if (!isGesuch && priceType === 'fixed') {
      const p = parseFloat(price)
      if (!price || Number.isNaN(p) || p <= 0) e.price = 'Bitte einen Preis > 0 eingeben (oder „Gratis“).'
    }
    return e
  }

  const scrollToFirstError = (e: Errors) => {
    const first = (['title', 'category', 'gemeinde', 'price'] as const).find((k) => e[k])
    if (!first) return
    requestAnimationFrame(() => {
      document.getElementById(`field-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
  }

  const buildPublishPayload = () => {
    const primary = gemeinden[0]
    const cleanSmart = Object.keys(smartData).length > 0 ? smartData : undefined
    if (isGesuch) {
      return {
        title: title.trim(),
        category,
        gemeinde: primary,
        gemeinden,
        smart_data: cleanSmart,
        max_budget: maxBudget ? parseFloat(maxBudget) : undefined,
        description: description || undefined,
      }
    }
    return {
      title: title.trim(),
      description: description || undefined,
      category,
      condition,
      price_type: priceType,
      price: priceType === 'free' ? undefined : parseFloat(price),
      gemeinde: primary,
      gemeinden,
      smart_data: cleanSmart,
      image_urls: imageUrls,
      pickup_available: true,
      shipping_available: false,
      shipping_cost: 0,
    }
  }

  const afterSuccess = () => {
    bumpFeedVersion()
    router.refresh()
    onSuccess?.()
  }

  const handlePublish = async () => {
    const e = validate()
    if (Object.keys(e).length > 0) {
      setErrors(e)
      toast.error('Da fehlt noch was! 👀 Bitte die rot markierten Felder ausfüllen.')
      scrollToFirstError(e)
      return
    }
    if (!isGesuch && !legalConfirmed) {
      toast.error('Bitte bestätige kurz, dass dein Inserat rechtlich ok ist ✅')
      return
    }
    setErrors({})
    setIsSubmitting(true)
    try {
      const payload = buildPublishPayload()
      if (draftId) {
        await publishDraftAction(draftId, payload)
      } else if (isGesuch) {
        await createGesuchAction(payload)
      } else {
        await createListingAction(payload)
      }
      // Erfolgs-Text bewusst identisch zum bisherigen Formular (E2E-Kompatibilität).
      // TEIL 7: Beim Angebot der 48h-Hinweis als Toast-Description — der Titel-Text
      // bleibt exakt gleich, damit die bestehenden E2E-Selektoren greifen (Lektion 20).
      toast.success(
        isGesuch
          ? 'Gesuch erstellt! Wir suchen passende Angebote. 🎯'
          : 'Inserat erfolgreich erstellt! 🎉',
        !isGesuch
          ? {
              description:
                '💛 Sobald jemand kaufen möchte, ist dein Inserat 48 Std. für euch beide reserviert. Schau regelmässig vorbei!',
            }
          : undefined
      )
      afterSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Veröffentlichen')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSaveDraft = async () => {
    if (title.trim().length < 3) {
      setErrors({ title: 'Für einen Entwurf brauchst du nur einen Titel (mind. 3 Zeichen).' })
      toast.error('Titel fehlt (mind. 3 Zeichen).')
      scrollToFirstError({ title: 'x' })
      return
    }
    setIsSubmitting(true)
    try {
      await saveDraftAction({
        type: mode,
        title: title.trim(),
        category: category || undefined,
        description: description || undefined,
        condition: !isGesuch ? condition : undefined,
        price_type: !isGesuch ? priceType : undefined,
        price: !isGesuch && priceType === 'fixed' && price ? parseFloat(price) : undefined,
        max_budget: isGesuch && maxBudget ? parseFloat(maxBudget) : undefined,
        gemeinden,
        smart_data: Object.keys(smartData).length > 0 ? smartData : undefined,
        image_urls: !isGesuch ? imageUrls : undefined,
      })
      toast.success('Als Entwurf gespeichert 📝 – du findest ihn unter „Meine Inserate“.')
      afterSuccess()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Entwurf konnte nicht gespeichert werden')
    } finally {
      setIsSubmitting(false)
    }
  }

  const inputCls =
    'mt-1 w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold'

  return (
    <div className="space-y-6">
      {/* ---------- STUFE 1 ---------- */}
      <div id="field-title">
        <label className="text-sm font-display font-bold text-white">
          {isGesuch ? 'Was suchst du?' : 'Was verkaufst du?'} {title.length}/{isGesuch ? 150 : 100}
        </label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={isGesuch ? 150 : 100}
          placeholder={isGesuch ? 'z.B. Roter Wollpullover, Grösse M' : 'z.B. Roter Wollpullover, Grösse M'}
          className={`${inputCls} ${errors.title ? 'ring-2 ring-uri-danger' : ''}`}
        />
        {errors.title && <p className="mt-1 text-xs text-uri-danger">{errors.title}</p>}
      </div>

      {/* Kategorie: Banner (antippbar) + Fallback-Select */}
      <div id="field-category">
        {category && !showCatPicker ? (
          <button
            type="button"
            onClick={() => setShowCatPicker(true)}
            className="flex w-full items-center justify-between rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-left"
          >
            <span className="text-sm text-white">
              {manualCategory
                ? `Kategorie: ${categoryLabel}`
                : aiSuggested
                  ? `✨ Vorschlag: ${categoryLabel}`
                  : `✨ Erkannt: ${categoryLabel}`}
            </span>
            <span className="text-xs text-gold">ändern</span>
          </button>
        ) : (
          <div>
            <label className="text-sm font-display font-bold text-white">Kategorie</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value)
                setManualCategory(true)
                setAiSuggested(false)
                setShowCatPicker(false)
              }}
              className={`${inputCls} ${errors.category ? 'ring-2 ring-uri-danger' : ''}`}
            >
              <option value="">Kategorie wählen …</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.label}
                </option>
              ))}
            </select>
          </div>
        )}
        {aiLoading && <p className="mt-1 text-xs text-white/40">✨ Kategorie wird erkannt …</p>}
        {errors.category && <p className="mt-1 text-xs text-uri-danger">{errors.category}</p>}
      </div>

      {/* Preis-Modell (Angebot) bzw. Budget (Gesuch) */}
      {isGesuch ? (
        <div>
          <label className="text-sm font-display font-bold text-white">Max. Budget (CHF, optional)</label>
          <input
            value={maxBudget}
            onChange={(e) => setMaxBudget(e.target.value)}
            type="number"
            min="0"
            step="0.01"
            placeholder="z.B. 50"
            className={inputCls}
          />
        </div>
      ) : (
        <div id="field-price">
          <label className="text-sm font-display font-bold text-white">Preis-Modell</label>
          {/* Erweiterbare Komponente: Auktion folgt in einem späteren Block (jetzt bewusst nicht sichtbar). */}
          <div className="mt-2 grid grid-cols-2 gap-2">
            {([
              { value: 'fixed', label: 'Fixpreis' },
              { value: 'free', label: '🎁 Gratis' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPriceType(opt.value)}
                className={`rounded-lg p-2 text-sm transition ${
                  priceType === opt.value
                    ? 'bg-gold text-obsidian font-bold'
                    : 'glass-card glass-card-hover text-white/80'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {priceType === 'fixed' && (
            <input
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              type="number"
              min="0"
              step="0.01"
              placeholder="Preis in CHF"
              className={`${inputCls} ${errors.price ? 'ring-2 ring-uri-danger' : ''}`}
            />
          )}
          {errors.price && <p className="mt-1 text-xs text-uri-danger">{errors.price}</p>}
        </div>
      )}

      {/* Gemeinden Multi-Select */}
      <div id="field-gemeinde">
        <label className="text-sm font-display font-bold text-white">
          Gemeinde(n) {gemeinden.length > 0 && <span className="text-gold">· {gemeinden.length} gewählt</span>}
        </label>
        <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
          {GEMEINDEN.map((g) => {
            const active = gemeinden.includes(g)
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggleGemeinde(g)}
                className={`rounded-full px-3 py-1.5 text-sm transition ${
                  active ? 'bg-gold text-obsidian font-bold' : 'glass-card glass-card-hover text-white/80'
                }`}
              >
                {g}
              </button>
            )
          })}
        </div>
        {errors.gemeinde && <p className="mt-1 text-xs text-uri-danger">{errors.gemeinde}</p>}
      </div>

      {/* ---------- STUFE 2: Match-Booster ---------- */}
      {cfg ? (
        <div className="border-t border-glass-border pt-4">
          <p className="mb-3 text-sm font-display font-bold text-white">
            Ein paar Details – so finden dich die Richtigen schneller
          </p>
          <SmartFields fields={cfg.fields} value={smartData} onChange={setSmartData} />
        </div>
      ) : (
        category && (
          <p className="text-xs text-white/40">
            Für diese Kategorie gibt es (noch) keine Extra-Felder – das reicht so.
          </p>
        )
      )}

      {/* ---------- STUFE 3: Mehr Details (eingeklappt) ---------- */}
      <div className="border-t border-glass-border pt-4">
        <button
          type="button"
          onClick={() => setShowDetails((v) => !v)}
          className="flex w-full items-center justify-between text-sm font-display font-bold text-white/80"
        >
          <span>Mehr Details (optional)</span>
          <span className="text-gold">{showDetails ? '−' : '+'}</span>
        </button>

        {showDetails && (
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-sm text-white/80">
                Beschreibung {description.length}/{isGesuch ? 1000 : 2000}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={isGesuch ? 1000 : 2000}
                rows={3}
                placeholder="Details, Wünsche, Zustand …"
                className={inputCls}
              />
            </div>

            {!isGesuch && (
              <>
                <div>
                  <label className="text-sm text-white/80">Zustand</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {([
                      { value: 'new', label: 'Neu' },
                      { value: 'like_new', label: 'Wie neu' },
                      { value: 'good', label: 'Gut' },
                      { value: 'acceptable', label: 'Akzeptabel' },
                    ] as const).map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setCondition(opt.value)}
                        className={`rounded-full px-3 py-1.5 text-sm transition ${
                          condition === opt.value
                            ? 'bg-gold text-obsidian font-bold'
                            : 'glass-card glass-card-hover text-white/80'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <PhotoUploadField
                    id="chameleon-photo-upload"
                    label="Foto (optional)"
                    hint="Mit Foto verkaufst du deutlich schneller."
                    onChange={onImageUpload}
                    isUploading={isUploading}
                    count={imageUrls.length}
                  />
                  {imageUrls.length > 0 && (
                    <div className="mt-3 grid grid-cols-5 gap-2">
                      {imageUrls.map((url, idx) => (
                        <div key={idx} className="relative aspect-square overflow-hidden rounded-lg">
                          <Image src={url} alt={`Bild ${idx + 1}`} fill className="object-cover" />
                          <button
                            type="button"
                            onClick={() => setImageUrls((u) => u.filter((_, i) => i !== idx))}
                            className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-uri-danger text-xs text-white"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ---------- Aktionen ---------- */}
      {!isGesuch && (
        <label className="flex items-start gap-2 text-xs text-white/80">
          <input
            type="checkbox"
            checked={legalConfirmed}
            onChange={(e) => setLegalConfirmed(e.target.checked)}
            className="mt-0.5"
          />
          <span>Ich bestätige, dass das Inserat rechtlich korrekt ist.</span>
        </label>
      )}

      <div className="flex gap-2">
        {!draftId && (
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSubmitting}
            className="flex-1 rounded-lg border border-glass-border px-4 py-2 font-display font-bold text-white/70 disabled:opacity-50"
          >
            Als Entwurf speichern
          </button>
        )}
        <button
          type="button"
          onClick={handlePublish}
          disabled={isSubmitting}
          className="btn-gold flex-1 rounded-lg px-4 py-2 font-display font-bold disabled:opacity-50"
        >
          {isSubmitting ? 'Wird veröffentlicht …' : 'Veröffentlichen'}
        </button>
      </div>

      {/* TEIL 7: dezenter 48h-Hinweis, nur beim Angebot. Faktisch wahr,
          empathisch, kein Druck. */}
      {!isGesuch && (
        <p
          data-testid="reserve-hint"
          className="text-center text-xs leading-relaxed text-white/50"
        >
          💛 Gut zu wissen: Sobald jemand kaufen möchte, ist dein Inserat 48 Std.
          für euch beide reserviert. Schau regelmässig vorbei — so entgeht dir
          kein Deal!
        </p>
      )}
    </div>
  )
}
