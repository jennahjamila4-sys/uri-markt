'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import Image from 'next/image'
import { useAppStore } from '@/store/appStore'
import { CATEGORIES, GEMEINDEN } from '@/types'
import { categoryConfig, detectCategory } from '@/lib/gesuchConfig'
import { SmartFields, type SmartData } from './SmartFields'
import { AiFields, aiFilledCount } from './AiFields'
import { PhotoUploadField } from './PhotoUploadField'
import { uploadListingImage } from '@/lib/supabase/storage'
import {
  createListingAction,
  publishDraftAction,
  autosaveDraftAction,
} from '@/app/actions/listings'
import type { ChameleonInitial } from './ChameleonForm'
import type { AnalyzeResult } from '@/lib/analyzeListing'
import { validateAnalyzeResult } from '@/lib/analyzeListing'
import {
  CONDITION_GRADES,
  GEREINIGT_KEY,
  GEREINIGT_LABEL,
  conditionLabel,
  conditionOptionsForCategory,
  detectConditionFromText,
  detectShoeSubtype,
  gereinigtSinnvoll,
  showsConditionCard,
  type ConditionSlug,
} from '@/lib/conditionConfig'

/**
 * BLOCK 14 — Smart Form 2.0: der Angebots-Erstell-Flow als Card-für-Card-Reise
 * (Plan 3.3). Eine Sache pro Schritt, „Zurück" immer möglich, Optionales
 * überspringbar. Die KI erkennt den Artikel (analyzeListing) und bestimmt die
 * Detail-Felder; das Formular rendert sie generisch (AiFields). Fällt die KI
 * aus, greift die lokale Block-10-Erkennung (categoryConfig). Autosave in
 * localStorage + Draft-Upsert schützt vor Verlust.
 */

const CONDITION_SLUGS = CONDITION_GRADES.map((g) => g.slug)
const CATEGORY_IDS = CATEGORIES.map((c) => String(c.id))

const STEPS = ['Foto & Titel', 'Details', 'Zustand', 'Preis & Ort', 'Fertig'] as const

interface Snapshot {
  v: 1
  ts: number
  title: string
  category: string
  manualCategory: boolean
  priceType: 'fixed' | 'free'
  price: string
  gemeinden: string[]
  smartData: SmartData
  condition: ConditionSlug | null
  conditionDetail: string
  gereinigt: boolean
  description: string
  imageUrls: string[]
  aiResult: AnalyzeResult | null
  autoRelease: boolean
}

interface AngebotCardFlowProps {
  initial?: ChameleonInitial
  onSuccess?: () => void
}

export function AngebotCardFlow({ initial, onSuccess }: AngebotCardFlowProps) {
  const user = useAppStore((s) => s.user)
  const bumpFeedVersion = useAppStore((s) => s.bumpFeedVersion)
  const router = useRouter()

  const draftId = initial?.draftId

  const [step, setStep] = useState(0)
  const [title, setTitle] = useState(initial?.title ?? '')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [manualCategory, setManualCategory] = useState(!!initial?.category)
  const [showCatPicker, setShowCatPicker] = useState(false)

  const [priceType, setPriceType] = useState<'fixed' | 'free'>(initial?.priceType ?? 'fixed')
  const [price, setPrice] = useState(initial?.price ?? '')
  const [gemeinden, setGemeinden] = useState<string[]>(
    initial?.gemeinden ?? (user?.gemeinde ? [user.gemeinde] : [])
  )
  const [smartData, setSmartData] = useState<SmartData>(initial?.smartData ?? {})
  const [condition, setCondition] = useState<ConditionSlug | null>(null)
  const [conditionDetail, setConditionDetail] = useState('')
  const [conditionError, setConditionError] = useState(false)
  const [conditionConfirmed, setConditionConfirmed] = useState(false)
  const [gereinigt, setGereinigt] = useState(false)
  const [description, setDescription] = useState(initial?.description ?? '')
  const [imageUrls, setImageUrls] = useState<string[]>(initial?.imageUrls ?? [])
  const [isUploading, setIsUploading] = useState(false)

  const [aiResult, setAiResult] = useState<AnalyzeResult | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  const [autoRelease, setAutoRelease] = useState(true)
  const [show48hModal, setShow48hModal] = useState(false)
  const [legalConfirmed, setLegalConfirmed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Partial<Record<'title' | 'category' | 'gemeinde' | 'price', string>>>({})

  // Recovery-Banner (Autosave, Plan 3.4).
  const [recoverySnapshot, setRecoverySnapshot] = useState<Snapshot | null>(null)
  const recoveryResolvedRef = useRef(false)
  const dbDraftIdRef = useRef<string | null>(draftId ?? null)
  const storageKey = user ? `uri-draft-${user.id}` : null

  const shoeSubtype = detectShoeSubtype(`${title} ${aiResult?.artikel_typ ?? ''}`)

  // ---- Recovery beim ersten Mount prüfen (nur wenn kein DB-Draft geladen) ----
  useEffect(() => {
    if (!storageKey) return
    if (draftId) {
      recoveryResolvedRef.current = true
      return
    }
    try {
      const raw = localStorage.getItem(storageKey)
      if (raw) {
        const snap = JSON.parse(raw) as Snapshot
        if (snap?.v === 1 && (snap.title?.trim() || snap.imageUrls?.length)) {
          setRecoverySnapshot(snap)
          return // recoveryResolvedRef bleibt false → noch nicht überschreiben
        }
      }
    } catch {
      /* korrupter Snapshot → ignorieren */
    }
    recoveryResolvedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Autosave nach localStorage (nur nach aufgelöster Recovery) ----
  useEffect(() => {
    if (!storageKey || !recoveryResolvedRef.current) return
    if (!title.trim() && imageUrls.length === 0) return
    const snap: Snapshot = {
      v: 1,
      ts: Date.now(),
      title,
      category,
      manualCategory,
      priceType,
      price,
      gemeinden,
      smartData,
      condition,
      conditionDetail,
      gereinigt,
      description,
      imageUrls,
      aiResult,
      autoRelease,
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(snap))
    } catch {
      /* Quota o.ä. → still ignorieren */
    }
  }, [
    storageKey, title, category, manualCategory, priceType, price, gemeinden,
    smartData, condition, conditionDetail, gereinigt, description, imageUrls,
    aiResult, autoRelease,
  ])

  // ---- Debounced Draft-Upsert in die DB (~4s nach letzter Änderung) ----
  useEffect(() => {
    if (isSubmitting) return
    if (title.trim().length < 3) return
    const handle = setTimeout(async () => {
      try {
        const { id } = await autosaveDraftAction(dbDraftIdRef.current, {
          type: 'Angebot',
          title: title.trim(),
          category: category || undefined,
          description: buildDescription() || undefined,
          condition: condition ?? undefined,
          price_type: priceType,
          price: priceType === 'fixed' && price ? parseFloat(price) : undefined,
          gemeinden,
          smart_data: buildSmartData(),
          image_urls: imageUrls,
        })
        dbDraftIdRef.current = id
      } catch (err) {
        console.error('[autosave draft]', err)
      }
    }, 4000)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, category, description, condition, priceType, price, gemeinden, smartData, gereinigt, conditionDetail, imageUrls])

  const applySnapshot = (snap: Snapshot) => {
    setTitle(snap.title ?? '')
    setCategory(snap.category ?? '')
    setManualCategory(!!snap.manualCategory)
    setPriceType(snap.priceType ?? 'fixed')
    setPrice(snap.price ?? '')
    setGemeinden(snap.gemeinden ?? [])
    setSmartData(snap.smartData ?? {})
    setCondition(snap.condition ?? null)
    setConditionDetail(snap.conditionDetail ?? '')
    setGereinigt(!!snap.gereinigt)
    setDescription(snap.description ?? '')
    setImageUrls(snap.imageUrls ?? [])
    setAiResult(snap.aiResult ?? null)
    setAutoRelease(snap.autoRelease ?? true)
  }

  // ---- KI-Analyse (debounced): erkennt Artikel aus Fotos und/oder Titel ----
  const analyzeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const runAnalyze = useCallback(
    (nextTitle: string, nextImages: string[]) => {
      if (analyzeTimer.current) clearTimeout(analyzeTimer.current)
      if (nextTitle.trim().length < 3 && nextImages.length === 0) return
      analyzeTimer.current = setTimeout(async () => {
        setAiLoading(true)
        try {
          const res = await fetch('/api/analyze-listing', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ text: nextTitle, imageUrls: nextImages }),
          })
          const json = await res.json().catch(() => ({ result: null }))
          // Zweite Verteidigungslinie: auch client-seitig strikt validieren.
          const result = validateAnalyzeResult(json?.result, CATEGORY_IDS, CONDITION_SLUGS)
          if (result) {
            setAiResult(result)
            if (!manualCategory) setCategory(result.feed_kategorie)
          }
        } catch (err) {
          // Nie blockierend (Lektion 7): geloggt, Flow läuft ohne KI weiter.
          console.error('[analyzeListing client]', err)
        } finally {
          setAiLoading(false)
        }
      }, 700)
    },
    [manualCategory]
  )

  useEffect(() => {
    return () => {
      if (analyzeTimer.current) clearTimeout(analyzeTimer.current)
    }
  }, [])

  if (!user) {
    return (
      <div className="space-y-4 py-8 text-center">
        <p className="text-white/60">Bitte melde dich an, um ein Angebot zu erstellen.</p>
      </div>
    )
  }

  const categoryLabel = CATEGORIES.find((c) => String(c.id) === category)?.label ?? ''
  const fallbackCfg = category ? categoryConfig[category as keyof typeof categoryConfig] : undefined

  // Zustand-Optionen: KI-Teilmenge, sonst lokale Anwendbarkeits-Map.
  const conditionOptions: ConditionSlug[] = aiResult
    ? aiResult.zustand_optionen
    : conditionOptionsForCategory(category, shoeSubtype)
  const conditionSuggestion: ConditionSlug | null =
    aiResult?.zustand_vorschlag ?? detectConditionFromText(`${title} ${description}`)
  const gereinigtApplicable = aiResult
    ? aiResult.gereinigt_sinnvoll
    : gereinigtSinnvoll(category, shoeSubtype)
  const showConditionStep = showsConditionCard(category)

  // Vorauswahl des Zustands-Vorschlags (nur solange nicht bestätigt/gewählt).
  const effectiveCondition = condition ?? conditionSuggestion
  const activeGrade = CONDITION_GRADES.find((g) => g.slug === effectiveCondition)
  const needsDetail = activeGrade?.requiresDetail

  function buildDescription(): string {
    const parts: string[] = []
    if (description.trim()) parts.push(description.trim())
    if (needsDetail && conditionDetail.trim()) parts.push(conditionDetail.trim())
    return parts.join('\n\n')
  }

  function buildSmartData(): SmartData | undefined {
    const merged: SmartData = { ...smartData }
    if (gereinigtApplicable && gereinigt) merged[GEREINIGT_KEY] = 'Ja'
    return Object.keys(merged).length > 0 ? merged : undefined
  }

  const toggleGemeinde = (g: string) =>
    setGemeinden((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]))

  const onImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    setIsUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const url = await uploadListingImage(file, user.id)
        uploaded.push(url)
      }
      const next = [...imageUrls, ...uploaded].slice(0, 5)
      setImageUrls(next)
      toast.success('Foto hochgeladen 📸')
      runAnalyze(title, next)
    } catch (err) {
      toast.error((err as Error).message)
    } finally {
      setIsUploading(false)
    }
  }

  const onTitleChange = (v: string) => {
    setTitle(v)
    // Lokale Sofort-Erkennung (Block 10) — greift bis die KI-Antwort da ist.
    if (!manualCategory) {
      const local = detectCategory(v)
      if (local) setCategory(local)
    }
    runAnalyze(v, imageUrls)
  }

  const handleSaveDraft = async () => {
    if (title.trim().length < 3) {
      setErrors({ title: 'Für einen Entwurf brauchst du nur einen Titel (mind. 3 Zeichen).' })
      setStep(0)
      toast.error('Titel fehlt (mind. 3 Zeichen).')
      return
    }
    setIsSubmitting(true)
    try {
      const { id } = await autosaveDraftAction(dbDraftIdRef.current, {
        type: 'Angebot',
        title: title.trim(),
        category: category || undefined,
        description: buildDescription() || undefined,
        condition: showConditionStep ? (effectiveCondition ?? undefined) : undefined,
        price_type: priceType,
        price: priceType === 'fixed' && price ? parseFloat(price) : undefined,
        gemeinden,
        smart_data: buildSmartData(),
        image_urls: imageUrls,
      })
      dbDraftIdRef.current = id
      if (storageKey) localStorage.removeItem(storageKey)
      toast.success('Als Entwurf gespeichert 📝 – du findest ihn unter „Meine Inserate“.')
      bumpFeedVersion()
      router.refresh()
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Entwurf konnte nicht gespeichert werden')
    } finally {
      setIsSubmitting(false)
    }
  }

  const acceptAiSuggestion = () => {
    if (!aiResult) return
    if (aiResult.titel_vorschlag && !title.trim()) setTitle(aiResult.titel_vorschlag)
    if (aiResult.beschreibung_vorschlag && !description.trim())
      setDescription(aiResult.beschreibung_vorschlag)
    setCategory(aiResult.feed_kategorie)
    setManualCategory(false)
  }

  // ---- Navigation ----
  const validateStep = (s: number): boolean => {
    if (s === 0) {
      const e: typeof errors = {}
      if (title.trim().length < 3) e.title = 'Titel: mindestens 3 Zeichen.'
      if (!category) e.category = 'Bitte eine Kategorie wählen.'
      setErrors(e)
      return Object.keys(e).length === 0
    }
    if (s === 2 && showConditionStep) {
      if (needsDetail && !conditionDetail.trim()) {
        setConditionError(true)
        requestAnimationFrame(() =>
          document
            .getElementById('field-condition-detail')
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        )
        return false
      }
    }
    if (s === 3) {
      const e: typeof errors = {}
      if (gemeinden.length < 1) e.gemeinde = 'Bitte mindestens eine Gemeinde wählen.'
      if (priceType === 'fixed') {
        const p = parseFloat(price)
        if (!price || Number.isNaN(p) || p <= 0) e.price = 'Bitte einen Preis > 0 (oder „Gratis“).'
      }
      setErrors(e)
      return Object.keys(e).length === 0
    }
    return true
  }

  // Reihenfolge der Schritte — Zustand ggf. überspringen.
  const stepOrder = [0, 1, ...(showConditionStep ? [2] : []), 3, 4]

  const goNext = () => {
    if (!validateStep(step)) {
      toast.error('Da fehlt noch was! 👀')
      return
    }
    if (step === 2) setConditionConfirmed(true)
    const idx = stepOrder.indexOf(step)
    const next = stepOrder[Math.min(idx + 1, stepOrder.length - 1)]
    setStep(next)
  }
  const goBack = () => {
    const idx = stepOrder.indexOf(step)
    setStep(stepOrder[Math.max(idx - 1, 0)])
  }

  const finalValidate = (): boolean => {
    const e: typeof errors = {}
    if (title.trim().length < 3) e.title = 'Titel: mindestens 3 Zeichen.'
    if (!category) e.category = 'Bitte eine Kategorie wählen.'
    if (gemeinden.length < 1) e.gemeinde = 'Bitte mindestens eine Gemeinde wählen.'
    if (priceType === 'fixed') {
      const p = parseFloat(price)
      if (!price || Number.isNaN(p) || p <= 0) e.price = 'Bitte einen Preis > 0 (oder „Gratis“).'
    }
    setErrors(e)
    if (Object.keys(e).length > 0) return false
    if (showConditionStep && needsDetail && !conditionDetail.trim()) {
      setConditionError(true)
      setStep(2)
      return false
    }
    return true
  }

  const openPublishModal = () => {
    if (!finalValidate()) {
      toast.error('Da fehlt noch was! 👀 Bitte die markierten Felder ausfüllen.')
      return
    }
    if (!legalConfirmed) {
      toast.error('Bitte bestätige kurz, dass dein Inserat rechtlich ok ist ✅')
      return
    }
    setShow48hModal(true)
  }

  const doPublish = async () => {
    setIsSubmitting(true)
    try {
      const chosenCondition = showConditionStep ? effectiveCondition ?? undefined : undefined
      const payload = {
        title: title.trim(),
        description: buildDescription() || undefined,
        category,
        condition: chosenCondition,
        price_type: priceType,
        price: priceType === 'free' ? undefined : parseFloat(price),
        gemeinde: gemeinden[0],
        gemeinden,
        smart_data: buildSmartData(),
        image_urls: imageUrls,
        auto_release: autoRelease,
        pickup_available: true,
        shipping_available: false,
        shipping_cost: 0,
      }
      if (dbDraftIdRef.current) {
        await publishDraftAction(dbDraftIdRef.current, payload)
      } else {
        await createListingAction(payload)
      }
      // Erfolgs-Text bewusst identisch (E2E-Kompatibilität, Lektion 20).
      toast.success('Inserat erfolgreich erstellt! 🎉')
      if (storageKey) localStorage.removeItem(storageKey)
      bumpFeedVersion()
      router.refresh()
      onSuccess?.()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Veröffentlichen')
    } finally {
      setIsSubmitting(false)
      setShow48hModal(false)
    }
  }

  const inputCls =
    'mt-1 w-full rounded-lg border border-glass-border bg-obsidian-4 px-3 py-2 text-white placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-gold'
  const chipBase = 'chip-pop rounded-full px-3 py-1.5 text-sm transition'

  // ---------------- Recovery-Banner ----------------
  if (recoverySnapshot) {
    return (
      <div
        data-testid="draft-recovery"
        className="space-y-4 rounded-2xl border border-gold/40 bg-gold/10 p-5 text-center animate-fade-in"
      >
        <div className="text-3xl">✨</div>
        <p className="font-display font-bold text-white">
          Dein angefangenes Inserat wartet auf dich — weitermachen?
        </p>
        {recoverySnapshot.title && (
          <p className="text-sm text-white/70">„{recoverySnapshot.title}“</p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              applySnapshot(recoverySnapshot)
              recoveryResolvedRef.current = true
              setRecoverySnapshot(null)
            }}
            className="btn-gold flex-1 rounded-lg px-4 py-2 font-display font-bold"
          >
            Weitermachen
          </button>
          <button
            type="button"
            onClick={() => {
              if (storageKey) localStorage.removeItem(storageKey)
              recoveryResolvedRef.current = true
              setRecoverySnapshot(null)
            }}
            className="flex-1 rounded-lg border border-glass-border px-4 py-2 font-display font-bold text-white/70"
          >
            Neu starten
          </button>
        </div>
      </div>
    )
  }

  const progressSteps = stepOrder.map((s) => STEPS[s])

  return (
    <div className="space-y-6">
      {/* Fortschritts-Punkte */}
      <div className="flex items-center justify-center gap-2" aria-hidden="true">
        {stepOrder.map((s) => (
          <span
            key={s}
            className={`h-2 rounded-full transition-all duration-500 ${
              s === step ? 'w-6 bg-gold' : stepOrder.indexOf(s) < stepOrder.indexOf(step) ? 'w-2 bg-gold/60' : 'w-2 bg-white/20'
            }`}
          />
        ))}
      </div>
      <p className="text-center text-xs font-display font-bold uppercase tracking-wide text-gold/80">
        {STEPS[step]} · {stepOrder.indexOf(step) + 1}/{progressSteps.length}
      </p>

      {/* ---------------- Card 1: Foto + Titel ---------------- */}
      {step === 0 && (
        <div className="space-y-5 animate-card-in">
          <div>
            <PhotoUploadField
              id="chameleon-photo-upload"
              label="Zeig, was du weitergibst"
              hint="Mit Foto erkennt die App deinen Artikel — und du verkaufst schneller."
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

          <div id="field-title">
            <label className="text-sm font-display font-bold text-white">
              Was gibst du weiter? {title.length}/100
            </label>
            <input
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              maxLength={100}
              placeholder="z.B. Rote Kinderschuhe, Grösse 32"
              className={`${inputCls} ${errors.title ? 'ring-2 ring-uri-danger' : ''}`}
            />
            {errors.title && <p className="mt-1 text-xs text-uri-danger">{errors.title}</p>}
          </div>

          {/* Erkennungs-Banner mit Shimmer */}
          {aiLoading && (
            <div
              data-testid="ai-shimmer"
              className="shimmer-band rounded-lg border border-gold/30 px-3 py-2 text-sm text-white/70"
            >
              ✨ Ich schaue mir deinen Artikel an …
            </div>
          )}
          {!aiLoading && aiResult && (
            <button
              type="button"
              data-testid="ai-banner"
              onClick={acceptAiSuggestion}
              className="w-full rounded-lg border border-gold/50 bg-gold/10 px-3 py-2 text-left animate-fade-in"
            >
              <span className="text-sm text-white">
                ✨ Erkannt: <strong>{aiResult.artikel_typ}</strong> — passt das?
              </span>
              <span className="mt-0.5 block text-xs text-gold">Tippen übernimmt den Vorschlag</span>
            </button>
          )}

          {/* Kategorie: Banner (antippbar) + Fallback-Select */}
          <div id="field-category">
            {category && !showCatPicker ? (
              <button
                type="button"
                onClick={() => setShowCatPicker(true)}
                className="flex w-full items-center justify-between rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-left"
              >
                <span className="text-sm text-white">
                  {manualCategory ? `Kategorie: ${categoryLabel}` : `✨ Erkannt: ${categoryLabel}`}
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
            {errors.category && <p className="mt-1 text-xs text-uri-danger">{errors.category}</p>}
          </div>
        </div>
      )}

      {/* ---------------- Card 2: Details (KI-Felder / Fallback) ---------------- */}
      {step === 1 && (
        <div className="space-y-5 animate-card-in">
          <p className="text-sm font-display font-bold text-white">
            Ein paar Details – so finden dich die Richtigen schneller 💫
          </p>
          {aiResult && aiResult.felder.length > 0 ? (
            <>
              <MatchPowerBar filled={aiFilledCount(aiResult.felder, smartData)} total={aiResult.felder.length} />
              <AiFields fields={aiResult.felder} value={smartData} onChange={setSmartData} />
            </>
          ) : fallbackCfg ? (
            <SmartFields fields={fallbackCfg.fields} value={smartData} onChange={setSmartData} />
          ) : (
            <p className="text-xs text-white/40">
              Für diese Kategorie brauchst du keine Extra-Felder – das reicht so. 💛
            </p>
          )}
        </div>
      )}

      {/* ---------------- Card 3: Zustand ---------------- */}
      {step === 2 && showConditionStep && (
        <div className="space-y-5 animate-card-in">
          <p className="text-sm font-display font-bold text-white">
            In welchem Zustand ist dein Artikel? 🤝
          </p>
          {conditionSuggestion && !conditionConfirmed && (
            <p className="text-xs text-gold">✨ Vorschlag — stimmt das? Tippen bestätigt.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {conditionOptions.map((slug) => {
              const grade = CONDITION_GRADES.find((g) => g.slug === slug)!
              const isActive = effectiveCondition === slug
              const isSuggested = conditionSuggestion === slug && !conditionConfirmed && condition === null
              return (
                <button
                  key={slug}
                  type="button"
                  data-testid={`condition-${slug}`}
                  onClick={() => {
                    setCondition(slug)
                    setConditionConfirmed(true)
                    setConditionError(false)
                  }}
                  className={`${chipBase} ${
                    isActive
                      ? 'bg-gold text-obsidian font-bold'
                      : 'glass-card glass-card-hover text-white/80'
                  } ${isSuggested ? 'animate-pulse-gold ring-2 ring-gold' : ''}`}
                  title={grade.hint}
                >
                  {grade.short}
                </button>
              )
            })}
          </div>
          {activeGrade?.hint && (
            <p className="text-xs text-white/50">{activeGrade.hint}</p>
          )}

          {gereinigtApplicable && (
            <button
              type="button"
              data-testid="condition-gereinigt"
              onClick={() => setGereinigt((v) => !v)}
              className={`${chipBase} ${
                gereinigt ? 'bg-gold text-obsidian font-bold' : 'glass-card glass-card-hover text-white/80'
              }`}
            >
              🧼 {GEREINIGT_LABEL}
            </button>
          )}

          {needsDetail && (
            <div id="field-condition-detail">
              <label className="text-sm font-display font-bold text-white">
                {needsDetail === 'maengel'
                  ? 'Welche Mängel? (kurz & ehrlich)'
                  : 'Was ist defekt? (kurz beschreiben)'}
              </label>
              <textarea
                data-testid="condition-detail"
                value={conditionDetail}
                onChange={(e) => {
                  setConditionDetail(e.target.value)
                  if (e.target.value.trim()) setConditionError(false)
                }}
                rows={2}
                placeholder={needsDetail === 'maengel' ? 'z.B. kleiner Fleck am Ärmel' : 'z.B. Akku defekt, lädt nicht mehr'}
                className={`${inputCls} ${conditionError ? 'ring-2 ring-uri-danger' : ''}`}
              />
              {conditionError && (
                <p data-testid="condition-detail-error" className="mt-1 text-xs text-uri-danger">
                  Bitte kurz beschreiben — so bleibt der Deal fair. 💛
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---------------- Card 4: Preis + Gemeinden ---------------- */}
      {step === 3 && (
        <div className="space-y-5 animate-card-in">
          <div id="field-price">
            <label className="text-sm font-display font-bold text-white">Preis-Modell</label>
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

          <div id="field-gemeinde">
            <label className="text-sm font-display font-bold text-white">
              Gemeinde(n){' '}
              {gemeinden.length > 0 && <span className="text-gold">· {gemeinden.length} gewählt</span>}
            </label>
            <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-y-auto">
              {GEMEINDEN.map((g) => {
                const active = gemeinden.includes(g)
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGemeinde(g)}
                    className={`${chipBase} ${
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

          <div>
            <label className="text-sm text-white/80">Beschreibung (optional) {description.length}/2000</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="Erzähl kurz, was dein Angebot besonders macht …"
              className={inputCls}
            />
          </div>
        </div>
      )}

      {/* ---------------- Card 5: Zusammenfassung ---------------- */}
      {step === 4 && (
        <div className="space-y-4 animate-card-in">
          <p className="text-sm font-display font-bold text-white">Alles bereit? Ein kurzer Blick 👇</p>
          <div className="space-y-3 rounded-2xl border border-glass-border bg-obsidian-3 p-4">
            <SummaryRow onJump={() => setStep(0)} label="Titel" value={title || '—'} />
            <SummaryRow onJump={() => setStep(0)} label="Kategorie" value={categoryLabel || '—'} />
            {showConditionStep && (
              <SummaryRow
                onJump={() => setStep(2)}
                label="Zustand"
                value={conditionLabel(effectiveCondition) ?? 'Nicht angegeben'}
              />
            )}
            <SummaryRow
              onJump={() => setStep(3)}
              label="Preis"
              value={priceType === 'free' ? 'Gratis 🎁' : price ? `CHF ${price}` : '—'}
            />
            <SummaryRow onJump={() => setStep(3)} label="Gemeinden" value={gemeinden.join(', ') || '—'} />
          </div>

          <label className="flex items-start gap-2 text-xs text-white/80">
            <input
              type="checkbox"
              checked={legalConfirmed}
              onChange={(e) => setLegalConfirmed(e.target.checked)}
              className="mt-0.5"
            />
            <span>Ich bestätige, dass das Inserat rechtlich korrekt ist.</span>
          </label>
        </div>
      )}

      {/* ---------------- Navigation ---------------- */}
      <div className="flex gap-2 pt-2">
        {stepOrder.indexOf(step) > 0 && (
          <button
            type="button"
            data-testid="cardflow-back"
            onClick={goBack}
            className="rounded-lg border border-glass-border px-4 py-2 font-display font-bold text-white/70"
          >
            Zurück
          </button>
        )}
        {step !== 4 ? (
          <button
            type="button"
            data-testid="cardflow-next"
            onClick={goNext}
            className="btn-gold flex-1 rounded-lg px-4 py-2 font-display font-bold"
          >
            Weiter
          </button>
        ) : (
          <button
            type="button"
            onClick={openPublishModal}
            disabled={isSubmitting}
            className="btn-gold flex-1 rounded-lg px-4 py-2 font-display font-bold disabled:opacity-50"
          >
            {isSubmitting ? 'Wird veröffentlicht …' : 'Veröffentlichen'}
          </button>
        )}
      </div>

      {/* „Als Entwurf speichern" bleibt jederzeit erreichbar (Plan 3.4). */}
      {!draftId && (
        <button
          type="button"
          onClick={handleSaveDraft}
          disabled={isSubmitting}
          className="w-full rounded-lg border border-glass-border px-4 py-2 text-sm font-display font-bold text-white/60 disabled:opacity-50"
        >
          Als Entwurf speichern
        </button>
      )}

      {/* ---------------- 48h-Modal (VOR dem Insert) ---------------- */}
      {show48hModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={() => setShow48hModal(false)} />
          <div
            data-testid="publish-48h-modal"
            className="relative z-10 w-full max-w-md space-y-4 rounded-3xl border border-gold/30 bg-obsidian-2 p-6 shadow-modal animate-card-in"
          >
            <h3 className="text-center text-xl font-display font-bold text-white">
              ⚡ Gleich kann&apos;s losgehen!
            </h3>
            <p className="text-sm leading-relaxed text-white/80">
              Sobald jemand dein Inserat kaufen möchte, startet ein 48-Stunden-Fenster: So lange ist
              es exklusiv für euch beide reserviert. Meldest du dich in dieser Zeit nicht, landet es
              automatisch wieder im Feed — und jemand anderes kann zugreifen. Schau also regelmässig
              vorbei: Vielleicht wartet schon gleich jemand auf genau dein Angebot! 💛
            </p>

            <button
              type="button"
              data-testid="auto-release-toggle"
              onClick={() => setAutoRelease((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-glass-border bg-obsidian-4 px-4 py-3"
            >
              <span className="text-sm font-display font-bold text-white">48-Std.-Automatik</span>
              <span
                className={`relative h-6 w-11 rounded-full transition ${
                  autoRelease ? 'bg-gold' : 'bg-white/20'
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${
                    autoRelease ? 'left-[22px]' : 'left-0.5'
                  }`}
                />
              </span>
            </button>
            {!autoRelease && (
              <p className="text-xs leading-relaxed text-white/60">
                Ohne Automatik bleibt eine Reservierung bestehen, bis du selbst entscheidest — dein
                Inserat kommt dann nicht automatisch zurück in den Feed.
              </p>
            )}

            <button
              type="button"
              onClick={doPublish}
              disabled={isSubmitting}
              className="btn-gold w-full rounded-lg px-4 py-3 font-display font-bold disabled:opacity-50"
            >
              {isSubmitting ? 'Wird veröffentlicht …' : 'Alles klar — veröffentlichen!'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MatchPowerBar({ filled, total }: { filled: number; total: number }) {
  const ratio = total > 0 ? filled / total : 0
  const label =
    filled === 0
      ? 'Noch keine Extra-Infos'
      : ratio < 0.34
        ? 'Solide — schon besser auffindbar'
        : ratio < 0.67
          ? 'Stark — Käufer finden dich schneller'
          : 'Volle Match-Power ✨'
  return (
    <div className="rounded-lg border border-glass-border bg-obsidian-4 p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-display font-bold text-white/80">Match-Power</span>
        <span className="text-xs text-gold">{label}</span>
      </div>
      <div className="mt-2 flex gap-1">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full ${i < filled ? 'bg-gold' : 'bg-glass'}`} />
        ))}
      </div>
    </div>
  )
}

function SummaryRow({
  label,
  value,
  onJump,
}: {
  label: string
  value: string
  onJump: () => void
}) {
  return (
    <button
      type="button"
      onClick={onJump}
      className="flex w-full items-center justify-between gap-3 text-left"
    >
      <span className="text-xs text-white/50">{label}</span>
      <span className="flex-1 truncate text-right text-sm font-semibold text-white">{value}</span>
      <span className="text-xs text-gold">✎</span>
    </button>
  )
}
