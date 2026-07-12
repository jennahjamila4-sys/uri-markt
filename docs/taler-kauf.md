# Taler-Kauf (Stripe) — Block 6

**Ziel:** Nutzer kaufen Uri-Taler mit CHF via Stripe. 1 Taler = CHF 1.00 = 100 Rappen.
`profiles.credits` wird in Rappen gefuehrt; Anzeige immer `credits / 100`.

## Fluss
1. `TalerPurchase` (Profil → Kachel „Taler kaufen") zeigt die Pakete aus
   `src/lib/taler.ts` (5/10/20/50 Taler).
2. Klick → Server Action `createTalerCheckoutAction(packageId)`:
   - `user_id` serverseitig via `getUser()` (nie vom Client), Betrag aus der
     Paket-Definition (nie aus dem Request-Body).
   - Stripe Checkout Session (`mode: 'payment'`, `currency: 'chf'`,
     `unit_amount = pkg.rappen`). **KEIN `payment_method_types`** → Stripe waehlt
     die im Dashboard aktivierten Methoden automatisch.
   - `metadata` (user_id, amount_rappen, package_id) an Session UND PaymentIntent.
   - Rueckgabe der `session.url` → Client leitet weiter.
3. Zahlung auf Stripe-Checkout. Rueckkehr an `/profile?taler=success|cancel`
   (sichtbarer Toast, Param wird entfernt).
4. Stripe schickt `checkout.session.completed` an
   `POST /api/webhooks/stripe`:
   - Signatur via `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)`.
   - Nur bei `payment_status === 'paid'`.
   - Gutschrift AUSSCHLIESSLICH via SECURITY-DEFINER-RPC
     `credit_taler(p_user_id, p_amount_rappen, p_stripe_payment_intent_id, p_description)`
     mit Service-Client. Idempotent (Unique-Index auf `stripe_payment_intent_id`) →
     doppelt zugestellter Webhook schreibt nie doppelt gut.
   - DB-Fehler → HTTP 500 (Stripe retryt, idempotent abgesichert). Ungueltige
     Signatur → 400.

## Sicherheit / Regeln
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` nur serverseitig (`src/lib/stripe.ts`,
  Route). Nie im Client-Bundle.
- `src/lib/taler.ts` enthaelt KEINE Secrets (client- und serverseitig nutzbar).
- Webhook ist im Middleware-Matcher ausgenommen (`api/webhooks`), damit die
  Session-Refresh-Logik den maschinellen Call nicht anfasst.
- Kein Read-then-Write auf `credits` im App-Code — nur die RPC.

## Lokales Testen (JJ)
- `Uri-Markt Stripe Setup` (einmalig) → CLI + Login.
- `Uri-Markt Stripe Webhook` → zeigt `whsec_…`, forwardet an
  `http://localhost:3000/api/webhooks/stripe`. Wert in `.env.local` als
  `STRIPE_WEBHOOK_SECRET` eintragen, Dev-Server (Port 3000) neu starten.
- Testkarte `4242 4242 4242 4242`, beliebiges zukuenftiges Datum, beliebiger CVC.

## E2E (`e2e/block6-taler.spec.ts`)
- A: Klick auf Paket erzeugt eine echte Checkout-Session; per Stripe-API geprueft
  (Betrag 1000 Rappen, CHF, Metadaten = user_id).
- B: signierter `checkout.session.completed` (echte Signatur via
  `generateTestHeaderString`) → Guthaben +500, zweite Zustellung ohne
  Doppelgutschrift, genau eine `wallet_transactions`-Zeile.
- C: ungueltige Signatur → 400, keine Gutschrift.
- Aufraeumen: Test-Buchung geloescht, Guthaben auf Baseline zurueckgesetzt.

## Abhaengigkeit
- `stripe` (npm). Installation lokal via `e2e/install-deps.ps1` (Sandbox-Proxy
  blockt die npm-Registry).
