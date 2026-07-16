# Übergabe 16.07.2026 — Block 8 (Vercel-Deploy-Vorbereitung)

Arbeitsmodus: Planungs-Chat mit Repo-Mount. Kein Push ohne JJ-OK. D1–D5, Lektionen 1–14.

## ✅ ERLEDIGT (tsc GRÜN, Exit 0)

### docs/deploy-vercel.md (neu)
Vollständige Klickanleitung für JJ: Env-Liste (aus `process.env.`-Repo-Suche, nicht
Gedächtnis), Stripe-Prod-Webhook, Supabase-Auth-URLs, Vercel-Import, Smoke-Test.

**Tatsächlich im Code genutzte Env-Variablen (6):** `NEXT_PUBLIC_SUPABASE_URL`,
`NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`. — NICHT genutzt (nicht in Vercel setzen):
`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `ANTHROPIC_API_KEY`, `RESEND_API_KEY`,
`QR_SIGNING_SECRET` (kommen erst mit Phase 3/4), `SUPABASE_ACCESS_TOKEN`/`E2E_*` (nur dev).

### vercel.json (neu, mit Grund)
`"regions": ["cdg1"]` (Paris): Supabase-DB liegt in EU Paris; Vercel-Default wäre
Washington → ~80–100 ms pro DB-Roundtrip + Datenverarbeitung ausserhalb EU. Sonst nichts
— Next.js 15 App Router braucht keine weitere Konfiguration.

### Root-Cause-Fix (D3, einer): AuthModal emailRedirectTo
- Symptom (präventiv gefunden): `src/components/auth/AuthModal.tsx` baute
  `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` OHNE Fallback → bei fehlender
  Variable ginge der String `undefined/auth/callback` an Supabase (Signup-Mails kaputt).
- Fix: `?? window.location.origin` ergänzt (Client-Komponente, Origin immer vorhanden).
  Verhalten bei gesetzter Variable unverändert (kein Regressionsrisiko auf Block-7-E2E).

### Geprüft und SAUBER (keine Änderung nötig)
- Stripe `success_url`/`cancel_url` (`src/app/actions/taler.ts`): an echten
  Request-Origin gebunden, Fallback-Kette korrekt.
- Middleware-Matcher: schliesst `api/webhooks` aus → Stripe-Webhook wird nicht abgefangen.
- Share-/Referral-Links: haben `window.location.origin`-Fallback.
- Kein hartcodiertes `localhost` ausser letztem Dev-Fallback (taler.ts) + UI-Hinweistext.
- Auth-Callback-Pfad aus Code gelesen: `/auth/callback` (`src/app/auth/callback/route.ts`).

## 🔎 Beweise
- `npx tsc --noEmit` → Exit 0 (Sandbox, nach Fix).
- ESLint in der Sandbox nicht lauffähig (Prozess stirbt am Speicherlimit — wie Block 7).
  Diff enthält keinen neuen JSX-Text, nur JS-Kommentare → kein Lektion-12-Risiko.
  Voller Beweis (build inkl. eslint): über „Uri-Markt Verify" bei JJ.

## ⚠️ WICHTIG: Commit-Stand
- **Block 7 ist NUR gestaged, nie committet** (letzter Commit = Block 6 `03e2679`);
  `e2e/block7-commit-push.ps1` wurde nie ausgeführt.
- Die Sandbox kann im Repo-Mount keine Dateien löschen → stale `.git/index.lock`
  blockiert Commits aus dieser Session. **JJ führt `e2e/block8-commit.ps1` aus**
  (Rechtsklick → Mit PowerShell ausführen): entfernt das Lock, committet Block 7 und
  Block 8 GETRENNT, **kein Push**.

## Session-Lektion (Umgebung, nicht CLAUDE.md-Code-Workflow)
Datei-Edit über Host-Tool hat `AuthModal.tsx` einmal am Ende abgeschnitten
(Sync-Problem Host↔Mount); per `git show :pfad` wiederhergestellt, Fix danach per
Python-Skript direkt im Mount. → In Repo-Mount-Sessions nach jedem Edit
`wc -l` + `tail` der Datei prüfen.

## 📋 NÄCHSTE SCHRITTE (exakt)
1. JJ: „Uri-Markt Verify" laufen lassen (build inkl. eslint + Playwright) → GRÜN melden.
2. JJ: `e2e/block8-commit.ps1` ausführen (Commits lokal, kein Push).
3. Nach JJ-OK: Push (dann Deploy nach `docs/deploy-vercel.md` Abschnitt 4).
4. Danach offen: Block 9 (Kommentar-Zähler Feed-Karten).
