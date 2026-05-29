# DEVELOPMENT_GUIDELINES.md
> Pflichtlektüre vor jeder Arbeitssitzung. Enthält alle verbindlichen Konventionen.

---

## 1. CODE-STIL & KONVENTIONEN

### TypeScript
```typescript
// ✅ Immer explizite Typen bei Funktions-Signaturen
async function createListing(data: AngebotFormData): Promise<Listing> {}

// ✅ Zod-Schema für alle externen Inputs
const schema = z.object({ title: z.string().min(3) })

// ❌ Kein `any`
const data: any = {} // VERBOTEN

// ❌ Kein non-null assertion ohne Kommentar
const user = getUser()! // VERBOTEN ohne: // sicher weil: [Begründung]
```

### Dateinamen
```
Komponenten:        PascalCase     → ListingCard.tsx
Hooks:              camelCase      → useListings.ts
Utilities:          camelCase      → formatPrice.ts
API Routes:         kebab-case     → /api/ai/boost-text/route.ts
Docs:               kebab-case     → docs/deal-flow.md
```

### Komponenten-Struktur (Reihenfolge)
```typescript
// 1. Imports (externe → interne → typen)
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { Listing } from '@/types'

// 2. Typen/Interfaces der Komponente
interface Props { listing: Listing }

// 3. Komponente (immer named export, kein default für Komponenten)
export function ListingCard({ listing }: Props) {
  // 3a. State
  const [isLoading, setIsLoading] = useState(false)
  
  // 3b. Hooks
  const { user } = useAuth()
  
  // 3c. Derived State / Computed
  const formattedPrice = formatPrice(listing.price)
  
  // 3d. Effects
  useEffect(() => {}, [])
  
  // 3e. Handler-Funktionen
  const handleClick = async () => {}
  
  // 3f. Early returns (Loading, Error, Empty)
  if (!listing) return null
  
  // 3g. JSX
  return <div>...</div>
}
```

### Imports – absolute Pfade immer
```typescript
// ✅ Absolut
import { Button } from '@/components/ui/button'

// ❌ Relativ (ausser in der gleichen Ordner-Ebene)
import { Button } from '../../../components/ui/button'
```

---

## 2. SUPABASE PATTERNS

### Supabase Client-Auswahl
```typescript
// Browser (Client Components, Hooks):
import { createBrowserClient } from '@/lib/supabase/client'
const supabase = createBrowserClient()

// Server (Server Components, API Routes, Server Actions):
import { createServerClient } from '@/lib/supabase/server'
const supabase = createServerClient()

// NIEMALS Service Role Key im Browser verwenden!
```

### Authentifizierung – IMMER serverseitig prüfen
```typescript
// ✅ Server Action / API Route
const { data: { user }, error } = await supabase.auth.getUser()
if (!user || error) {
  return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })
}
// user.id ist jetzt sicher verwendbar

// ❌ NIEMALS:
const userId = req.headers.get('x-user-id') // Kann gefälscht werden!
```

### Queries – Immer mit Fehlerbehandlung
```typescript
// ✅ Vollständige Fehlerbehandlung
const { data, error, count } = await supabase
  .from('listings')
  .select('*, profiles(username, avatar_url)', { count: 'exact' })
  .eq('status', 'active')
  .order('created_at', { ascending: false })
  .range(0, 19) // Immer limitieren!

if (error) {
  console.error('[listings:fetch]', error)
  throw new Error('Inserate konnten nicht geladen werden')
}

// ✅ Cursor-Pagination statt OFFSET
.gt('created_at', cursor) // Statt .range(offset, offset + 19)
```

### RPC-Funktionen für Mutationen
```typescript
// Taler-Abzug (EINZIGER RICHTIGER WEG):
const { data, error } = await supabase.rpc('process_transaction_commission', {
  p_transaction_id: txId,
  p_seller_id: user.id
})

if (error || !data.success) {
  throw new Error(data?.error ?? 'Provision konnte nicht abgezogen werden')
}
```

### Realtime – Immer aufräumen
```typescript
useEffect(() => {
  const channel = supabase.channel(`notifications:${userId}`)
    .on('postgres_changes', { 
      event: 'INSERT', schema: 'public', table: 'notifications',
      filter: `recipient_id=eq.${userId}`
    }, handleNewNotification)
    .subscribe()

  return () => { supabase.removeChannel(channel) } // PFLICHT
}, [userId])
```

---

## 3. NEXT.JS PATTERNS

### Server vs. Client Components
```typescript
// Server Component (default, kein 'use client'):
// ✅ Für: Daten laden, Auth prüfen, SEO-relevante Inhalte
// ✅ Fetch direkt in der Komponente
// ❌ Kein useState, useEffect, Event Listener

// Client Component ('use client' oben):
// ✅ Für: Interaktivität, State, Browser-APIs
// ❌ Kein direkter DB-Zugriff ohne Server Action
```

### API Routes – Struktur
```typescript
// app/api/[feature]/route.ts
export async function POST(request: Request) {
  try {
    // 1. Auth prüfen
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    
    // 2. Input validieren
    const body = await request.json()
    const validated = Schema.safeParse(body)
    if (!validated.success) {
      return NextResponse.json({ error: validated.error.flatten() }, { status: 400 })
    }
    
    // 3. Logik ausführen
    // ...
    
    // 4. Erfolg
    return NextResponse.json({ success: true, data: result })
    
  } catch (error) {
    console.error('[api/feature]', error)
    return NextResponse.json({ error: 'Interner Fehler' }, { status: 500 })
  }
}
```

### Server Actions
```typescript
'use server'
import { revalidatePath } from 'next/cache'

export async function deleteListingAction(listingId: string) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  
  // RLS schützt auch hier – Supabase prüft user_id automatisch
  const { error } = await supabase
    .from('listings')
    .delete()
    .eq('id', listingId)
  
  if (error) throw new Error('Löschen fehlgeschlagen')
  
  revalidatePath('/') // Cache nach Mutation invalidieren
}
```

---

## 4. SICHERHEITSREGELN (NICHT VERHANDELBAR)

### Regel 1: user_id immer vom Server
```typescript
// ❌ VERBOTEN – Client kann beliebige user_id senden
const { user_id } = await request.json()
await supabase.from('listings').insert({ user_id, ... })

// ✅ RICHTIG
const { data: { user } } = await supabase.auth.getUser()
await supabase.from('listings').insert({ user_id: user.id, ... })
```

### Regel 2: Kontaktdaten nur nach verifizierter Transaktion
```typescript
// ❌ VERBOTEN – CSS/JS Verstecken ist kein Schutz
<div style={{ display: isConfirmed ? 'block' : 'none' }}>
  {contact} // Jeder sieht es im HTML!
</div>

// ✅ RICHTIG – Daten kommen gar nicht erst vom Server
// RLS Policy auf transactions:
// FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid())
// AND status = 'confirmed'
// → Nicht-Beteiligte sehen buyer_contact/seller_contact gar nicht
```

### Regel 3: Keine API-Keys im Frontend
```typescript
// ❌ VERBOTEN
const STRIPE_KEY = 'sk_live_...' // In Client Component!

// ✅ RICHTIG
// STRIPE_SECRET_KEY nur in .env.local ohne NEXT_PUBLIC_ prefix
// Nur in API Routes / Server Actions verwenden
```

### Regel 4: Input-Sanitierung
```typescript
// Alle User-Inputs durch Zod validieren BEVOR DB-Zugriff
// Kommentare: Zensur-Filter auf Server laufen lassen

// lib/censor.ts
const FORBIDDEN_PATTERNS = [
  /(\+41|0041|041)[\s\-]?[\d\s\-]{7,}/g, // Schweizer Tel.
  /[\w.-]+@[\w.-]+\.\w{2,}/g,             // E-Mail
  /wa\.me\/\d+/gi,                          // WhatsApp Links
  /t\.me\/\w+/gi,                           // Telegram Links
  /https?:\/\/[^\s]+/gi,                    // Alle URLs
]

export function censorText(text: string): string {
  return FORBIDDEN_PATTERNS.reduce(
    (t, pattern) => t.replace(pattern, '***'),
    text
  )
}
```

### Regel 5: Stripe Webhook Signatur
```typescript
// app/api/stripe/webhook/route.ts
export async function POST(request: Request) {
  const body = await request.text() // WICHTIG: text(), nicht json()!
  const signature = request.headers.get('stripe-signature')!
  
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body, signature, process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }
  // Erst NACH Verifikation verarbeiten
}
```

---

## 5. FEHLERBEHANDLUNG

### Toast-System (einheitlich)
```typescript
// Immer diese Funktion für User-Feedback:
import { toast } from 'sonner' // shadcn/ui kompatibel

// Erfolg
toast.success('Inserat erstellt! 🎉')

// Fehler (niemals technische Details zeigen)
toast.error('Etwas ist schiefgelaufen. Bitte nochmals versuchen.')

// Info
toast.info('Noch 3 Pionier-Plätze verfügbar!')

// Warnung
toast.warning('Nicht genug Uri-Taler. Bitte aufladen.')
```

### Loading States
```typescript
// IMMER optimistische Updates für bessere UX:
const [isPending, startTransition] = useTransition()

// Oder mit useOptimistic() für Feed-Mutations:
const [optimisticListings, addOptimistic] = useOptimistic(listings)
```

---

## 6. DESIGN SYSTEM

### Farben (Tailwind)
```
Gold:        text-yellow-400 / bg-yellow-400     (#FFD700)
Glas:        bg-white/5 border border-white/10   (Glassmorphism)
Dunkel:      bg-black / bg-zinc-950 / bg-zinc-900
Erfolg:      text-emerald-400
Fehler:      text-red-400
FOMO-Rot:    text-red-500 animate-pulse
```

### Glassmorphism Card (immer diese Klassen)
```tsx
<div className="bg-white/5 border border-white/10 rounded-2xl 
                backdrop-blur-xl p-4">
```

### Gold-Button (Primary CTA)
```tsx
<button className="bg-yellow-400 text-black font-bold px-6 py-3 
                   rounded-xl hover:bg-yellow-300 active:scale-95 
                   transition-all">
```

### Animationen
```tsx
// FOMO-Puls (für verkaufte Inserate, rote Dots)
className="animate-pulse text-red-500"

// Level-Up (für XP-Toast)
className="animate-bounce text-yellow-400"

// Smooth transition überall
className="transition-all duration-200"
```

---

## 7. DOKUMENTATIONS-WORKFLOW

### Neues Feature anlegen:
```bash
# 1. Neue Datei in /docs erstellen
touch docs/[feature-name].md

# 2. Template ausfüllen (siehe unten)

# 3. In CLAUDE.md Tabelle eintragen
```

### Docs-Template für jedes Feature:
```markdown
# [Feature Name]
> Status: ⏳ Ausstehend / 🔄 In Arbeit / ✅ Fertig
> Zuletzt aktualisiert: [Datum]
> Abhängigkeiten: [andere Features]

## Übersicht
[Was macht dieses Feature?]

## Dateien
- `components/[name]/` – UI-Komponenten
- `app/api/[name]/` – API Routes
- `hooks/use[Name].ts` – Hook
- `docs/[name].md` – Diese Datei

## Datenbank
[Welche Tabellen/RPCs werden verwendet?]

## Sicherheit
[Welche RLS-Policies schützen dieses Feature?]

## Bekannte Einschränkungen / TODOs
- [ ] [Todo 1]
```

---

## 8. GIT COMMIT KONVENTIONEN

```
feat: neues Feature hinzugefügt
fix: Bug behoben
docs: Dokumentation aktualisiert
refactor: Code umstrukturiert ohne Funktionsänderung
style: Styling-Änderungen
test: Tests hinzugefügt
chore: Build/Config Änderungen

Beispiele:
feat: Deal-Flow Kaufen-Button implementiert
fix: RLS Policy für Kontaktdaten korrigiert
docs: docs/deal-flow.md aktualisiert
```
