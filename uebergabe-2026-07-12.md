# Übergabe 12.07.2026 — Block 6 (Stripe-Taler-Kauf)

Arbeitsmodus: Planungs-Chat mit Repo-Mount + Supabase-MCP. Code + tsc + eslint selbst
(gruen). Build + E2E via "Uri-Markt Verify" bei JJ. Kein Push ohne JJ-OK. D1–D5, Lektionen 1–14.

## ✅ BEWIESEN & ABGESCHLOSSEN — Block 6 (Commit `91d0cc0`, Verify GRUEN: BUILD_EXIT=0 PW_EXIT=0, 20 passed)

DB (live verifiziert D1/D2, keine Migration noetig):
- `credit_taler(p_user_id, p_amount_rappen, p_stripe_payment_intent_id, p_description)` —
  SECURITY DEFINER, EXECUTE nur postgres/service_role. Idempotent via
  `INSERT ... ON CONFLICT (stripe_payment_intent_id) DO NOTHING` + Unique-Index
  `uq_wallet_tx_stripe_pi`. wallet_transactions-Spalten passen.
- wallet_transactions RLS aktiv, einzige Policy `wallet_select_own` (SELECT).

Code:
- `src/lib/taler.ts` Pakete 5/10/20/50 Taler (keine Secrets), `rappenToTaler = /100`.
- `src/lib/stripe.ts` Server-Stripe lazy (apiVersion = SDK-Default), NUR Server.
- `src/app/actions/taler.ts` Checkout: mode payment, CHF, `unit_amount = pkg.rappen`,
  KEIN payment_method_types, user_id/Betrag serverseitig, metadata an Session + PaymentIntent.
- `src/app/api/webhooks/stripe/route.ts` roher Body → `constructEvent()`; bei
  checkout.session.completed + paid → `credit_taler` via Service-Client; DB-Fehler → 500
  (Retry), fehlende Metadaten → 200+skip, ungueltige Signatur → 400.
- `src/components/profile/TalerPurchase.tsx` + Kachel "Taler kaufen"; credits/100,
  Doppelklick-Sperre (busyRef + alle Buttons disabled), Fehler sichtbar, success/cancel-Toast.
- `src/middleware.ts` Matcher nimmt `api/webhooks` aus. `docs/taler-kauf.md`.

E2E `e2e/block6-taler.spec.ts` (GRUEN): A Checkout-Session real (per Stripe-API: amount 1000,
chf, metadata.user_id) · B signierter Webhook → +500, 2. Zustellung ohne Doppelgutschrift,
genau 1 wallet_tx · C ungueltige Signatur → 400. Aufraeumen: Buchung weg, credits auf Baseline.

Preflight (Lektion 14): `e2e/preflight.ts` als Playwright `globalSetup` (in
playwright.config.ts verdrahtet) prueft alle Env-Variablen und stoppt sofort mit
"FEHLT: X - so beheben: Y".

Stripe-Werkzeuge (JJ, einmalig): `e2e/stripe-setup.ps1` (Install+Login, Erfolg an
`stripe config --list`, NICHT am Exit-Code), `e2e/stripe-webhook.ps1` (`--print-secret` +
`--forward-to http://localhost:3000/api/webhooks/stripe`, whsec_ gross),
`e2e/install-deps.ps1` (npm install stripe), `install-shortcut-stripe.ps1`.

## 🐛 D5 — Root Cause Zyklus-1-Rot (Verify 1: PW_EXIT=1, 19/1)
- Symptom: Test A login() → Klick "Anmelden" Timeout ("not stable / subtree intercepts
  pointer events").
- Bewiesene Ursache (Trace `error-context.md`): abfangendes Overlay = OnboardingFlow
  (z-50, h-[90vh]). Frischer Context → leeres localStorage → onboardingCompleted=false →
  Onboarding rendert ueber dem Login. NICHT Parallelitaet/Rate-Limit (1 Worker, isolierte
  Contexts). block2–5 seeden onboardingCompleted=true per `page.addInitScript(skipOnboarding)`;
  Block-6-Spec hatte das als einziges vergessen.
- Fix (1, D3): `skipOnboarding` + `test.beforeEach(addInitScript)` — identisch zu block2–5,
  reine Test-Konvention (Lektion 9). Zyklus 2: GRUEN, 20 passed.

## ⚠️ ANGEFANGEN / OFFENE SCHULDEN
- **package-lock.json NICHT committet.** Der Sandbox-Mount liest die Lock-Datei nach
  `npm install stripe` nur abgeschnitten (JSON unterminated ~char 269273). `package.json`
  (mit `stripe ^22.3.1`) IST committet. → JJ lokal `npm install` (schreibt sauberen Lock
  nativ) und package-lock.json separat committen VOR Block 8 (Vercel `npm ci` braucht
  Lock in sync).
- **rk_-Key (Go-Live):** aktuell `sk_test_`. Fuer Echtgeld Restricted Key `rk_live_...`
  anlegen + eintragen.
- **credits nicht-negativ** (Masterplan 5 "Guthaben-Pruefung VOR Verpflichtung, DB-Constraint
  nicht-negativ"): betrifft den Ausgabe-/Provisions-Pfad, nicht den Kauf. Constraint auf
  profiles.credits live noch NICHT verifiziert → Planungs-Chat pruefen/anlegen (bewusst
  NICHT in Block 6 abgehakt).
- **REVOKE** ueberzaehlige Grants auf wallet_transactions (anon/auth INSERT/UPDATE/DELETE),
  Defense-in-Depth — Migration mit JJ-OK.
- **Hosted-Checkout-Karten-Klickdurch (4242):** bewusst NICHT automatisiert (Stripe-DOM
  flaky, Lektion 9); Webhook deterministisch per echter Signatur bewiesen.
- **Voraussetzung JJ:** Stripe-Konto (Einzelfirma) fuer echte Zahlungen — offen.

## 📋 NAECHSTE BLOECKE
Block 6 ✅. Offen: Block 7 (5-Taler-Texte + Rechtsseiten), Block 8 (Vercel-Deploy — zuerst
package-lock sauber!), Block 9 (Kommentar-Zaehler Feed-Karten).

## Push
Von JJ freigegeben: "Uri-Markt Push" → schiebt `91d0cc0` + diesen Doku-Commit nach GitHub.
