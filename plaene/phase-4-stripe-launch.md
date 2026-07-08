# PHASE 4 – STRIPE + DSGVO + PWA + LAUNCH (v2, korrigiert)
> Kopiere diesen gesamten Text als erste Nachricht an Claude Code.
> Voraussetzung: Phase 3 vollständig abgeschlossen UND alle Punkte unter „SCHRITT -1" erledigt.
> Verifiziert gegen die Live-Datenbank (`lhqsuelguwfdflapzdhk`, **EU Paris**) am 05.07.2026.
> Phase-Ziel: Echte Zahlungen, DSGVO-Compliance, PWA, Admin, Launch-Ready.

---

## GRUNDREGELN (gelten weiterhin, siehe Phase-2-Plan)

1. Taler = `profiles.credits` (bigint, **Rappen**). 1 Taler = 1 CHF = 100 credits.
2. XP-Tabelle heisst **`xp_log`**.
3. **Jede Guthaben-Änderung läuft über eine SECURITY-DEFINER-RPC.** NIE Read-then-Write auf `credits` im App-Code (nicht atomar, ausnutzbar). Für User gibt es KEINE Insert-Policy auf `wallet_transactions` – direkte Inserts schlagen fehl; das ist Absicht.
4. `user_id` NIE vom Client.
5. DB-Migrationen via Supabase-MCP im Planungs-Chat (JJ-Bestätigung), danach Grant/RLS-Check (D2).
6. `npx tsc --noEmit` + `npm run build` sauber vor jedem Commit. Kein Push ohne JJ-OK.

**Stripe-Regeln (aus dem Stripe-Skill, IMMER gültig):**
- Restricted API Key (`rk_` Prefix) verwenden, NIEMALS `sk_` Secret Key
- `payment_method_types` NIEMALS in einem API-Call angeben (dynamische Zahlungsmethoden via Dashboard; TWINT dort aktivieren)
- Checkout Sessions für alle Einmalzahlungen
- API-Version: `2026-05-27.dahlia`
- Webhooks IMMER mit `stripe.webhooks.constructEvent()` verifizieren (Body als `text()`, nie `json()`)

---

## SCHRITT -1 – VORBEREITUNG: DB-Migrationen (via Supabase-MCP, VOR dem Code)

Diese vier Migrationen werden im Planungs-Chat eingespielt. Claude Code prüft nur ihre Existenz:
```sql
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN ('credit_taler', 'purchase_boost', 'confirm_ticket_booking', 'get_admin_stats');
```
Hinweis: `profiles.is_admin` existiert bereits in der Live-DB – KEIN `ALTER TABLE` dafür nötig.

### Migration 1: `credit_taler` (atomare Gutschrift, idempotent, nur Service-Role)
```sql
-- Idempotenz auf DB-Ebene: eine Stripe-Zahlung kann nie doppelt gutgeschrieben werden.
create unique index if not exists uq_wallet_tx_stripe_pi
  on public.wallet_transactions (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create or replace function public.credit_taler(
  p_user_id                 uuid,
  p_amount_rappen           bigint,
  p_type                    text,
  p_description             text,
  p_stripe_payment_intent_id text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
begin
  if p_amount_rappen is null or p_amount_rappen <= 0 then
    return jsonb_build_object('success', false, 'error', 'Ungültiger Betrag');
  end if;

  begin
    insert into public.wallet_transactions
      (user_id, amount, type, description, stripe_payment_intent_id)
    values
      (p_user_id, p_amount_rappen, p_type, p_description, p_stripe_payment_intent_id);
  exception when unique_violation then
    return jsonb_build_object('success', false, 'duplicate', true, 'error', 'Bereits verarbeitet');
  end;

  update public.profiles
  set credits = coalesce(credits, 0) + p_amount_rappen
  where id = p_user_id;

  return jsonb_build_object('success', true);
end;
$$;

-- Nur der Webhook (Service-Role) darf gutschreiben:
revoke execute on function public.credit_taler(uuid, bigint, text, text, text)
  from public, anon, authenticated;
```

### Migration 2: `purchase_boost` (atomarer Taler-Abzug; Preise LIEGEN IN DER FUNKTION)
```sql
-- Preise/Dauer sind bewusst serverseitig fixiert – ein Client kann sie nicht manipulieren.
create or replace function public.purchase_boost(
  p_listing_id uuid,
  p_boost_type text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_cost    bigint;   -- Rappen
  v_days    integer;
  v_updated integer;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Nicht angemeldet');
  end if;

  case p_boost_type
    when 'push_to_top'     then v_cost := 500;  v_days := 1;  -- 5 Taler / 24h
    when 'color_highlight' then v_cost := 300;  v_days := 2;  -- 3 Taler / 48h
    when 'top_event'       then v_cost := 2000; v_days := 7;  -- 20 Taler / 7 Tage
    else return jsonb_build_object('success', false, 'error', 'Ungültiger Boost');
  end case;

  if not exists (
    select 1 from public.listings
    where id = p_listing_id and user_id = v_user_id
  ) then
    return jsonb_build_object('success', false, 'error', 'Nicht dein Inserat');
  end if;

  -- Atomarer Abzug: schlägt fehl, wenn das Guthaben nicht reicht
  update public.profiles
  set credits = credits - v_cost
  where id = v_user_id and coalesce(credits, 0) >= v_cost;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('success', false, 'error', 'Nicht genug Taler');
  end if;

  update public.listings
  set is_boosted       = true,
      boost_type       = p_boost_type,
      boost_expires_at = now() + make_interval(days => v_days),
      boost_cost       = v_cost
  where id = p_listing_id;

  insert into public.wallet_transactions (user_id, amount, type, description, listing_id)
  values (v_user_id, -v_cost, 'boost', 'Boost: ' || p_boost_type, p_listing_id);

  return jsonb_build_object('success', true, 'cost_rappen', v_cost, 'days', v_days);
end;
$$;
```

### Migration 3: `confirm_ticket_booking` (atomar, idempotent, nur Service-Role/Webhook)
```sql
alter table public.event_bookings
  add column if not exists stripe_payment_intent_id text;

create unique index if not exists uq_event_bookings_stripe_pi
  on public.event_bookings (stripe_payment_intent_id)
  where stripe_payment_intent_id is not null;

create or replace function public.confirm_ticket_booking(
  p_user_id                  uuid,
  p_listing_id               uuid,
  p_quantity                 integer,
  p_qr_code                  text,
  p_stripe_payment_intent_id text
) returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_listing    record;
  v_booking_id uuid;
begin
  if p_quantity is null or p_quantity < 1 then
    return jsonb_build_object('success', false, 'error', 'Ungültige Anzahl');
  end if;

  -- Idempotenz: Zahlung schon verarbeitet?
  if exists (
    select 1 from public.event_bookings
    where stripe_payment_intent_id = p_stripe_payment_intent_id
  ) then
    return jsonb_build_object('success', false, 'duplicate', true, 'error', 'Bereits verarbeitet');
  end if;

  select id, max_capacity, current_bookings, title
    into v_listing
  from public.listings
  where id = p_listing_id
  for update;

  if v_listing.id is null then
    return jsonb_build_object('success', false, 'error', 'Event nicht gefunden');
  end if;
  if coalesce(v_listing.current_bookings, 0) + p_quantity > coalesce(v_listing.max_capacity, 0) then
    return jsonb_build_object('success', false, 'error', 'capacity_exceeded');
  end if;

  insert into public.event_bookings
    (listing_id, user_id, party_size, quantity, qr_code, commitment_type, status, stripe_payment_intent_id)
  values
    (p_listing_id, p_user_id, p_quantity, p_quantity, p_qr_code, 'ticket', 'confirmed', p_stripe_payment_intent_id)
  returning id into v_booking_id;

  update public.listings
  set current_bookings = coalesce(current_bookings, 0) + p_quantity
  where id = p_listing_id;

  perform public.send_notification(
    p_user_id, '🎫 Ticket bestätigt!',
    'Dein Ticket für „' || v_listing.title || '" ist im Profil verfügbar.',
    'system', p_listing_id
  );

  return jsonb_build_object('success', true, 'booking_id', v_booking_id);
end;
$$;

revoke execute on function public.confirm_ticket_booking(uuid, uuid, integer, text, text)
  from public, anon, authenticated;
```

### Migration 4: `get_admin_stats` (aggregiert, nur für Admins)
```sql
create or replace function public.get_admin_stats()
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    return jsonb_build_object('success', false, 'error', 'Nicht berechtigt');
  end if;

  return jsonb_build_object(
    'success', true,
    'total_users',       (select count(*) from public.profiles),
    'active_listings',   (select count(*) from public.listings where status = 'active'),
    'tx_this_week',      (select count(*) from public.transactions where created_at > now() - interval '7 days'),
    'commission_rappen', (select coalesce(-sum(amount), 0) from public.wallet_transactions where type = 'commission'),
    'taler_sold_rappen', (select coalesce(sum(amount), 0)  from public.wallet_transactions where type = 'purchase')
  );
end;
$$;
```

Nach dem Einspielen: Grant/RLS-Check (D2) und `docs/database-schema.md` um die vier RPCs ergänzen.

---

## SCHRITT 0 – PFLICHTLEKTÜRE

```
1. CLAUDE.md
2. DEVELOPMENT_GUIDELINES.md
3. docs/database-schema.md   (inkl. der neuen RPCs aus Schritt -1)
4. docs/stripe.md            (wird diese Phase befüllt)
5. docs/dsgvo.md             (wird diese Phase befüllt)
6. docs/admin.md             (wird diese Phase befüllt)
7. docs/wallet.md            (Phase 3 Stand)
8. /mnt/skills/user/stripe-best-practices/SKILL.md (falls verfügbar)
```

---

## SCHRITT 1 – Stripe Setup

### Pakete
```bash
npm install stripe @stripe/stripe-js
```

### Stripe-Dashboard konfigurieren
1. **Restricted API Key** erstellen (`rk_` Prefix, NICHT `sk_`):
   Berechtigungen: Checkout Sessions (write), Customers (write), Refunds (write), Webhooks (read)
   → `.env.local` + Vercel: `STRIPE_SECRET_KEY=rk_...`
2. Webhook-Endpoint registrieren: `https://<domain>/api/stripe/webhook`
   Events: `checkout.session.completed`, `payment_intent.payment_failed`
3. `STRIPE_WEBHOOK_SECRET` aus den Webhook-Settings kopieren
4. Publishable Key → `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
5. TWINT als Zahlungsmethode im Dashboard aktivieren (NICHT im Code)

### `src/lib/stripe.ts`
```typescript
import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-05-27.dahlia',
  typescript: true,
})

export const TALER_PACKAGES = [
  { id: 'taler_10',  talerAmount: 10,  priceChf: 10.00, label: '10 Taler',  tag: '' },
  { id: 'taler_25',  talerAmount: 25,  priceChf: 23.00, label: '25 Taler',  tag: '8% Rabatt' },
  { id: 'taler_50',  talerAmount: 50,  priceChf: 45.00, label: '50 Taler',  tag: '10% Rabatt' },
  { id: 'taler_100', talerAmount: 100, priceChf: 85.00, label: '100 Taler', tag: '15% Rabatt' },
] as const

export type TalerPackageId = typeof TALER_PACKAGES[number]['id']
```

---

## SCHRITT 2 – Taler kaufen via Stripe Checkout

### `src/app/api/stripe/create-checkout/route.ts`
```typescript
import { createServerClient }     from '@/lib/supabase/server'
import { NextResponse }           from 'next/server'
import { stripe, TALER_PACKAGES } from '@/lib/stripe'
import { z }                      from 'zod'

const Schema = z.object({
  package_id: z.enum(['taler_10', 'taler_25', 'taler_50', 'taler_100']),
})

export async function POST(request: Request) {
  try {
    const supabase = createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Nicht angemeldet' }, { status: 401 })

    const { package_id } = Schema.parse(await request.json())
    const pkg = TALER_PACKAGES.find(p => p.id === package_id)!

    // Stripe Customer abrufen oder erstellen
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, username')
      .eq('id', user.id)
      .single()

    let customerId = profile?.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name:  profile?.username ?? undefined,
        metadata: { supabase_user_id: user.id },
      })
      customerId = customer.id
      await supabase
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL!

    // Checkout Session – KEIN payment_method_types (dynamisch via Dashboard)
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode:     'payment',
      line_items: [{
        price_data: {
          currency:    'chf',
          unit_amount: Math.round(pkg.priceChf * 100), // Rappen
          product_data: {
            name:        `${pkg.label} Uri-Taler`,
            description: '1 Taler = 1 CHF · Verwendbar für Boosts & Provisionen',
            images:      [`${appUrl}/taler-icon.png`],
          },
        },
        quantity: 1,
      }],
      success_url: `${appUrl}/wallet?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url:  `${appUrl}/wallet?cancelled=true`,
      metadata: {
        purchase_type: 'taler',
        user_id:       user.id,
        package_id,
        taler_amount:  pkg.talerAmount.toString(),
      },
      custom_text: {
        submit: { message: `Du kaufst ${pkg.label} Uri-Taler für CHF ${pkg.priceChf.toFixed(2)}` },
      },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json({ error: 'Ungültige Eingabe' }, { status: 400 })
    console.error('[stripe/create-checkout]', error)
    return NextResponse.json({ error: 'Checkout fehlgeschlagen' }, { status: 500 })
  }
}
```

### `src/app/api/stripe/webhook/route.ts`
> Korrigiert gegenüber dem alten Plan: **EIN** `checkout.session.completed`-Case
> (der doppelte Case war toter Code), Unterscheidung via `metadata.purchase_type`,
> Gutschrift atomar + idempotent via RPC `credit_taler` (kein Read-then-Write mehr).

```typescript
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { stripe }       from '@/lib/stripe'
import { generateQRCode } from '@/lib/qr'
import { email }        from '@/lib/email'
import Stripe           from 'stripe'

export const runtime = 'nodejs'

// Service-Role-Client (Webhook hat keinen User-Kontext, umgeht RLS)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
)

export async function POST(request: Request) {
  const body      = await request.text()  // WICHTIG: text(), nicht json()!
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'No signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      if (session.payment_status !== 'paid') break

      const meta = session.metadata ?? {}
      const paymentIntentId = typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id
      if (!paymentIntentId) break

      if (meta.purchase_type === 'taler') {
        const { user_id, taler_amount } = meta
        if (!user_id || !taler_amount) break
        const talerInRappen = parseInt(taler_amount, 10) * 100

        const { data, error } = await supabaseAdmin.rpc('credit_taler', {
          p_user_id:                  user_id,
          p_amount_rappen:            talerInRappen,
          p_type:                     'purchase',
          p_description:              `${taler_amount} Uri-Taler gekauft`,
          p_stripe_payment_intent_id: paymentIntentId,
        })

        if (error) { console.error('[webhook] credit_taler', error); break }
        if (data?.duplicate) { console.log('[webhook] Duplicate, skipping:', session.id); break }

        await supabaseAdmin.rpc('send_notification', {
          p_recipient_id: user_id,
          p_title:        `💰 ${taler_amount} Taler gutgeschrieben!`,
          p_message:      'Dein Guthaben wurde aufgeladen.',
          p_type:         'system',
          p_listing_id:   null,
        })
      }

      if (meta.purchase_type === 'ticket') {
        const { user_id, listing_id, quantity } = meta
        if (!user_id || !listing_id || !quantity) break

        const qrCode = generateQRCode()
        const { data, error } = await supabaseAdmin.rpc('confirm_ticket_booking', {
          p_user_id:                  user_id,
          p_listing_id:               listing_id,
          p_quantity:                 parseInt(quantity, 10),
          p_qr_code:                  qrCode,
          p_stripe_payment_intent_id: paymentIntentId,
        })

        if (error) { console.error('[webhook] confirm_ticket_booking', error); break }
        if (data?.duplicate) break

        if (data?.error === 'capacity_exceeded') {
          // Event zwischen Checkout und Webhook ausverkauft → Geld zurück
          await stripe.refunds.create({ payment_intent: paymentIntentId })
          await supabaseAdmin.rpc('send_notification', {
            p_recipient_id: user_id,
            p_title:        '❌ Event ausverkauft',
            p_message:      'Leider war das Event inzwischen ausverkauft. Deine Zahlung wurde vollständig erstattet.',
            p_type:         'system',
            p_listing_id:   listing_id,
          })
          break
        }

        // Ticket-Mail (respektiert email_notifications, siehe lib/email.ts)
        const { data: profile } = await supabaseAdmin
          .from('profiles').select('email_notifications').eq('id', user_id).single()
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(user_id)
        const { data: listing } = await supabaseAdmin
          .from('listings').select('title').eq('id', listing_id).single()
        if (profile?.email_notifications !== false && authUser?.user?.email && listing) {
          await email.sendTicketConfirmation(authUser.user.email, listing.title, qrCode)
        }
      }
      break
    }

    case 'payment_intent.payment_failed': {
      console.log('[webhook] payment failed:', event.data.object.id)
      break
    }

    default:
      console.log(`[webhook] Unhandled event type: ${event.type}`)
  }

  return NextResponse.json({ received: true })
}
```

### `src/components/wallet/TalerTopUp.tsx`
- 4 Paket-Karten (2×2 Grid mobile), empfohlenes Paket (50 Taler) mit `border-gold shadow-gold`
- Preis gross `CHF 45.–`, Rabatt-Badge
- Kaufen → POST `/api/stripe/create-checkout` → Redirect zu `session.url`, Loading-State

---

## SCHRITT 3 – Event-Ticket-Zahlung (Stripe)

### `src/app/actions/events.ts` (Erweiterung)
```typescript
'use server'
import { createServerClient } from '@/lib/supabase/server'
import { stripe }             from '@/lib/stripe'

export async function purchaseTicket(listingId: string, quantity: number) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10)
    throw new Error('Ungültige Anzahl')

  const { data: listing } = await supabase
    .from('listings')
    .select('id,title,ticket_price,max_capacity,current_bookings,commitment_type,status')
    .eq('id', listingId)
    .single()

  if (!listing || listing.status !== 'active') throw new Error('Event nicht verfügbar')
  if (listing.commitment_type !== 'ticket') throw new Error('Kein Ticket-Event')
  if (!listing.ticket_price || listing.ticket_price <= 0) throw new Error('Ungültiger Ticketpreis')
  // Vorab-Check (weich) – die harte, atomare Prüfung macht confirm_ticket_booking im Webhook
  if ((listing.current_bookings ?? 0) + quantity > (listing.max_capacity ?? 0))
    throw new Error('Nicht genug Plätze')

  const appUrl = process.env.NEXT_PUBLIC_APP_URL!

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    // KEIN payment_method_types
    line_items: [{
      price_data: {
        currency:     'chf',
        unit_amount:  Math.round(listing.ticket_price * 100), // Rappen
        product_data: { name: `Ticket: ${listing.title}` },
      },
      quantity,
    }],
    success_url: `${appUrl}/profile?tab=tickets&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url:  `${appUrl}/listing/${listingId}?cancelled=true`,
    metadata: {
      purchase_type: 'ticket',
      user_id:       user.id,
      listing_id:    listingId,
      quantity:      quantity.toString(),
    },
  })

  return { url: session.url }
}
```
Die Buchung selbst (QR, `event_bookings`-Insert, `current_bookings`-Inkrement, Notification, E-Mail)
passiert AUSSCHLIESSLICH im Webhook via `confirm_ticket_booking` – nie hier.

---

## SCHRITT 4 – Smart Boosts kaufen

### `src/lib/boosts.ts` (nur Anzeige-Daten – die verbindlichen Preise liegen in der DB-RPC!)
```typescript
export const BOOST_PACKAGES = [
  { id: 'push_to_top',     taler: 5,  duration: '24h',    label: '⚡ Push to Top',  description: '24h im Karussell & Feed-Top' },
  { id: 'color_highlight', taler: 3,  duration: '48h',    label: '🌟 Gold-Rahmen',  description: '48h goldener Rahmen' },
  { id: 'top_event',       taler: 20, duration: '7 Tage', label: '🚀 Top-Event',    description: '7 Tage in den Top 3 gepinnt' },
] as const
```
⚠️ Diese Werte MÜSSEN mit denen in der RPC `purchase_boost` übereinstimmen (500/300/2000 Rappen, 1/2/7 Tage). Bei Preisänderungen: zuerst die RPC (Migration via Supabase-MCP), dann diese Anzeige.

### `src/app/actions/boosts.ts`
```typescript
'use server'
import { createServerClient } from '@/lib/supabase/server'
import { revalidatePath }     from 'next/cache'

export async function purchaseBoost(listingId: string, boostType: string) {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const { data, error } = await supabase.rpc('purchase_boost', {
    p_listing_id: listingId,
    p_boost_type: boostType,
  })
  if (error || !data?.success) throw new Error(data?.error ?? 'Boost fehlgeschlagen')

  revalidatePath('/')
  return data
}
```

---

## SCHRITT 5 – E-Mail via Resend

### `src/lib/email.ts`
```typescript
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY!)
const appUrl = process.env.NEXT_PUBLIC_APP_URL!

export const email = {
  async sendMatchAlert(to: string, listingTitle: string, listingId: string) {
    await resend.emails.send({
      from: 'Uri-Markt <noreply@uri-markt.ch>',
      to,
      subject: `🎯 Match gefunden: ${listingTitle}`,
      html: `
        <h2>Neuer Match!</h2>
        <p>Ein neues Angebot passt zu deinem Gesuch: <strong>${listingTitle}</strong></p>
        <a href="${appUrl}/listing/${listingId}">Jetzt ansehen →</a>
        <hr>
        <small><a href="${appUrl}/profile/settings">E-Mails abbestellen</a></small>
      `,
    })
  },

  async sendTicketConfirmation(to: string, eventTitle: string, qrCode: string) {
    await resend.emails.send({
      from: 'Uri-Markt <tickets@uri-markt.ch>',
      to,
      subject: `🎫 Dein Ticket: ${eventTitle}`,
      html: `
        <h2>Dein Ticket ist bestätigt!</h2>
        <p><strong>${eventTitle}</strong></p>
        <p>Ticket-Code: <code>${qrCode}</code></p>
        <p>Öffne die Uri-Markt App und zeige dein Ticket (QR-Code) vor.</p>
        <small>Dein Code ist personalisiert und einmalig verwendbar.</small>
        <hr>
        <small><a href="${appUrl}/profile/settings">E-Mails abbestellen</a></small>
      `,
    })
  },

  async sendTransactionConfirmed(to: string, listingTitle: string, contact: string) {
    await resend.emails.send({
      from: 'Uri-Markt <noreply@uri-markt.ch>',
      to,
      subject: `✅ Deal bestätigt: ${listingTitle}`,
      html: `
        <h2>Dein Deal wurde bestätigt!</h2>
        <p>Kontakt: <strong>${contact}</strong></p>
        <p>Macht jetzt einen Termin aus und bezahlt vor Ort (Bar/TWINT).</p>
        <hr>
        <small><a href="${appUrl}/profile/settings">E-Mails abbestellen</a></small>
      `,
    })
  },
}
```
Regel: Vor JEDEM Versand `profiles.email_notifications` prüfen – bei `false` NICHT senden.

---

## SCHRITT 6 – DSGVO / DSG Compliance

### `src/app/datenschutz/page.tsx`
Vollständige Datenschutzerklärung (Server Component):
- Verantwortlicher (Name/Adresse des Betreibers – von JJ einsetzen lassen, dieser eine Punkt braucht echte Angaben)
- Zweck der Datenverarbeitung
- Verwendete Dienste: Supabase (**EU Paris**), Stripe, Resend, Anthropic, Vercel
- Nutzerrechte: Auskunft, Berichtigung, Löschung, Widerspruch
- Kontakt-E-Mail für Datenschutz-Anfragen
- Hinweis auf E-Mail-Abmeldung in den Profileinstellungen

### `src/app/actions/account.ts` – Konto-Löschung
```typescript
'use server'
import { createServerClient } from '@/lib/supabase/server'
import { createClient }       from '@supabase/supabase-js'
import { redirect }           from 'next/navigation'

export async function deleteAccount() {
  const supabase = createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Nicht angemeldet')

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )

  // Auth-User löschen (CASCADE löscht profiles + abhängige Daten)
  const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id)
  if (error) throw new Error('Konto konnte nicht gelöscht werden')

  // Zahlungsbelege bleiben bei Stripe (gesetzliche Aufbewahrungspflicht)
  redirect('/')
}
```
Vor Launch einmal testen, dass die CASCADE-Kette wirklich alle Nutzerdaten entfernt.

### `src/components/profile/PrivacySettings.tsx`
- E-Mail-Benachrichtigungen an/aus (`email_notifications`)
- Push-Notifications an/aus (`push_notifications`)
- Profil öffentlich/privat (`profile_public`)
- „Konto löschen" (mit Bestätigungs-Dialog: Name eintippen)
- „Daten herunterladen" (JSON-Export der eigenen Daten: Profil, Inserate, Transaktionen, Wallet)

---

## SCHRITT 7 – Admin Panel

### `src/app/admin/page.tsx`
`profiles.is_admin` existiert bereits in der Live-DB (Default false, manuell setzen).
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('is_admin')
  .eq('id', user.id)
  .single()

if (!profile?.is_admin) redirect('/')
```

### `src/components/admin/AdminDashboard.tsx` – Tabs

**📊 Statistiken** – EIN Aufruf statt vieler Count-Queries:
```typescript
const { data: stats } = await supabase.rpc('get_admin_stats')
// { success, total_users, active_listings, tx_this_week, commission_rappen, taler_sold_rappen }
// Rappen-Werte für die Anzeige durch 100 teilen.
```

**🚩 Gemeldete Inserate:** `is_flagged = true` · Aktionen: Freigeben | Löschen

**👤 Nutzer-Management:** Suche (Username), Strikes zurücksetzen, Ban/Unban,
Taler manuell gutschreiben/abziehen (Gutschrift: NICHT direkt auf `credits` schreiben –
eigener Admin-Pfad über eine Migration/RPC oder direkt via Supabase-MCP im Planungs-Chat)

**🎫 Transaktionen:** Offene Eskalationen (`status='cancelled'` nach No-Show bzw. Support-Fälle), manuelle Auflösung

---

## SCHRITT 8 – PWA Setup

### `public/manifest.json`
```json
{
  "name": "Uri-Markt",
  "short_name": "Uri-Markt",
  "description": "Der lokale Marktplatz für den Kanton Uri",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "orientation": "portrait",
  "categories": ["shopping", "local"],
  "lang": "de-CH",
  "icons": [
    { "src": "/icon-72.png",  "sizes": "72x72",   "type": "image/png" },
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any maskable" }
  ],
  "shortcuts": [
    { "name": "Inserieren",  "url": "/?action=create", "icons": [{ "src": "/icon-create.png",  "sizes": "96x96" }] },
    { "name": "Mein Profil", "url": "/profile",        "icons": [{ "src": "/icon-profile.png", "sizes": "96x96" }] }
  ]
}
```

### `next.config.ts` – Security Headers
```typescript
import type { NextConfig } from 'next'

const config: NextConfig = {
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options',        value: 'DENY' },
        { key: 'Referrer-Policy',        value: 'strict-origin-when-cross-origin' },
      ],
    }]
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
    ],
  },
}
export default config
```
(Vercel: Framework-Preset muss „Next.js" sein, nicht „Other".)

---

## SCHRITT 9 – Performance

### Indizes (Migration via Supabase-MCP; `type`-Wert konsistent mit Phase 3: `'Event'`)
```sql
CREATE INDEX IF NOT EXISTS idx_listings_active_boosted
  ON listings (boost_expires_at DESC)
  WHERE is_boosted = true AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_listings_fomo
  ON listings (fomo_expires_at DESC)
  WHERE status = 'sold' AND fomo_expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_listings_events
  ON listings (event_date ASC)
  WHERE type = 'Event' AND status = 'active';
```
Danach: Supabase Dashboard → Performance/Security Advisor prüfen.

### Next.js
```typescript
// Alle Bilder via next/image – nie <img> direkt.
import Image from 'next/image'

// Schwere Komponenten dynamisch laden:
const QRScanner = dynamic(() => import('@/components/events/QRScanner'), {
  ssr: false,
  loading: () => <div className="animate-pulse bg-white/5 rounded-xl h-64" />,
})
```

---

## SCHRITT 10 – Docs

- `docs/stripe.md` → ✅ (Taler-Kauf, Ticket-Kauf, Boost, Webhook, Dashboard-Konfig)
- `docs/dsgvo.md` → ✅ (Datenschutzerklärung, Konto-Löschung, Daten-Export)
- `docs/admin.md` → ✅ (Admin-Aktivierung per SQL, verfügbare Aktionen)
- `docs/database-schema.md` → um die 4 neuen RPCs + Indizes + `event_bookings.stripe_payment_intent_id` ergänzt
- `CLAUDE.md` → Phase 4 auf ✅

---

## FINALE LAUNCH-CHECKLISTE

```
DB (VOR allem anderen):
[ ] 4 Migrationen eingespielt (credit_taler, purchase_boost, confirm_ticket_booking, get_admin_stats)
[ ] Unique-Indizes auf stripe_payment_intent_id (wallet_transactions + event_bookings) vorhanden
[ ] Grant/RLS-Check nach den Migrationen (D2)
[ ] Supabase-Types nach Migrationen neu generiert, tsc sauber

STRIPE:
[ ] Restricted API Key (rk_ Prefix) in .env.local UND Vercel
[ ] Webhook-Endpoint in Stripe eingetragen, STRIPE_WEBHOOK_SECRET in Vercel
[ ] Test-Kauf 10 Taler end-to-end: Webhook schreibt 1000 Rappen gut, Notification kommt
[ ] Webhook-Doppel-Zustellung (Stripe „Resend") → keine doppelte Gutschrift
[ ] Ticket-Kauf end-to-end: Buchung, QR, current_bookings +quantity, E-Mail
[ ] Ausverkauft-zwischen-Checkout-und-Webhook → automatischer Refund + Notification
[ ] Grep-Check: "payment_method_types" kommt im Repo NICHT vor
[ ] Alle Webhooks via constructEvent() verifiziert

GELD-SICHERHEIT:
[ ] Grep-Check: kein direktes UPDATE auf profiles.credits im App-Code
    (nur RPCs: credit_taler, purchase_boost, process_transaction_commission, escalate_no_show)
[ ] purchase_boost mit 0 Taler Guthaben → sauberer Fehler, kein Abzug, kein Boost
[ ] credit_taler / confirm_ticket_booking sind für anon/authenticated NICHT aufrufbar (revoke-Test)

DSGVO/DSG:
[ ] /datenschutz erreichbar und vollständig (Betreiber-Daten von JJ eingesetzt)
[ ] Konto-Löschung entfernt wirklich alle Daten (CASCADE-Test mit Testkonto)
[ ] E-Mail-Abmelde-Link in allen E-Mails, email_notifications wird respektiert
[ ] Supabase-Region: EU (Paris) bestätigt
[ ] Kein Google Analytics oder externes Tracking

SICHERHEIT:
[ ] Kein Server-Secret mit NEXT_PUBLIC_-Prefix
[ ] npm audit → keine kritischen Vulnerabilities
[ ] RLS auf allen Tabellen aktiv (SQL-Check)
[ ] Keine SELECT-*-Queries

PWA:
[ ] iOS Safari: „Zum Homescreen" funktioniert
[ ] Android Chrome: Install-Dialog erscheint
[ ] Push auf iOS/Android getestet
[ ] Offline-Fallback-Seite vorhanden

PERFORMANCE:
[ ] Lighthouse Mobile ≥ 85, FCP < 2s
[ ] Keine next/image-Warnungen im Build

FINAL:
[ ] npx tsc --noEmit → 0 Errors
[ ] npm run build → 0 Errors, 0 Warnings · npm run lint → 0 Errors
[ ] Alle /docs/*.md aktuell, CLAUDE.md: alle Phasen ✅
[ ] 🎉 Launch!
```
