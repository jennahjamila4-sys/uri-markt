# PHASE 2 – KERN-FEATURES (v2, korrigiert)
> Status: **Phase 2 ist lokal umgesetzt.** Diese Datei ist die **korrigierte Referenz**.
> Verifiziert gegen die Live-Datenbank (`lhqsuelguwfdflapzdhk`, EU Paris) am 05.07.2026.
> Bei Widerspruch zwischen bestehendem Code und dieser Datei gilt: **Live-DB + diese Datei.**
> Zweck: Claude Code darf beim Weiterarbeiten NIE zu den alten, fehlerhaften Mustern zurückkehren.

---

## GRUNDREGELN (gelten in ALLEN Phasen)

1. **Taler = `profiles.credits` (bigint, Rappen).** 1 Taler = 1 CHF = 100 credits.
   Anzeige immer `credits / 100`. Onboarding-Bonus 100 Taler = `10000` credits.
2. **Die XP-Tabelle heisst `xp_log`.** Die Tabelle `xp_events` existiert NICHT und darf nirgends referenziert werden.
3. **Geld-, Deal- und Buchungslogik läuft AUSSCHLIESSLICH über die fertigen SECURITY-DEFINER-RPCs** (Liste unten). Niemals von Hand im App-Code nachbauen (Race Conditions, RLS-Lücken).
4. **`user_id` kommt NIE vom Client.** Immer serverseitig via `supabase.auth.getUser()` bzw. `auth.uid()` in der RPC.
5. **Keine `SELECT *`-Queries.** Immer explizite Spaltenlisten.
6. **DB-Migrationen laufen über die Supabase-MCP im Planungs-Chat** (mit JJ-Bestätigung), NICHT über Claude Code.
7. **Nach jedem DB-Schritt: Grant/RLS-Check** (Regel D2):
   ```sql
   SELECT table_name, grantee, privilege_type
   FROM information_schema.role_table_grants
   WHERE table_schema = 'public' AND grantee IN ('anon','authenticated');
   ```
8. Vor jedem Commit: `npx tsc --noEmit` und `npm run build` müssen sauber sein. Kein `git push` ohne JJ-OK.

---

## VERIFIZIERTE RPC-FUNKTIONEN (Live-DB, Stand 05.07.2026)

Alle SECURITY DEFINER. Diese IMMER aufrufen statt die Logik nachzubauen.

| Funktion | Argumente | Rückgabe |
|---|---|---|
| `create_buy_intent` | `p_listing_id uuid, p_payment_method text, p_buyer_contact text` | jsonb: `{success, transaction_id}` oder `{success:false, error}` |
| `process_transaction_commission` | `p_transaction_id uuid, p_seller_id uuid` | jsonb: `{success}` oder `{success:false, error}` |
| `complete_transaction` | `p_transaction_id uuid, p_seller_id uuid` | jsonb: `{success, buyer_id, listing_id}` oder `{success:false, error}` |
| `escalate_no_show` | `p_transaction_id uuid, p_seller_id uuid` | jsonb: `{success}` oder `{success:false, error}` |
| `get_transaction_contact` | `p_transaction_id uuid` | Tabelle `(buyer_contact, seller_contact, status)` – liefert nur Zeilen, wenn Aufrufer Käufer/Verkäufer ist UND status = 'confirmed' |
| `send_notification` | `p_recipient_id, p_title, p_message, p_type, p_listing_id` | void |
| `award_xp` | `p_user_id uuid, p_amount int, p_reason text, p_idempotency_key text` | void – idempotent, setzt Level automatisch |
| `get_my_profile` | – | eigene `profiles`-Zeile |

Wichtige verifizierte Eigenschaften:
- `create_buy_intent` prüft selbst: Login, Listing aktiv, kein Eigenkauf, `can_buy`/`is_banned`. Es erstellt die Transaktion, setzt das Listing auf `reserved` und benachrichtigt den Verkäufer. **Der App-Code macht NICHTS davon zusätzlich.**
- `process_transaction_commission` zieht die Provision (10%, in Rappen) atomar ab und setzt die Transaktion auf `confirmed`. Bei zu wenig Taler: `{success:false, error:'Nicht genug Taler für die Provision'}`.
- `complete_transaction` setzt Transaktion auf `completed` und Listing auf `sold` (Trigger `set_fomo_on_sold` setzt `fomo_expires_at` automatisch).
- `escalate_no_show` erstattet die Provision, gibt dem Käufer einen Strike, storniert die Transaktion und reaktiviert das Listing.
- `award_xp` schreibt auch bei `p_amount = 0` eine Zeile in `xp_log` (wird in Phase 3 für das KI-Rate-Limit genutzt).
- Unique-Constraint `smart_matches(gesuch_id, matched_listing_id)` **existiert** → `upsert` mit `onConflict` ist erlaubt.

---

## SCHRITT 0 – PFLICHTLEKTÜRE (für Claude Code)

```
1. CLAUDE.md
2. DEVELOPMENT_GUIDELINES.md
3. docs/database-schema.md        ← Quelle der Wahrheit für Namen/Typen
4. docs/auth-onboarding.md
5. docs/feed.md
6. docs/deal-flow.md
7. docs/gamification.md
8. docs/smart-match.md
9. /mnt/skills/user/frontend-design/SKILL.md          (falls im Setup verfügbar)
10. /mnt/skills/user/supabase-postgres-best-practices/SKILL.md (falls verfügbar)
```

---

## SCHRITT 1 – Onboarding Flow

### `src/components/onboarding/OnboardingFlow.tsx`

5-Screen Flow beim ersten Start (`onboardingCompleted = false`). Fullscreen-Overlay, Fortschritt via Dots.

**Screen 1 – Welcome & FOMO**
- Goldenes Logo zentriert, staggered Animation (Logo → Tagline → Features → CTA)
- 4 Value-Props mit Checkmarks: „Zeitsparend · KI-Benachrichtigungen · Privat & Business · Kostenlos starten"
- Live-Zähler Pionier-Plätze (echte DB-Abfrage):
  ```typescript
  const { count } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('pioneer_badge', true)
  const remaining = Math.max(0, 50 - (count ?? 0))
  ```
  → „🏆 Noch {remaining} Pionier-Plätze verfügbar!"
- CTA: „Jetzt starten" (gold)

**Screen 2 – Profil vervollständigen** (nur wenn eingeloggt)
- Avatar-Upload (optional), Anzeigename, Gemeinde-Dropdown

**Screen 3 – Interessen wählen**
- Kategorien-Grid (Multi-Select) → speichert `preferred_categories` in `profiles`

**Screen 4 – Push-Benachrichtigungen**
- „Wir benachrichtigen dich nur bei echten Matches"
- Button → `Notification.requestPermission()`, Skip-Option „Später"

**Screen 5 – Willkommen + Bonus**
- CSS-Konfetti (keyframes, keine Library)
- „🎉 Herzlich willkommen!" + Username
- Taler-Balance gross in Gold: Anzeige `credits / 100` → **100 Taler** (in der DB: `10000` credits)
- CTA: „Los geht's!" → `setOnboardingCompleted(true)`

---

## SCHRITT 2 – Deal-Flow (Herzstück)

> ⚠️ SICHERHEITSKRITISCH: Kontaktdaten kommen NIE via CSS-Trick (`display:none` ist KEIN Schutz).
> Der gesamte Deal-Flow läuft über die vier RPCs. Der App-Code ist nur eine dünne Hülle.

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
import { revalidatePath }     from 'next/cache'
import { BuyIntentSchema }    from '@/lib/validations/transaction'

// Kaufabsicht bekunden – NUR via RPC (existiert live, macht alles selbst)
export async function createBuyIntent(rawData: unknown) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { listing_id, payment_method, buyer_contact } = BuyIntentSchema.parse(rawData)

  const { data, error } = await supabase.rpc('create_buy_intent', {
    p_listing_id:     listing_id,
    p_payment_method: payment_method,
    p_buyer_contact:  buyer_contact,
  })

  if (error || !data?.success) throw new Error(data?.error ?? 'Kaufanfrage fehlgeschlagen')

  revalidatePath('/')
  return { transaction_id: data.transaction_id as string }
}

// Verkäufer bestätigt – atomarer Provisions-Abzug via RPC
export async function confirmSale(transaction_id: string) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { data, error } = await supabase.rpc('process_transaction_commission', {
    p_transaction_id: transaction_id,
    p_seller_id:      user.id,
  })
  if (error || !data?.success) throw new Error(data?.error ?? 'Bestätigung fehlgeschlagen')

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

// Übergabe abschliessen – NUR via RPC complete_transaction (NICHT von Hand!)
export async function completeTransactionAction(transaction_id: string) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { data, error } = await supabase.rpc('complete_transaction', {
    p_transaction_id: transaction_id,
    p_seller_id:      user.id,
  })
  if (error || !data?.success) throw new Error(data?.error ?? 'Abschluss fehlgeschlagen')

  // XP für beide (idempotent)
  await supabase.rpc('award_xp', {
    p_user_id: user.id, p_amount: 50,
    p_reason: 'Verkauf abgeschlossen',
    p_idempotency_key: `listing_sold_${transaction_id}`,
  })
  await supabase.rpc('award_xp', {
    p_user_id: data.buyer_id, p_amount: 10,
    p_reason: 'Kauf abgeschlossen',
    p_idempotency_key: `listing_bought_${transaction_id}`,
  })

  await supabase.rpc('send_notification', {
    p_recipient_id: data.buyer_id,
    p_title:        '🏆 Deal abgeschlossen!',
    p_message:      'Bitte bewerte den Verkäufer.',
    p_type:         'tx_completed',
    p_listing_id:   data.listing_id,
  })

  revalidatePath('/')
}
```

### `src/app/actions/escalate.ts` – No-Show Eskalation
```typescript
'use server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath }     from 'next/cache'

export async function reportNoShow(transaction_id: string) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { data, error } = await supabase.rpc('escalate_no_show', {
    p_transaction_id: transaction_id,
    p_seller_id:      user.id,
  })
  if (error || !data?.success) throw new Error(data?.error ?? 'Eskalation fehlgeschlagen')
  revalidatePath('/profile')
  return data
}
```
Hinweis: `escalate_no_show` verlangt Status `confirmed` (nur bestätigte Deals können eskaliert werden).

### `src/components/listing/ContactSection.tsx` – Kontaktdaten NUR via RPC
```typescript
// NIE die transactions-Tabelle direkt für Kontaktdaten lesen.
// Die RPC gibt nur dann Daten zurück, wenn der Aufrufer Käufer oder Verkäufer ist
// UND die Transaktion status = 'confirmed' hat. Sonst: leeres Ergebnis.
async function loadContactData(transactionId: string) {
  const supabase = createServerClient()
  const { data } = await supabase.rpc('get_transaction_contact', {
    p_transaction_id: transactionId,
  })
  // data ist ein Array mit 0 oder 1 Zeile: { buyer_contact, seller_contact, status }
  return data?.[0] ?? null
}
```

### `src/components/listing/DealFlow.tsx`

**Käufer-Seite (status=active):**
- Button „🛒 Kaufen" → Auth-Gate Modal
- Nach Auth: Bottom-Sheet mit Preis-Bestätigung, Zahlungsart (Bar | TWINT),
  Kontakt-Input, Checkbox „Verbindliche Kaufabsicht", Submit → `createBuyIntent()`

**Käufer-Seite (status=reserved, eigene TX):**
- Status-Card „⏳ Wartet auf Verkäufer-Bestätigung"
- Kontaktdaten erscheinen erst nach `confirmed` (via `get_transaction_contact`)

**Verkäufer-Seite:** im Seller Dashboard (Profil).

### `src/components/listing/SellerDashboard.tsx`

Für jede Transaktion mit `status='pending'`:
- Käufer anonym („Kaufinteressent")
- Verkaufspreis + Hinweis: „Kosten: {commission} Taler (10% Provision)"
- Taler-Saldo-Check anzeigen (`credits / 100` vs. Provision)
- ✅ Bestätigen (→ Provisions-Warnung → `confirmSale()`) | ❌ Ablehnen
- Zu wenig Taler → Wallet-Aufladen CTA (Phase 4)

---

## SCHRITT 3 – Gamification

### `src/hooks/useXP.ts`
```typescript
'use client'
import { useEffect, useRef } from 'react'
import { useAppStore }       from '@/store/appStore'

export function useXPWatcher() {
  const user      = useAppStore(s => s.user)
  const prevXP    = useRef(user?.xp_points ?? 0)
  const prevLevel = useRef(user?.level)

  useEffect(() => {
    if (!user) return
    const gained = user.xp_points - prevXP.current
    if (gained > 0) showXPToast(gained)
    if (user.level !== prevLevel.current) showLevelUpModal(user.level)
    prevXP.current    = user.xp_points
    prevLevel.current = user.level
  }, [user?.xp_points, user?.level])
}
```

### Level (identisch mit der Live-RPC `award_xp` – NICHT abweichen)
```typescript
const XP_LEVELS = [
  { name: 'Beobachter',      min: 0,    max: 49       },
  { name: 'Dorf-Händler',    min: 50,   max: 199      },
  { name: 'Lokal-Matador',   min: 200,  max: 499      },
  { name: 'Kantons-Legende', min: 500,  max: 999      },
  { name: 'Gotthard-Titan',  min: 1000, max: Infinity },
]
```

- `XPToast.tsx`: sonner custom toast, Gold-Münze + „+{xp} XP", Progress-Bar, auto-dismiss 3s
- `LevelUpModal.tsx`: Fullscreen, CSS-Konfetti, Level-Badge, „Du bist jetzt [Level]!"
- `LevelBadge.tsx`:
```typescript
const LEVEL_CONFIG = {
  'Beobachter':      { emoji: '👁️', color: 'text-white/60',  border: '' },
  'Dorf-Händler':    { emoji: '🥉', color: 'text-amber-600', border: 'border-amber-700' },
  'Lokal-Matador':   { emoji: '🥈', color: 'text-slate-300', border: 'border-slate-400' },
  'Kantons-Legende': { emoji: '🥇', color: 'text-gold',      border: 'border-gold/60 shadow-gold' },
  'Gotthard-Titan':  { emoji: '💎', color: 'text-cyan-300',  border: 'border-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.4)]' },
}
```

---

## SCHRITT 4 – FOMO System

### `src/components/feed/FomoZone.tsx`
- Titel „👁️ Kürzlich verpasst", horizontale Liste verkaufter Inserate
- Rotes pulsierendes Overlay, Countdown „Noch X Std. sichtbar"
- Query (explizite Spalten):
  ```typescript
  .select('id, title, price, image_url, category, fomo_expires_at')
  .eq('status', 'sold')
  .gt('fomo_expires_at', new Date().toISOString())
  .order('fomo_expires_at', { ascending: true })
  .limit(10)
  ```
- `fomo_expires_at` wird vom DB-Trigger `set_fomo_on_sold` gesetzt – NIE im App-Code setzen.

### `src/components/feed/TikTokScroll.tsx`
- Trigger: `IntersectionObserver` am Feed-Ende
- Container: `overflow-y-scroll snap-y snap-mandatory h-[100dvh]`
- Item: `snap-start h-[100dvh] relative`, Bild `object-cover w-full h-full`
- Gradient-Overlay, Glas-Card unten (Titel, Preis, Verkäufer, Buttons)
- Exit-Button „← Zurück" oben links, immer sichtbar
- Sortierung: Boosts → Neueste → FOMO (24h)

---

## SCHRITT 5 – Gesuch-Formular & Smart Match (Basis, ohne KI)

### `src/components/create/GesuchForm.tsx` – 3 Steps
1. Was suchst du? (Titel-Freitext + Kategorie)
2. Details (Max. Budget CHF optional, Gemeinde, Bis-wann-Datum optional, Beschreibung)
3. Vorschau + Submit

Gesuch-Erstellung analog `createListingAction` mit `type: 'Gesuch'`.
Nach Erstellung: `calculateSmartMatches(gesuchId)` aufrufen.
**Wichtig (BUG 2):** Der `type`-Wert beim Schreiben muss exakt dem Filter des Gesuche-Tabs entsprechen (`'Gesuch'`).

### `src/lib/smartMatch.ts`
```typescript
export async function calculateSmartMatches(gesuchId: string) {
  const supabase = createServerClient()

  const { data: gesuch } = await supabase
    .from('listings')
    .select('id, category, max_budget, gemeinde, title, user_id')
    .eq('id', gesuchId)
    .single()
  if (!gesuch) return

  const { data: offers } = await supabase
    .from('listings')
    .select('id, category, price, gemeinde, title, user_id')
    .eq('type', 'Angebot')
    .eq('status', 'active')
    .eq('category', gesuch.category)
    .neq('user_id', gesuch.user_id)

  for (const offer of offers ?? []) {
    let score = 40 // Kategorie matcht
    if (gesuch.max_budget && offer.price && offer.price <= gesuch.max_budget) score += 30
    if (offer.gemeinde === gesuch.gemeinde) score += 30

    if (score >= 60) {
      // Unique-Constraint (gesuch_id, matched_listing_id) existiert in der Live-DB → upsert erlaubt
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

> ⚠️ Auth-Zustand: Es gibt genau EINE Quelle der Wahrheit für den Login-Status
> (Supabase-Session via `auth.getUser()` server-seitig bzw. der zentrale Store client-seitig).
> Header und Bottom-Navigation MÜSSEN dieselbe Quelle lesen. Kein zweiter, paralleler Auth-Guard.

### `src/components/profile/ProfileDashboard.tsx`
- Header-Block: Avatar + Name + Level-Badge + Sterne
- XP-Balken: „{xp} / {nextLevel} XP"
- Pioneer-Badge (falls vorhanden): Gold-Umrandung „🏆 Pionier der ersten Stunde"
- Stats-Grid (3 Kacheln): Taler-Guthaben (`credits / 100`) · Deals · Aktive Inserate
- Quick-Actions (2×4): 🎯 Smart Matches · 📦 Meine Inserate · 🛒 Meine Käufe · 💰 Meine Verkäufe · 🎫 Meine Tickets (Phase 3) · 📅 Meine Events (Phase 3) · 👛 Wallet (Phase 3/4) · 🎁 Freunde einladen

### `src/components/profile/SmartMatchList.tsx`
- Score als farbiger Ring (grün > 80, gelb 60–80)
- Inserat-Vorschau (Bild, Titel, Preis)
- „Ansehen" → ListingDetail | „Verwerfen" → `dismissed = true`

### `src/components/profile/MyListings.tsx`
- Tabs: Aktiv | Reserviert | Verkauft | Entwürfe
- Reihe: Bild, Titel, Status-Badge, Views, Datum · Aktionen: Bearbeiten (Phase 4) | Löschen

### `src/app/profile/[username]/page.tsx` – Öffentliches Profil
- Zeigt: Avatar, Name, Level, Bewertung, aktive Inserate
- Zeigt NICHT: Telefon, E-Mail, Taler-Guthaben, Transaktionen

---

## SCHRITT 7 – Notifications (In-App)

### `src/hooks/useNotifications.ts`
```typescript
'use client'
import { useEffect }    from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore }  from '@/store/appStore'
import { toast }        from 'sonner'

export function useNotifications(userId: string | undefined) {
  const { addNotification, setNotifications } = useAppStore()
  const supabase = createClient()

  useEffect(() => {
    if (!userId) return

    supabase
      .from('notifications')
      .select('id,title,message,type,is_read,listing_id,created_at')
      .eq('recipient_id', userId)
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => { if (data) setNotifications(data) })

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

Notifications werden serverseitig IMMER via RPC `send_notification` erstellt (umgeht RLS-Insert-Sperre).

### `src/components/layout/NotificationPanel.tsx`
- Slide-in von rechts, Backdrop-Click schliesst
- Header „Benachrichtigungen" + „Alle als gelesen"
- Liste: Icon (nach type) + Titel + Message + Zeit
- Leerer State: „Keine neuen Benachrichtigungen"
- Klick → navigiert zum Inserat

---

## SCHRITT 8 – Bewertungssystem

### `src/components/listing/ReviewModal.tsx`
- Nach abgeschlossener Transaktion: 1–5 Sterne + optionaler Kommentar (max 500 Zeichen)
- Server Action:
```typescript
export async function submitReview(data: ReviewInput) {
  // Zod-Validierung + Auth-Check zuerst
  await supabase.from('reviews').insert({ ...data, reviewer_id: user.id })
  // DB-Trigger update_avg_rating läuft automatisch – NICHT manuell nachrechnen
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
- Kommentarliste (Avatar + Username + Text + Datum)
- Input nur für eingeloggte User
- Zensur VOR dem Speichern via `censorText()` – client-seitig (UX) UND server-seitig (Sicherheit)
- Submit → Insert + `award_xp(+5, 'comment_{id}')`

### `src/lib/censor.ts`
```typescript
const PATTERNS = [
  /(\+41|0041|041)[\s\-]?[\d\s\-]{7,}/g,
  /[\w.+-]+@[\w-]+\.[a-z]{2,}/gi,
  /wa\.me\/\d+/gi,
  /t\.me\/\w+/gi,
  /https?:\/\/\S+/gi,
  /\b0\d{9}\b/g,
]

export function censorText(text: string): string {
  return PATTERNS.reduce((t, p) => t.replace(p, '***'), text)
}
```

---

## SCHRITT 10 – Docs aktualisieren

- `docs/deal-flow.md` → ✅, dokumentiert die 4 Deal-RPCs mit Rückgabeformaten
- `docs/gamification.md` → ✅, XP-Tabelle heisst `xp_log`, Level-Config
- `docs/smart-match.md` → 🔄, Basis-Matching, KI-Upgrade in Phase 3
- `docs/notifications.md` → 🔄, In-App fertig, Push in Phase 3
- `docs/profile.md` → ✅
- `CLAUDE.md` → Phase 2 auf ✅

---

## ABSCHLUSS-CHECKLISTE

```
[ ] npx tsc --noEmit → 0 Errors
[ ] npm run build → 0 Errors
[ ] npm run lint  → 0 Errors
[ ] Grep-Check: kein Vorkommen von "xp_events" im gesamten Repo
[ ] Grep-Check: Deal-Logik NUR via RPCs (kein manuelles insert/update auf transactions ausser Status-Anzeige-Reads)
[ ] Onboarding läuft komplett durch (5 Screens), Bonus-Anzeige = 100 Taler
[ ] Kaufanfrage via create_buy_intent funktioniert (Listing → reserved, Verkäufer benachrichtigt)
[ ] Verkäufer-Bestätigung: Provision atomar abgezogen (CHF 100 → 10 Taler = 1000 Rappen)
[ ] Kontaktdaten NUR via get_transaction_contact sichtbar, NUR nach confirmed
[ ] No-Show: Provision zurück + Strike (nur bei confirmed möglich)
[ ] XP wird vergeben, Level-Up Modal erscheint
[ ] FOMO-Zone zeigt verkaufte Inserate 24h
[ ] TikTok-Scroll funktioniert
[ ] Gesuch erstellen → erscheint im Gesuche-Tab (type='Gesuch' konsistent)
[ ] Smart Match erscheint im Profil
[ ] Notifications in Echtzeit
[ ] Kommentare zensiert (Telefonnummern, Links)
[ ] Grant/RLS-Check nach allen DB-Schritten ausgeführt (D2)
```
