# PHASE 3 – KI + EVENTS + NOTIFICATIONS (v2, korrigiert)
> Kopiere diesen gesamten Text als erste Nachricht an Claude Code.
> Voraussetzung: Phase 2 vollständig abgeschlossen UND alle Punkte unter „SCHRITT -1" erledigt.
> Verifiziert gegen die Live-Datenbank (`lhqsuelguwfdflapzdhk`, EU Paris) am 05.07.2026.
> Phase-Ziel: Claude AI, Event-Tickets, QR-Codes, Push-Notifications, Smart Match mit KI.

---

## GRUNDREGELN (gelten weiterhin, siehe Phase-2-Plan)

1. Taler = `profiles.credits` (bigint, **Rappen**). Anzeige `credits / 100`.
2. XP-Tabelle heisst **`xp_log`** – `xp_events` existiert NICHT.
3. Geld-/Deal-/Buchungslogik NUR über SECURITY-DEFINER-RPCs.
4. `user_id` NIE vom Client.
5. Keine `SELECT *`.
6. **KI-Modellnamen existieren NUR in `src/lib/ai.ts`** – nirgendwo sonst hardcoden.
7. DB-Migrationen via Supabase-MCP im Planungs-Chat (JJ-Bestätigung), danach Grant/RLS-Check (D2).
8. `npx tsc --noEmit` + `npm run build` sauber vor jedem Commit. Kein Push ohne JJ-OK.

---

## SCHRITT -1 – VORBEREITUNG (VOR dem ersten Code – zwingend)

**A) Supabase-Types neu generieren** (behebt den bekannten Drift der 5 manuell ergänzten Event-Spalten):
```
npx supabase gen types typescript --project-id lhqsuelguwfdflapzdhk > src/types/database.ts
```
Danach `npx tsc --noEmit` – muss sauber sein, bevor irgendetwas anderes passiert.

**B) DB-Migration `book_event` einspielen** – läuft über die **Supabase-MCP im Planungs-Chat**, NICHT über Claude Code. Claude Code prüft nur, dass die Funktion existiert:
```sql
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'book_event';
```

Migrations-SQL (Referenz – wird im Planungs-Chat eingespielt):
```sql
-- Atomare Event-Buchung: Kapazitätsprüfung mit Zeilen-Lock, Insert, Zähler-Inkrement.
-- Behebt zwei Fehler des alten Plans: Race-Condition bei der Kapazität und
-- das nie inkrementierte current_bookings.
create or replace function public.book_event(
  p_listing_id uuid,
  p_party_size integer,
  p_qr_code    text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id    uuid := auth.uid();
  v_listing    record;
  v_booking_id uuid;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Nicht angemeldet');
  end if;
  if p_party_size is null or p_party_size < 1 or p_party_size > 20 then
    return jsonb_build_object('success', false, 'error', 'Ungültige Anzahl Plätze');
  end if;

  select id, user_id, max_capacity, current_bookings, commitment_type, title, status, type
    into v_listing
  from public.listings
  where id = p_listing_id
  for update;                       -- Lock gegen parallele Buchungen

  if v_listing.id is null then
    return jsonb_build_object('success', false, 'error', 'Event nicht gefunden');
  end if;
  if v_listing.type <> 'Event' or v_listing.status <> 'active' then
    return jsonb_build_object('success', false, 'error', 'Event nicht buchbar');
  end if;
  if v_listing.commitment_type not in ('waitlist', 'reservation') then
    return jsonb_build_object('success', false, 'error', 'Dieses Event erfordert Ticket oder Anzahlung');
  end if;
  if v_listing.user_id = v_user_id then
    return jsonb_build_object('success', false, 'error', 'Eigenes Event kann nicht gebucht werden');
  end if;
  if coalesce(v_listing.current_bookings, 0) + p_party_size > coalesce(v_listing.max_capacity, 0) then
    return jsonb_build_object('success', false, 'error', 'Nicht genug Plätze verfügbar');
  end if;

  insert into public.event_bookings
    (listing_id, user_id, party_size, quantity, qr_code, commitment_type, status)
  values
    (p_listing_id, v_user_id, p_party_size, p_party_size, p_qr_code, v_listing.commitment_type, 'confirmed')
  returning id into v_booking_id;

  update public.listings
  set current_bookings = coalesce(current_bookings, 0) + p_party_size
  where id = p_listing_id;

  perform public.send_notification(
    v_user_id,
    '✅ Platz reserviert!',
    'Dein Platz für „' || v_listing.title || '" ist gesichert.',
    'system',
    p_listing_id
  );

  return jsonb_build_object('success', true, 'booking_id', v_booking_id);
end;
$$;
```

**C) Env-Variablen prüfen/ergänzen** (`.env.local` + Vercel):
- `ANTHROPIC_API_KEY` (Server-only, KEIN `NEXT_PUBLIC_`)
- `QR_SIGNING_SECRET` (neu, langer Zufallswert, Server-only)
- `NEXT_PUBLIC_VAPID_KEY` + `VAPID_PRIVATE_KEY` (generieren: `npx web-push generate-vapid-keys`)

**D) npm-Pakete** (Claude-Code-Regel: `npm install` mit Taste `1` einzeln bestätigen):
```
npm install @anthropic-ai/sdk qrcode jsqr web-push
npm install -D @types/qrcode
```

---

## SCHRITT 0 – PFLICHTLEKTÜRE

```
1. CLAUDE.md
2. DEVELOPMENT_GUIDELINES.md
3. docs/database-schema.md
4. docs/smart-match.md        (Phase 2 Stand)
5. docs/notifications.md      (Phase 2 Stand)
6. docs/events-tickets.md     (wird diese Phase befüllt)
7. docs/ai-features.md        (wird diese Phase befüllt)
8. docs/wallet.md             (wird diese Phase befüllt)
9. Der korrigierte Phase-2-Plan (RPC-Referenz mit Rückgabeformaten)
```

---

## SCHRITT 1 – Claude AI Integration

### `src/lib/ai.ts` – ZENTRALE Modell-Konstanten (einzige Stelle im Repo!)
```typescript
// Verifizierte, aktuelle Claude-API-Modell-IDs (Stand 07/2026).
// Modellnamen werden AUSSCHLIESSLICH hier gepflegt.
export const CLAUDE_MODEL      = 'claude-sonnet-4-6'   // Qualität (Text-Booster)
export const CLAUDE_MODEL_FAST = 'claude-haiku-4-5'    // Günstig/schnell (Batch-Scoring)
```

### `src/lib/claude-ai.ts`
```typescript
import Anthropic from '@anthropic-ai/sdk'
import { CLAUDE_MODEL } from '@/lib/ai'

// Singleton (kein Client pro Request)
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export const claudeAI = {
  // Text-Booster: Stichworte → Verkaufstext
  async boostText(keywords: string, category: string): Promise<string> {
    const message = await client.messages.create({
      model:      CLAUDE_MODEL,
      max_tokens: 400,
      messages: [{
        role: 'user',
        content: `Erstelle einen überzeugenden Verkaufstext für einen lokalen Schweizer Marktplatz (Kanton Uri).

Kategorie: ${category}
Stichworte des Verkäufers: ${keywords}

Regeln:
- Exakt 80-120 Wörter
- Hochdeutsch mit Schweizer Charme (natürlich, freundlich, direkt)
- FOMO-Elemente ohne Lügen ("nur kurz verfügbar", "einmalige Gelegenheit")
- Konkrete Vorteile nennen (Zustand, Besonderheiten)
- Abschluss-Satz mit Handlungsaufforderung
- KEINE Klammern, KEINE Aufzählungspunkte – Fliesstext

Antworte NUR mit dem fertigen Text.`,
      }],
    })
    const block = message.content.find(b => b.type === 'text')
    if (!block || block.type !== 'text') throw new Error('KI-Fehler')
    return block.text.trim()
  },
}
```
Hinweis: `message.content` kann mehrere Blöcke enthalten → immer per `find(b => b.type === 'text')` den Text-Block suchen, nie blind `content[0]`.

### `src/app/api/ai/boost-text/route.ts`
```typescript
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse }       from 'next/server'
import { claudeAI }           from '@/lib/claude-ai'
import { z }                  from 'zod'

const Schema = z.object({
  keywords: z.string().min(3).max(500),
  category: z.string().min(1),
})

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    // Rate-Limit 10/Tag über xp_log (verifiziert: SELECT-eigene-Zeilen-Policy existiert,
    // und award_xp schreibt auch bei amount=0 eine Log-Zeile)
    const today = new Date().toISOString().split('T')[0]
    const { count } = await supabase
      .from('xp_log')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('reason', 'ai_boost_used')
      .gte('created_at', today)
    if ((count ?? 0) >= 10)
      return NextResponse.json({ error: 'Tageslimit erreicht (10/Tag)' }, { status: 429 })

    const body = await request.json()
    const { keywords, category } = Schema.parse(body)

    const text = await claudeAI.boostText(keywords, category)

    // Nutzung loggen (0 XP, eindeutiger idempotency_key pro Aufruf)
    await supabase.rpc('award_xp', {
      p_user_id: user.id, p_amount: 0,
      p_reason: 'ai_boost_used',
      p_idempotency_key: `ai_boost_${user.id}_${Date.now()}`,
    })

    return NextResponse.json({ text })
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
    console.error('[ai/boost-text]', error)
    return NextResponse.json({ error: 'KI momentan nicht verfügbar' }, { status: 500 })
  }
}
```

### `src/app/api/ai/smart-match/route.ts`
```typescript
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse }       from 'next/server'
import { z }                  from 'zod'

const Schema = z.object({ gesuch_id: z.string().uuid() })

export async function POST(request: Request) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { gesuch_id } = Schema.parse(await request.json())

  // Edge Function asynchron anstossen (kein Request-Timeout im App-Server)
  await supabase.functions.invoke('calculate-smart-matches', {
    body: { gesuch_id, use_ai: true },
  })

  return NextResponse.json({ status: 'processing' })
}
```

### `supabase/functions/calculate-smart-matches/index.ts`
```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2'
import Anthropic        from 'npm:@anthropic-ai/sdk'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)
const claude = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

// Zentrale Modell-Policy: identisch mit src/lib/ai.ts (CLAUDE_MODEL_FAST).
// Deno kann nicht aus src/ importieren → per Env überschreibbar, Fallback = gleicher Wert.
const MODEL_FAST = Deno.env.get('CLAUDE_MODEL_FAST') ?? 'claude-haiku-4-5'

Deno.serve(async (req) => {
  const { gesuch_id, use_ai } = await req.json()

  const { data: gesuch } = await supabase
    .from('listings')
    .select('id,title,description,category,max_budget,gemeinde,user_id')
    .eq('id', gesuch_id).single()
  if (!gesuch) return new Response('Not found', { status: 404 })

  const { data: offers } = await supabase
    .from('listings')
    .select('id,title,description,price,gemeinde,user_id')
    .eq('type', 'Angebot').eq('status', 'active')
    .eq('category', gesuch.category)
    .neq('user_id', gesuch.user_id)
    .limit(20)

  for (const offer of offers ?? []) {
    let score = 40 // Basis: Kategorie matcht

    if (use_ai) {
      const gesuchText  = `${gesuch.title} ${gesuch.description ?? ''}`
      const angebotText = `${offer.title} ${offer.description ?? ''}`
      const aiScore     = await scoreWithAI(gesuchText, angebotText)
      score = Math.round((score + aiScore) / 2)
    }

    if (gesuch.max_budget && offer.price && offer.price <= gesuch.max_budget) score += 20
    if (offer.gemeinde === gesuch.gemeinde) score += 15
    score = Math.min(score, 100)

    if (score >= 55) {
      // Unique-Constraint (gesuch_id, matched_listing_id) existiert in der Live-DB
      await supabase.from('smart_matches').upsert({
        gesuch_id, matched_listing_id: offer.id,
        user_id: gesuch.user_id, score,
      }, { onConflict: 'gesuch_id,matched_listing_id' })

      if (score >= 70) {
        await supabase.rpc('send_notification', {
          p_recipient_id: gesuch.user_id,
          p_title:        '🎯 Neuer Match gefunden!',
          p_message:      `"${offer.title}" passt zu deinem Gesuch.`,
          p_type:         'match',
          p_listing_id:   offer.id,
        })
      }
    }
  }

  return new Response('OK')
})

async function scoreWithAI(gesuch: string, angebot: string): Promise<number> {
  const msg = await claude.messages.create({
    model: MODEL_FAST,
    max_tokens: 5,
    messages: [{
      role: 'user',
      content: `Rate match 0-100. Gesuch: ${gesuch.slice(0, 200)} Angebot: ${angebot.slice(0, 200)}. Nur Zahl.`,
    }],
  })
  const block = msg.content.find(b => b.type === 'text')
  if (!block || block.type !== 'text') return 0
  const n = parseInt(block.text.trim(), 10)
  return Number.isNaN(n) ? 0 : Math.min(100, Math.max(0, n))
}
```

### `src/components/create/AIBooster.tsx`
- „✨ KI-Text-Booster" im AngebotForm (Step 2)
- Textarea für Stichworte, Button „Generieren" (Gold-Spinner)
- Ergebnis erscheint Char-by-Char in der Description-Textarea, Regenerieren-Button
- Fehler: „KI momentan nicht verfügbar. Bitte manuell eingeben."

---

## SCHRITT 2 – Voice-to-Text

### `src/components/create/VoiceInput.tsx`
```typescript
'use client'
import { useState, useRef, useCallback } from 'react'

interface Props {
  onTranscript: (text: string) => void
  className?:   string
}

export function VoiceInput({ onTranscript, className }: Props) {
  const [isListening, setIsListening] = useState(false)
  const [isSupported] = useState(
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  )
  const recognitionRef = useRef<SpeechRecognition | null>(null)

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) return

    const rec          = new SR()
    rec.lang           = 'de-CH'
    rec.continuous     = false
    rec.interimResults = false

    rec.onresult = (e) => {
      onTranscript(e.results[0][0].transcript)
      setIsListening(false)
    }
    rec.onerror = () => setIsListening(false)
    rec.onend   = () => setIsListening(false)

    recognitionRef.current = rec
    rec.start()
    setIsListening(true)
  }, [onTranscript])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }, [])

  if (!isSupported) return null

  return (
    <button
      type="button"
      onClick={isListening ? stopListening : startListening}
      className={className}
      aria-label={isListening ? 'Aufnahme stoppen' : 'Spracheingabe starten'}
    >
      {isListening ? '⏹ Stopp' : '🎙 Diktieren'}
      {isListening && <span className="ml-2 inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
    </button>
  )
}
```

---

## SCHRITT 3 – Event System

### `src/lib/validations/event.ts`
```typescript
import { z } from 'zod'

export const EventSchema = z.object({
  title:           z.string().min(3).max(100),
  description:     z.string().max(2000).optional(),
  gemeinde:        z.string().min(1),
  event_date:      z.string().datetime(),
  event_location:  z.string().min(3).max(200),
  max_capacity:    z.number().int().positive(),
  commitment_type: z.enum(['waitlist', 'reservation', 'deposit', 'ticket']),
  ticket_price:    z.number().min(0).optional(),
  deposit_amount:  z.number().min(0).optional(),
  is_blurred:      z.boolean().default(false),
  image_url:       z.string().url().optional(),
}).refine(
  d => d.commitment_type !== 'ticket' || (d.ticket_price !== undefined && d.ticket_price > 0),
  { message: 'Ticketpreis erforderlich', path: ['ticket_price'] }
).refine(
  d => d.commitment_type !== 'deposit' || (d.deposit_amount !== undefined && d.deposit_amount > 0),
  { message: 'Anzahlungsbetrag erforderlich', path: ['deposit_amount'] }
)
```
Beim Insert setzt der Server: `type: 'Event'`, `category: 'events'`, `user_id` aus der Session.
(Konsistenz mit dem Feed-Filter und dem Phase-4-Index `WHERE type = 'Event'`.)

### `src/components/create/EventForm.tsx` – 4-Step Trichter

**Step 1 – Event-Art** (6 Optionen, setzen den vorselektierten `commitment_type`):
🍖 Grillfest → `reservation` · 🎟️ Konzert/Party → `ticket` · 📚 Kurs/Workshop → `deposit` · 💼 Jobausschreibung → `waitlist` · 🏢 Firmenevent → `ticket` · 📅 Vereinsanlass → `reservation`

**Step 2 – Grunddaten:** Titel, Datum+Uhrzeit (`datetime-local`), Ort, Max. Kapazität (required, Warnung wenn < 5), Bild-Upload (optional), Blur-Toggle „Als Teaser veröffentlichen"

**Step 3 – Verbindlichkeit:** 4 Radio-Options mit Beschreibung und Preis-Input
(📋 Info-Liste kostenlos · 🪑 Platzreservation · 💰 Anzahlung CHF · 🎫 Vollticket CHF)

**Step 4 – Optionen & Veröffentlichen:** Countdown aktivieren, Vorschau, Submit

### `src/components/events/EventCard.tsx`
- Countdown live via `useInterval`: „Noch 14 Tage 6 Std."
- Kapazitäts-Bar: `{current_bookings}/{max_capacity} Plätze`
- Commitment-Badge (Icon je nach Typ)
- Bei `is_blurred`: `filter: blur(8px)` + Overlay „Teaser – Details folgen"

---

## SCHRITT 4 – Ticket System & QR-Codes

### `src/lib/qr.ts`
```typescript
import { createHmac, randomUUID } from 'crypto'

// Kein unsicherer Fallback-Secret – Fehler ist besser als fälschbare Tickets.
function getSecret(): string {
  const s = process.env.QR_SIGNING_SECRET
  if (!s) throw new Error('QR_SIGNING_SECRET fehlt in der Umgebung')
  return s
}

// Neues, signiertes QR-Payload erzeugen (zufällig, nicht erratbar)
export function generateQRCode(): string {
  const payload = randomUUID()
  const hmac = createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, 16)
  return `URI-MARKT-${payload}-${hmac}`
}

export function validateQRCode(qrCode: string): { valid: boolean; payload?: string } {
  const parts = qrCode.split('-')
  if (parts.length < 4 || parts[0] !== 'URI' || parts[1] !== 'MARKT') return { valid: false }

  const payload  = parts.slice(2, -1).join('-')   // UUID enthält selbst Bindestriche
  const hmac     = parts[parts.length - 1]
  const expected = createHmac('sha256', getSecret()).update(payload).digest('hex').slice(0, 16)

  return { valid: hmac === expected, payload }
}
```

### `src/app/actions/events.ts` – kostenlose Buchung NUR via RPC
```typescript
'use server'
import { createServerClient } from '@/lib/supabase/server'
import { generateQRCode }     from '@/lib/qr'
import { revalidatePath }     from 'next/cache'

// waitlist / reservation. Kapazität, Zähler und Notification macht die RPC atomar.
export async function bookEvent(listingId: string, partySize: number) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const qrCode = generateQRCode()

  const { data, error } = await supabase.rpc('book_event', {
    p_listing_id: listingId,
    p_party_size: partySize,
    p_qr_code:    qrCode,
  })
  if (error || !data?.success) throw new Error(data?.error ?? 'Buchung fehlgeschlagen')

  revalidatePath('/profile')
  return { booking_id: data.booking_id as string, qr_code: qrCode }
}
```

### `src/app/api/qr/validate/route.ts`
```typescript
import { createServerClient } from '@/lib/supabase/server'
import { NextResponse }       from 'next/server'
import { validateQRCode }     from '@/lib/qr'
import { z }                  from 'zod'

const Schema = z.object({ qr_code: z.string().min(10).max(200) })

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const { qr_code } = Schema.parse(await request.json())
    const { valid } = validateQRCode(qr_code)
    if (!valid) return NextResponse.json({ valid: false, error: 'Ungültiger QR-Code' })

    // Booking + Event laden (RLS: sichtbar für Ticketinhaber ODER Veranstalter)
    const { data: booking } = await supabase
      .from('event_bookings')
      .select('id,status,qr_validated_at,user_id,listing_id,quantity,listings!listing_id(title,user_id)')
      .eq('qr_code', qr_code)
      .single()

    if (!booking) return NextResponse.json({ valid: false, error: 'Ticket nicht gefunden' })

    // Nur der VERANSTALTER darf entwerten (RLS erzwingt das beim UPDATE zusätzlich)
    if (booking.listings?.user_id !== user.id)
      return NextResponse.json({ valid: false, error: 'Nur der Veranstalter kann Tickets entwerten' }, { status: 403 })

    if (booking.status === 'used')
      return NextResponse.json({ valid: false, error: '❌ Ticket bereits verwendet', booking })
    if (booking.status === 'cancelled')
      return NextResponse.json({ valid: false, error: '❌ Ticket storniert' })

    const { data: updated } = await supabase
      .from('event_bookings')
      .update({ status: 'used', qr_validated_at: new Date().toISOString() })
      .eq('id', booking.id)
      .eq('status', 'confirmed')     // Schutz gegen Doppel-Scan (Race)
      .select('id')

    if (!updated || updated.length === 0)
      return NextResponse.json({ valid: false, error: '❌ Ticket bereits verwendet' })

    return NextResponse.json({ valid: true, booking })
  } catch (error) {
    console.error('[qr/validate]', error)
    return NextResponse.json({ error: 'Server-Fehler' }, { status: 500 })
  }
}
```

### `src/components/events/QRTicket.tsx`
```typescript
import QRCode from 'qrcode'

useEffect(() => {
  if (!canvasRef.current) return
  QRCode.toCanvas(canvasRef.current, ticket.qr_code, {
    width: 200, color: { dark: '#000000', light: '#FFD700' },
  })
}, [ticket.qr_code])
```
- Gold-schwarzer QR-Code, Booking-Info (Event-Titel, Datum, Plätze), Status-Badge

### `src/components/events/QRScanner.tsx`
- `jsqr` + Camera API (`getUserMedia`), nur für Veranstalter im Orga-Dashboard
- Grüner Rahmen bei gültigem Ticket, ruft `/api/qr/validate` auf
- Sofort-Feedback: ✅ Gültig oder ❌ Ungültig – [Grund]

### `src/components/events/OrgaDashboard.tsx`
- Kapazitäts-Doughnut (CSS-only, kein Chart.js)
- Echtzeit-Gästeliste (Supabase Realtime auf `event_bookings`)
- Tabs: Alle | Bestätigt | Warteliste · QR-Scanner-Button
- „News senden" → alle Angemeldeten via `send_notification` benachrichtigen

---

## SCHRITT 5 – Push Notifications

### `public/sw.js`
```javascript
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Uri-Markt', {
      body:  data.message,
      icon:  '/icon-192.png',
      badge: '/badge-72.png',
      data:  { url: data.url ?? '/' },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(clients.openWindow(event.notification.data.url))
})
```

### `src/lib/notifications.ts`
```typescript
export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return null

  const reg  = await navigator.serviceWorker.register('/sw.js')
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return null

  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_KEY!),
  })
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const base64s = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64s)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}
```
Subscription in `profiles.push_subscription` (jsonb) speichern – nur wenn `push_notifications = true`.

### `supabase/functions/send-push-notification/index.ts`
```typescript
import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush          from 'npm:web-push'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Trigger: Supabase Database Webhook auf INSERT in notifications
Deno.serve(async (req) => {
  const { record } = await req.json()

  const { data: profile } = await supabase
    .from('profiles')
    .select('push_subscription, push_notifications')
    .eq('id', record.recipient_id)
    .single()

  if (!profile?.push_subscription || profile.push_notifications === false)
    return new Response('No subscription')

  webpush.setVapidDetails(
    'mailto:info@uri-markt.ch',
    Deno.env.get('VAPID_PUBLIC_KEY')!,
    Deno.env.get('VAPID_PRIVATE_KEY')!,
  )

  await webpush.sendNotification(
    profile.push_subscription,
    JSON.stringify({ title: record.title, message: record.message })
  )

  return new Response('Sent')
})
```

---

## SCHRITT 6 – Wallet (Anzeige, ohne echte Zahlung – Stripe kommt in Phase 4)

### `src/app/wallet/page.tsx` (Protected Route)
```typescript
const { data: walletTx } = await supabase
  .from('wallet_transactions')
  .select('id,amount,type,description,created_at')
  .eq('user_id', user.id)
  .order('created_at', { ascending: false })
  .limit(50)
```
Hinweis: `wallet_transactions.amount` ist **bigint in Rappen** (positiv = Eingang, negativ = Abzug).
Es gibt bewusst KEINE Insert-Policy für User – Einträge entstehen nur über RPCs/Service-Role.

### `src/components/wallet/WalletCard.tsx`
- Grosse Taler-Anzeige: `{(credits / 100).toFixed(2)} Taler` in `font-display text-5xl text-gold`
- Umrechnung klein darunter: `= CHF {(credits / 100).toFixed(2)}`
- Einzahlen-Button (Phase 4: Stripe; jetzt: Hinweis „Bald verfügbar")

### `src/components/wallet/TransactionHistory.tsx`
- Grün = positiv, Rot = negativ · Betrag: `{amount > 0 ? '+' : ''}{(amount / 100).toFixed(2)} T`
- Icon nach `type`: purchase 💳 · commission 📊 · boost ⚡ · referral_bonus 🎁 · refund ↩️
- Datum `dd.MM.yyyy HH:mm`

---

## SCHRITT 7 – Referral System

### `src/components/profile/ReferralCard.tsx`
- Eigener Code gross: `URI-XXXXXX` (aus `profiles.referral_code`)
- „Link kopieren" → `navigator.clipboard.writeText(url)`, Teilen via Web Share API
- „+10 Taler für dich und deinen Freund nach dessen erstem Inserat" (10 Taler = 1000 Rappen)
- Einladungszähler:
```typescript
const { count } = await supabase
  .from('profiles')
  .select('id', { count: 'exact', head: true })
  .eq('referred_by', userId)
```

### Referral-URL-Handling (`src/app/page.tsx`)
- URL `?ref=URI-XXXXXX` → im Auth-Modal Code vorbefüllen
- Bei Registrierung `referred_by` in `profiles` speichern (serverseitig aufgelöst)

---

## SCHRITT 8 – Docs aktualisieren

- `docs/events-tickets.md` → ✅ (inkl. `book_event`-RPC und QR-Format)
- `docs/ai-features.md` → ✅ (zentrale Modell-Konstanten dokumentieren)
- `docs/notifications.md` → ✅ (Push + In-App; E-Mail folgt Phase 4)
- `docs/wallet.md` → 🔄 (Anzeige fertig, Stripe Phase 4)
- `docs/smart-match.md` → ✅ (KI-Upgrade)
- `docs/database-schema.md` → `book_event` in RPC-Liste ergänzen
- `CLAUDE.md` → Phase 3 auf ✅

---

## ABSCHLUSS-CHECKLISTE

```
[ ] Supabase-Types frisch generiert, npx tsc --noEmit → 0 Errors
[ ] Migration book_event eingespielt (via Supabase-MCP) + Grant/RLS-Check (D2)
[ ] Grep-Check: "xp_events" kommt im Repo NICHT vor
[ ] Grep-Check: Modellnamen NUR in src/lib/ai.ts (+ Edge-Function-Fallback)
[ ] npm run build → 0 Errors · npm run lint → 0 Errors
[ ] KI-Text-Booster generiert echten Text (API-Test)
[ ] Rate-Limit 10/Tag greift (11. Anfrage → 429)
[ ] Voice-to-Text funktioniert im Browser
[ ] Event erstellen (alle 4 commitment_types) funktioniert, type='Event'
[ ] Event-Karte: Countdown + Kapazitäts-Bar korrekt
[ ] Kostenlose Buchung: current_bookings erhöht sich, Kapazitätslimit greift
[ ] QR-Ticket wird generiert und angezeigt
[ ] QR-Validierung: nur Veranstalter kann entwerten; Doppel-Scan wird abgelehnt
[ ] QR-Scanner öffnet Kamera und scannt
[ ] OrgaDashboard: Echtzeit-Gästeliste
[ ] Smart Match mit KI liefert Scores, Notification ab Score 70
[ ] Push-Benachrichtigung kommt an (Browser-Test)
[ ] Wallet zeigt Guthaben (credits/100) und Verlauf korrekt
[ ] Referral-Code kopieren/teilen funktioniert
[ ] QR_SIGNING_SECRET + VAPID-Keys in .env.local UND Vercel gesetzt
[ ] Alle /docs/*.md aktualisiert
```
