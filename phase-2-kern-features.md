# PHASE 2 – KERN-FEATURES
> Kopiere diesen gesamten Text als erste Nachricht an Claude Code.
> Voraussetzung: Phase 1 vollständig abgeschlossen (alle Checklisten-Punkte ✅)
> Phase-Ziel: Deal-Flow, Gamification, FOMO, Gesuche, Onboarding.

---

## SCHRITT 0 – PFLICHTLEKTÜRE

Lies in dieser exakten Reihenfolge:

```
1. CLAUDE.md
2. DEVELOPMENT_GUIDELINES.md
3. docs/database-schema.md
4. docs/auth-onboarding.md     (Phase 1 Ergebnis)
5. docs/feed.md                (Phase 1 Ergebnis)
6. docs/deal-flow.md           (wird diese Phase befüllt)
7. docs/gamification.md        (wird diese Phase befüllt)
8. docs/smart-match.md         (wird diese Phase befüllt)
9. /mnt/skills/user/frontend-design/SKILL.md
10. /mnt/skills/user/supabase-postgres-best-practices/SKILL.md
```

---

## SCHRITT 1 – Onboarding Flow

### `src/components/onboarding/OnboardingFlow.tsx`

5-Screen Flow, zeigt sich beim ersten Start (wenn `onboardingCompleted = false`).
Fullscreen Overlay über App. Fortschritt via Dots.

**Screen 1 – Welcome & FOMO**
Design (Frontend Skill: hochwirksamer erster Eindruck):
- Goldenes Logo-Branding zentriert
- Animiertes Erscheinen (staggered: Logo → Tagline → Features → CTA)
- 4 Value-Props mit Checkmarks: „Zeitsparend · KI-Benachrichtigungen · Privat & Business · Kostenlos starten"
- Live-Zähler Pioneer-Plätze:
  ```typescript
  // Echte DB-Abfrage:
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('pioneer_badge', true)
  const remaining = Math.max(0, 50 - (count ?? 0))
  ```
  → „🏆 Noch {remaining} Pionier-Plätze verfügbar!"
- CTA: „Jetzt starten" (gold)

**Screen 2 – Profil vervollständigen** (nur wenn eingeloggt)
- Avatar-Upload (optional)
- Anzeigename
- Gemeinde-Dropdown

**Screen 3 – Interessen wählen**
- CATEGORIES Grid (Multi-Select)
- Speichert `preferred_categories` in `profiles`

**Screen 4 – Push-Benachrichtigungen**
- Erklärung: „Wir benachrichtigen dich nur bei echten Matches"
- Button: „Benachrichtigungen aktivieren" → `Notification.requestPermission()`
- Skip-Option: „Später"

**Screen 5 – Willkommen + Bonus**
- Konfetti-Animation (CSS keyframes, keine externe Library)
- „🎉 Herzlich willkommen!" + Username
- Taler-Balance (100 Taler) gross in Gold
- CTA: „Los geht's!"
- `setOnboardingCompleted(true)`

---

## SCHRITT 2 – Deal-Flow (Herzstück)

> ⚠️ SICHERHEITSKRITISCH: Kontaktdaten kommen NIEMALS via CSS-Trick.
> Alle Transaktions-RPCs laufen SECURITY DEFINER in der DB.

### `src/lib/validations/transaction.ts`
```typescript
import { z } from 'zod'

export const BuyIntentSchema = z.object({
  listing_id:     z.string().uuid(),
  payment_method: z.enum(['cash', 'twint']),
  buyer_contact:  z.string().min(5, 'Kontakt erforderlich').max(100),
})
```

### `src/app/actions/transactions.ts`
```typescript
'use server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath }      from 'next/cache'
import { BuyIntentSchema }     from '@/lib/validations/transaction'

// Kaufabsicht bekunden
export async function createBuyIntent(rawData: unknown) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { listing_id, payment_method, buyer_contact } = BuyIntentSchema.parse(rawData)

  // Listing laden – nur benötigte Spalten
  const { data: listing } = await supabase
    .from('listings')
    .select('id, user_id, price, status, title')
    .eq('id', listing_id)
    .single()

  if (!listing || listing.status !== 'active')
    throw new Error('Inserat nicht mehr verfügbar')
  if (listing.user_id === user.id)
    throw new Error('Eigene Inserate können nicht gekauft werden')

  // Käufer-Check
  const { data: buyerProfile } = await supabase
    .from('profiles')
    .select('can_buy, is_banned')
    .eq('id', user.id)
    .single()
  if (!buyerProfile?.can_buy || buyerProfile.is_banned)
    throw new Error('Kaufen momentan nicht möglich')

  // Transaktion erstellen
  const commission = parseFloat(((listing.price ?? 0) * 0.1).toFixed(2))
  const { data: tx, error } = await supabase
    .from('transactions')
    .insert({
      listing_id,
      buyer_id:       user.id,
      seller_id:      listing.user_id,
      amount:         listing.price ?? 0,
      commission,
      payment_method,
      buyer_contact,
      status:         'pending',
    })
    .select('id')
    .single()

  if (error) throw new Error('Kaufanfrage fehlgeschlagen')

  // Inserat reservieren
  await supabase
    .from('listings')
    .update({ status: 'reserved' })
    .eq('id', listing_id)

  // Verkäufer benachrichtigen (via RPC, umgeht RLS-Insert-Restriction)
  await supabase.rpc('send_notification', {
    p_recipient_id: listing.user_id,
    p_title:        '⚡ Neue Kaufanfrage!',
    p_message:      `Jemand möchte "${listing.title}" kaufen.`,
    p_type:         'tx_pending',
    p_listing_id:   listing_id,
  })

  revalidatePath('/')
  return { transaction_id: tx.id }
}

// Verkäufer bestätigt (Provision abziehen)
export async function confirmSale(transaction_id: string) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  // RPC: atomischer Provision-Abzug
  const { data, error } = await supabase.rpc('process_transaction_commission', {
    p_transaction_id: transaction_id,
    p_seller_id:      user.id,
  })

  if (error || !data?.success) {
    throw new Error(data?.error ?? 'Bestätigung fehlgeschlagen')
  }

  // Käufer benachrichtigen
  const { data: tx } = await supabase
    .from('transactions')
    .select('buyer_id, listing_id')
    .eq('id', transaction_id)
    .single()

  if (tx) {
    await supabase.rpc('send_notification', {
      p_recipient_id: tx.buyer_id,
      p_title:        '✅ Verkäufer hat bestätigt!',
      p_message:      'Kontaktdaten wurden freigeschaltet. Macht einen Termin aus.',
      p_type:         'tx_confirmed',
      p_listing_id:   tx.listing_id,
    })
  }

  revalidatePath('/')
  return data
}

// Übergabe bestätigen
export async function completeTransaction(transaction_id: string) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { data: tx } = await supabase
    .from('transactions')
    .select('buyer_id, seller_id, listing_id, amount')
    .eq('id', transaction_id)
    .single()

  if (!tx || tx.seller_id !== user.id)
    throw new Error('Nicht berechtigt')

  await supabase
    .from('transactions')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', transaction_id)

  // Listing auf sold setzen (Trigger setzt fomo_expires_at automatisch)
  await supabase
    .from('listings')
    .update({ status: 'sold' })
    .eq('id', tx.listing_id)

  // XP für beide (idempotent)
  await supabase.rpc('award_xp', {
    p_user_id: tx.seller_id, p_amount: 50,
    p_reason: 'Verkauf abgeschlossen',
    p_idempotency_key: `listing_sold_${transaction_id}`,
  })
  await supabase.rpc('award_xp', {
    p_user_id: tx.buyer_id, p_amount: 10,
    p_reason: 'Kauf abgeschlossen',
    p_idempotency_key: `listing_bought_${transaction_id}`,
  })

  // Beide benachrichtigen
  await supabase.rpc('send_notification', {
    p_recipient_id: tx.buyer_id,
    p_title:        '🏆 Deal abgeschlossen!',
    p_message:      'Bitte bewerte den Verkäufer.',
    p_type:         'tx_completed',
    p_listing_id:   tx.listing_id,
  })

  revalidatePath('/')
}
```

### `src/components/listing/DealFlow.tsx`

Kaufen-Button-Bereich (eingebettet in ListingDetail):

**Käufer-Seite (status=active):**
- Button „🛒 Kaufen" → Auth-Gate Modal
- Nach Auth: Bottom-Sheet mit:
  - Preis-Bestätigung (gross)
  - Zahlungsart: Bar | TWINT (Radio)
  - Kontakt-Input (Telefon oder TWINT-Name)
  - Checkbox: „Verbindliche Kaufabsicht"
  - Submit → `createBuyIntent()`
  - Loading/Success State

**Käufer-Seite (status=reserved, eigene TX):**
- Status-Card: „⏳ Wartet auf Verkäufer-Bestätigung"
- Kontaktdaten (NUR wenn `status=confirmed`, via RLS-Query)

**Verkäufer-Seite (eigenes Inserat mit pending TX):**
Wird in Seller Dashboard angezeigt (Profil-Bereich)

### `src/components/listing/SellerDashboard.tsx`

Im Profil-Tab, zeigt alle ausstehenden Kaufanfragen:

Für jede Transaktion mit `status='pending'`:
- Käufer-Info (anonym: „Kaufinteressent")
- Verkaufspreis + Provisions-Hinweis: „Kosten: CHF X.– (10% Provision in Talern)"
- Taler-Saldo-Check: Anzeigen ob genug Taler vorhanden
- Button: ✅ Bestätigen + ❌ Ablehnen
- „Bestätigen" → zeigt Provisions-Warnung → `confirmSale()`
- Wenn zu wenig Taler: Wallet-Aufladen CTA (Phase 3/4)

### `src/components/listing/ContactSection.tsx`

SICHERHEIT: Kontaktdaten kommen nur via Server-Query mit RLS-Schutz.

```typescript
// Nur anzeigen wenn transaction status = confirmed
// und user ist buyer_id ODER seller_id
async function loadContactData(transactionId: string) {
  const supabase = createServerClient()
  const { data } = await supabase
    .from('transactions')
    .select('buyer_contact, seller_contact, status')
    .eq('id', transactionId)
    .single()
  // RLS gibt NULL zurück wenn nicht berechtigt
  // NIEMALS display:none als Schutz verwenden
  return data
}
```

### No-Show Eskalation

`src/app/actions/escalate.ts`:
```typescript
'use server'
export async function reportNoShow(transaction_id: string) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { data, error } = await supabase.rpc('escalate_no_show', {
    p_transaction_id: transaction_id,
    p_seller_id:      user.id,
  })

  if (error || !data?.success) throw new Error('Eskalation fehlgeschlagen')
  revalidatePath('/profile')
  return data
}
```

---

## SCHRITT 3 – Gamification System

### `src/hooks/useXP.ts`
```typescript
'use client'
import { useEffect, useRef } from 'react'
import { useAppStore }       from '@/store/appStore'

export function useXPWatcher() {
  const user         = useAppStore(s => s.user)
  const prevXP       = useRef(user?.xp_points ?? 0)
  const prevLevel    = useRef(user?.level)

  useEffect(() => {
    if (!user) return

    const gained = user.xp_points - prevXP.current
    if (gained > 0) {
      // XP-Toast
      showXPToast(gained)
    }
    if (user.level !== prevLevel.current) {
      // Level-Up Modal
      showLevelUpModal(user.level)
    }
    prevXP.current  = user.xp_points
    prevLevel.current = user.level
  }, [user?.xp_points, user?.level])
}
```

### `src/components/gamification/XPToast.tsx`

Angezeigt via `sonner` custom toast:
- Gold-Münze Icon + „+{xp} XP" in Gold
- Progress Bar (aktueller Fortschritt zur nächsten Stufe)
- Auto-dismiss nach 3s

### `src/components/gamification/LevelUpModal.tsx`

Fullscreen-Overlay mit:
- CSS-Konfetti Animation (reine CSS keyframes, keine Library)
- Neues Level-Badge (gross, zentriert)
- Level-Name in `font-display text-4xl font-bold text-gold`
- „Du bist jetzt [Level]!"
- Neue Vorteile erklären
- CTA: „Weiter"

### `src/components/gamification/LevelBadge.tsx`

Wiederverwendbares Badge:
```typescript
const LEVEL_CONFIG = {
  'Beobachter':       { emoji: '👁️',  color: 'text-white/60',   border: '' },
  'Dorf-Händler':     { emoji: '🥉',  color: 'text-amber-600',  border: 'border-amber-700' },
  'Lokal-Matador':    { emoji: '🥈',  color: 'text-slate-300',  border: 'border-slate-400' },
  'Kantons-Legende':  { emoji: '🥇',  color: 'text-gold',       border: 'border-gold/60 shadow-gold' },
  'Gotthard-Titan':   { emoji: '💎',  color: 'text-cyan-300',   border: 'border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)]' },
}
```

---

## SCHRITT 4 – FOMO System

### Feed-Anpassung: FOMO-Zone

`src/components/feed/FomoZone.tsx`:
- Titel: „👁️ Kürzlich verpasst"
- Horizontale Liste verkaufter Inserate (letzte 24h, `fomo_expires_at > now()`)
- Rotes Overlay über Bild, pulsierend
- Countdown: „Noch X Std. sichtbar"
- Query (Best Practice: explizite Spalten):
  ```typescript
  .select('id, title, price, image_url, category, fomo_expires_at')
  .eq('status', 'sold')
  .gt('fomo_expires_at', new Date().toISOString())
  .order('fomo_expires_at', { ascending: true })
  .limit(10)
  ```

### TikTok-Scroll Modus

`src/components/feed/TikTokScroll.tsx`:
- Triggerung: `IntersectionObserver` am Ende des normalen Feeds
- Transition: sanftes Einblenden des Vollbild-Modus
- Container: `overflow-y-scroll scroll-snap-type-y-mandatory h-[100dvh]`
- Jedes Inserat: `scroll-snap-align-start h-[100dvh] relative`
- Bild: `object-cover w-full h-full` (edge-to-edge)
- Overlay: Gradient `from-transparent to-black/80` von oben
- Inhalt-Overlay unten (Glas-Card): Titel, Preis, Verkäufer, Buttons
- Exit-Button: „← Zurück" oben links, immer sichtbar
- Sortierung: Boosts → Neueste → FOMO (24h)

---

## SCHRITT 5 – Gesuch-Formular & Smart Match (Basis)

### `src/components/create/GesuchForm.tsx`

3-Step Formular:

**Step 1:** Was suchst du?
- Freitext (Titel, was wird gesucht)
- Kategorie-Auswahl

**Step 2:** Details
- Max. Budget (CHF, optional)
- Gemeinde
- Bis wann gebraucht (Datum, optional)
- Zusätzliche Beschreibung

**Step 3:** Bestätigen
- Vorschau + Submit

### `src/app/actions/listings.ts` – Gesuch erstellen

Analog zu `createListingAction`, type: 'Gesuch'.
Nach Erstellung: `calculateSmartMatches()` aufrufen.

### `src/lib/smartMatch.ts` – Basis Smart Match (ohne KI)

```typescript
// Einfaches regelbasiertes Matching (KI-Upgrade in Phase 3)
export async function calculateSmartMatches(gesuchId: string) {
  const supabase = createServerClient()

  // Gesuch laden
  const { data: gesuch } = await supabase
    .from('listings')
    .select('id, category, max_budget, gemeinde, title, user_id')
    .eq('id', gesuchId)
    .single()
  if (!gesuch) return

  // Passende Angebote finden
  const { data: offers } = await supabase
    .from('listings')
    .select('id, category, price, gemeinde, title, user_id')
    .eq('type', 'Angebot')
    .eq('status', 'active')
    .eq('category', gesuch.category) // Kategorie muss passen
    .neq('user_id', gesuch.user_id)  // Kein Selbst-Match

  for (const offer of offers ?? []) {
    let score = 40 // Basis-Score (Kategorie matcht)
    if (gesuch.max_budget && offer.price && offer.price <= gesuch.max_budget) score += 30
    if (offer.gemeinde === gesuch.gemeinde) score += 30

    if (score >= 60) {
      await supabase.from('smart_matches').upsert({
        gesuch_id:          gesuchId,
        matched_listing_id: offer.id,
        user_id:            gesuch.user_id,
        score,
      }, { onConflict: 'gesuch_id,matched_listing_id', ignoreDuplicates: true })
    }
  }
}
```

---

## SCHRITT 6 – Profil Dashboard

### `src/app/profile/page.tsx`
```typescript
// Protected Route
import { createServerClient } from '@/lib/supabase/server'
import { redirect }           from 'next/navigation'
import { ProfileDashboard }   from '@/components/profile/ProfileDashboard'

export default async function ProfilePage() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/?auth=required')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id,username,full_name,avatar_url,gemeinde,xp_points,level,credits,avg_rating,review_count,pioneer_badge,strikes,referral_code,preferred_categories')
    .eq('id', user.id)
    .single()

  const { data: myListings } = await supabase
    .from('listings')
    .select('id,title,status,price,type,created_at,image_url,views')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const { data: matches } = await supabase
    .from('smart_matches')
    .select('id,score,created_at,listings!matched_listing_id(id,title,price,image_url,category)')
    .eq('user_id', user.id)
    .eq('dismissed', false)
    .order('score', { ascending: false })
    .limit(10)

  return <ProfileDashboard profile={profile} myListings={myListings ?? []} matches={matches ?? []} />
}
```

### `src/components/profile/ProfileDashboard.tsx`

Layout:
- **Header-Block**: Avatar + Name + Level-Badge + Sterne-Bewertung
- **XP-Fortschrittsbalken**: Aktuell/Ziel, Label „{xp} / {nextLevel} XP"
- **Pioneer-Badge** (wenn vorhanden): Gold-Umrandung + „🏆 Pionier der ersten Stunde"
- **Stats-Grid** (3 Kacheln): Taler-Guthaben · Deals · Aktive Inserate
- **Quick-Actions Kacheln** (2×4 Grid):
  - 🎯 Smart Matches (Badge wenn neue vorhanden)
  - 📦 Meine Inserate
  - 🛒 Meine Käufe
  - 💰 Meine Verkäufe
  - 🎫 Meine Tickets (Phase 3)
  - 📅 Meine Events (Phase 3)
  - 👛 Wallet (Phase 3/4)
  - 🎁 Freunde einladen (Referral-Link kopieren)

### `src/components/profile/XPBar.tsx`

```typescript
const XP_LEVELS = [
  { name: 'Beobachter',      min: 0,    max: 49   },
  { name: 'Dorf-Händler',    min: 50,   max: 199  },
  { name: 'Lokal-Matador',   min: 200,  max: 499  },
  { name: 'Kantons-Legende', min: 500,  max: 999  },
  { name: 'Gotthard-Titan',  min: 1000, max: Infinity },
]

// Berechne Fortschritt zum nächsten Level
// Zeige animierten Balken in Gold
```

### `src/components/profile/SmartMatchList.tsx`

Liste der Matches:
- Match-Score als farbiger Ring (grün > 80, gelb 60-80)
- Inserat-Vorschau: Bild + Titel + Preis
- Buttons: „Ansehen" → ListingDetail öffnen | „Verwerfen" → dismissed=true

### `src/components/profile/MyListings.tsx`

Tabs: Aktiv | Reserviert | Verkauft | Entwürfe
Pro Inserat: kompakte Reihe mit Bild, Titel, Status-Badge, Views, Datum
Aktionen: Bearbeiten (Phase 4) | Löschen

### `src/app/profile/[username]/page.tsx` – Öffentliches Profil

Zeigt: Avatar, Name, Level, Bewertung, aktive Inserate
Zeigt NICHT: Telefon, E-Mail, Taler-Guthaben, Transaktionen

---

## SCHRITT 7 – Notifications (In-App)

### `src/hooks/useNotifications.ts`

```typescript
'use client'
import { useEffect } from 'react'
import { createClient }  from '@/lib/supabase/client'
import { useAppStore }   from '@/store/appStore'
import { toast }         from 'sonner'

export function useNotifications(userId: string | undefined) {
  const { addNotification, setNotifications } = useAppStore()
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return

    // Initiale Notifications laden (Best Practice: explizite Spalten)
    supabase
      .from('notifications')
      .select('id,title,message,type,is_read,listing_id,created_at')
      .eq('recipient_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setNotifications(data) })

    // Realtime für neue Notifications
    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notifications',
        filter: `recipient_id=eq.${userId}`,
      }, (payload) => {
        const n = payload.new as Notification
        addNotification(n)
        toast(n.title, { description: n.message })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])
}
```

### `src/components/layout/NotificationPanel.tsx`

Slide-in Panel von rechts (`translate-x-full` → `translate-x-0`):
- Backdrop-Click schliesst
- Header: „Benachrichtigungen" + „Alle als gelesen"
- Liste: Icon (je nach type) + Titel + Message + Zeit
- Leerer State: „Keine neuen Benachrichtigungen"
- Klick auf Notification → navigiert zu relevantem Inserat

---

## SCHRITT 8 – Bewertungssystem

### `src/components/listing/ReviewModal.tsx`

Öffnet sich nach abgeschlossener Transaktion:
- 1-5 Sterne (klickbare Sterne, hover-Effekt)
- Kommentar-Textarea (optional, max 500 Zeichen)
- Submit → Insert in `reviews` + XP vergeben

```typescript
// Server Action
export async function submitReview(data: ReviewInput) {
  // ...validation, auth check...
  await supabase.from('reviews').insert({ ...data, reviewer_id: user.id })
  // Trigger update_avg_rating läuft automatisch
  await supabase.rpc('award_xp', {
    p_user_id: user.id, p_amount: 5,
    p_reason: 'Bewertung abgegeben',
    p_idempotency_key: `review_given_${data.transaction_id}`,
  })
}
```

---

## SCHRITT 9 – Kommentare

### `src/components/listing/CommentSection.tsx`

Im ListingDetail:
- Liste bestehender Kommentare (Avatar + Username + Text + Datum)
- Kommentar-Input (nur für eingeloggte User)
- Zensur: Vor dem Speichern durch `censorText()` aus `lib/censor.ts`
- Submit → Insert + `award_xp(+5, 'comment_{id}')`

### `src/lib/censor.ts`
```typescript
const PATTERNS = [
  /(\+41|0041|041)[\s\-]?[\d\s\-]{7,}/g,
  /[\w.+-]+@[\w-]+\.[a-z]{2,}/gi,
  /wa\.me\/\d+/gi,
  /t\.me\/\w+/gi,
  /https?:\/\/\S+/gi,
  /\b0\d{9}\b/g,  // Schweizer Nummern ohne Vorwahl
]

export function censorText(text: string): string {
  return PATTERNS.reduce((t, p) => t.replace(p, '***'), text)
}

// Beide Stellen prüfen: client-seitig (UX) UND server-seitig (Sicherheit)
```

---

## SCHRITT 10 – Docs aktualisieren

**`docs/deal-flow.md`** → Status ✅, kompletter Flow dokumentiert
**`docs/gamification.md`** → Status ✅, XP-Tabelle, Level-Config
**`docs/smart-match.md`** → Status 🔄, Basis-Matching beschrieben, KI-Upgrade Phase 3
**`docs/notifications.md`** → Status 🔄, In-App fertig, Push Phase 3
**`docs/profile.md`** → Status ✅, Komponenten und Routen
**`CLAUDE.md`** → Phase 2 auf ✅ setzen

---

## ABSCHLUSS-CHECKLISTE

```
[ ] npm run build → 0 Errors
[ ] npm run lint  → 0 Errors
[ ] Onboarding Flow läuft komplett durch (5 Screens)
[ ] Kaufanfrage erstellen funktioniert
[ ] Verkäufer-Bestätigung + Provisions-Abzug funktioniert
[ ] Kontaktdaten NUR sichtbar nach confirmed (RLS-Test!)
[ ] No-Show Eskalation: Provision zurück + Strike gesetzt
[ ] XP wird vergeben (Inserat, Kauf, Verkauf, Kommentar)
[ ] Level-Up Modal erscheint bei Stufenaufstieg
[ ] FOMO-Overlay erscheint 24h nach Verkauf
[ ] TikTok-Scroll Modus funktioniert
[ ] Smart Match: Gesuch erstellen → Match erscheint im Profil
[ ] Profil-Dashboard zeigt echte Daten
[ ] Öffentliches Profil erreichbar via /profile/[username]
[ ] Notifications erscheinen in Echtzeit
[ ] Kommentare werden zensiert (Telefonnummern, Links)
[ ] Alle /docs/*.md aktualisiert
```
