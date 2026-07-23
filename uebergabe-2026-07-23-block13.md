# Übergabe 23.07.2026 — Block 13: Go-Live-Härtung

> Auslieferung als **Pull Request** (kein direkter Push auf main). Gates im Cloud-
> Sandbox gefahren, soweit ohne Secrets möglich (s. Gate-Status). Status strikt
> markiert: **BEWIESEN / UNGETESTET / ANGEFANGEN**.

---

## Schritt 0 (Pflicht-Vorlauf) — gemessen, an JJ gemeldet (BEWIESEN)

| Punkt | Befund (aus dem Code, nicht geraten) |
|---|---|
| **Stripe-Webhook-Pfad** | `/api/webhooks/stripe` (`src/app/api/webhooks/stripe/route.ts`). Verarbeitetes Event: **`checkout.session.completed`** (Zeile 34). → JJ braucht diesen Pfad für Schritt 5C/5D. |
| **Stripe-Env-Variablen** | Genau **`STRIPE_SECRET_KEY`** (`src/lib/stripe.ts`) und **`STRIPE_WEBHOOK_SECRET`** (Webhook-Route). **Kein** `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — der Checkout läuft server-seitig und leitet per `session.url` weiter (`src/app/actions/taler.ts`), kein Stripe-Client-SDK im Bundle. |
| **Resend-Absender** | **Resend ist in `src/` nicht implementiert**: kein `new Resend`, kein `from:`, kein `resend.dev`. E-Mail-Versand existiert nur in Planungs-Docs (`plaene/`). → **Keine `resend.dev`-Absenderadresse aktiv**; nichts zu verifizieren, bis der Mail-Versand tatsächlich gebaut wird. |

---

## Aufgaben 1–7

### 1. Consent-Pflicht in der Registrierung — BEWIESEN (Code) / UNGETESTET (E2E)
- Neue Konstante **`CONSENT_VERSION = '2026-07-23'`** als Single Source in
  `src/lib/consent.ts` (mit Doku, wann sie hochgezogen wird).
- `AuthModal.tsx`: `consent_version: CONSENT_VERSION` in die `signUp`-Metadata
  (`options.data`). Der DB-Trigger `handle_new_user()` liest sie dort aus (bereits
  live eingespielt, Abschnitt 2 des Block-MD) und schreibt je eine Zeile
  `agb` + `datenschutz` nach `user_consents`.
- Die Consent-Checkbox (`register-terms`) + Links auf `/agb` und `/datenschutz`
  waren im Markup bereits vorhanden; ergänzt: **Submit-Button ist ohne Häkchen
  `disabled`** (kein stiller Klick, Lektion 6) mit **sichtbarem Hinweis**
  (`register-terms-hint`: „Setze das Häkchen oben, um die Registrierung
  freizuschalten."). Anhaken schaltet frei, Weghaken sperrt wieder.

### 2. Types regeneriert — BEWIESEN
- Über die **Supabase-MCP** `generate_typescript_types` (project
  `lhqsuelguwfdflapzdhk`) regeneriert. **DB nur gelesen.** Diff = **+`user_consents`**
  (Row/Insert/Update, `Relationships: []`), alphabetisch zwischen `transactions` und
  `wallet_transactions` eingefügt — identisch zum vollen Generator-Output. Alle
  übrigen Tabellen/Functions waren bereits deckungsgleich → kein weiterer Drift.
  **Kein Handedit** (Lektion 11/28).

### 3. Platzhalter-Sweep — BEWIESEN + 1 gemeldeter Fund (JJ-Aktion nötig)
- Repo-weiter Sweep (TODO/PLATZHALTER/Lorem/[Name]/[Adresse]/example.com/Muster…):
  **0 echte Platzhalter** in Code + Legal-Seiten (Impressum/AGB/Datenschutz).
- **⚠️ Fund (Firmendaten → NICHT von mir angefasst, JJ trägt lokal nach):** In
  `src/app/impressum/page.tsx:30` steht die Kontakt-E-Mail **byte-weise rückwärts**:
  `sellehcyes.ssiws@gmail.com` = umgekehrtes `swiss.seychelles@gmail.com`
  (Hexdump-geprüft: **kein** RTL-Steuerzeichen, echte Zeichenumkehr — vermutlich
  unter aktivem RTL-Kontext eingetippt/eingefügt). Name/Anschrift sind korrekt.
  → **JJ: die E-Mail in dieser Zeile korrigieren** (bewusst nicht im PR geändert,
  Regel „Firmendaten NIE im Chat / JJ trägt lokal nach").

### 4. Arabisch/RTL-Sweep + Root-Cause-Fix — BEWIESEN (Code) / UNGETESTET (E2E)
- Sweep (verfeinerte, korrekte Arabisch-Blöcke + RTL-Steuerzeichen, s. Lektion 30):
  **0 arabische Zeichen und 0 RTL-Steuerzeichen in `src/`**. Echte arabische Strings
  existieren nur in `docs/referenz/Uri_V33.html.html` (altes, **nicht ausgeliefertes**
  Prototyp-HTML mit Sprachwähler) — kein App-Code.
- **Root-Cause der „arabischen Schrift beim Foto-Upload":** der **native
  `<input type="file">`** rendert seinen Button-Text vom Browser aus in der
  **OS-Locale** (arabisch auf JJs System), per HTML/CSS nicht setzbar. Es gibt genau
  **2 solche Stellen** (`ChameleonForm.tsx`, `EditListingModal.tsx`) → JJs „2 Stellen".
- **Fix (kein CSS-Verstecken):** neue Komponente `src/components/create/PhotoUploadField.tsx`
  — nativer Input liegt `sr-only` (fokussierbar, a11y-korrekt) in einem `<label>`,
  die sichtbare Fläche ist eine eigene, **komplett deutsch beschriftete**
  Glassmorphism/Gold-Komponente (Design-Referenz: Icon-Kreis, Gold-Sweep beim Hover,
  Upload-Spinner, `n / 5`-Zähler, Zustände „Fotos auswählen / Weiteres Foto / Wird
  hochgeladen / Maximum erreicht"). Beide Call-Sites nutzen sie jetzt. Alle sichtbaren
  Strings gehören uns → keine Fremd-Locale-Chrome mehr.

### 5. `deploy/vercel-env-push.ps1` — BEWIESEN (Logik/Statik) / auf JJs PC auszuführen
- Läuft auf JJs Windows-PC (rein ASCII, PS 5.1-tauglich, Muster wie `deploy-vercel.ps1`).
- **Preflight:** `.env.local` vorhanden (Hard-Guard), Vercel-CLI vorhanden, `vercel
  whoami` (Login), `.vercel/project.json` (Projekt-Link, Lektion 16 — nie erstellen).
  Jeder Fehlpunkt → ROT „FEHLT: X — so beheben: Y" + Abbruch.
- **Filter:** `E2E_*` (Präfix) und lokales Tooling (`SUPABASE_ACCESS_TOKEN`) gehen nie
  zu Vercel; leere Werte werden sichtbar übersprungen.
- **Stripe-Sonderregel:** `STRIPE*` → **NUR `preview` + `development`** (Test-Keys),
  **NIE `production`** (Live-Keys trägt JJ manuell ein). Standard-Variablen →
  production+preview+development.
- **Namen-Vorschau vor dem Push** (nur NAMEN + Ziel-Environments, **keine Werte**),
  `Read-Host "…Tippe JA…"` als Bestätigung; ohne „JA" wird nichts gepusht.
- Push einzeln via `vercel env add NAME env --force`, Wert per **stdin** (nie als
  Argument), Werte in jeder Ausgabe **maskiert**. GRÜN/ROT-Endstatus, `try/finally`
  mit `Start-Transcript` + `Read-Host` am Ende (Lektion 15).

### 6. `e2e/block13-consent.spec.ts` — ANGEFANGEN/UNGETESTET (im Sandbox nicht lauffähig)
Vier Tests, Muster wie block12/block7 (Service-Role-REST, Cleanup vorher/nachher):
- **(a)** Ohne Häkchen: Hinweis sichtbar (`register-terms-hint`, „Häkchen"), Submit
  `disabled`; Anhaken→enabled, Weghaken→disabled; **kein Konto** entsteht (Profil-Query).
- **(b1) UI:** Mit Häkchen wird der Signup wirklich abgeschickt und die **Signup-
  Metadata enthält `consent_version = CONSENT_VERSION`** (am gesendeten Request
  festgemacht → deterministisch, unabhängig vom Auth-Server-Ratelimit).
- **(b2) DB-Trigger:** Wegwerf-User per Admin-API mit `user_metadata.consent_version`
  angelegt → **genau 2 `user_consents`-Zeilen** (`agb` + `datenschutz`), beide mit
  `version === CONSENT_VERSION` und gültigem `accepted_at`-**Zeitstempel** (Service-
  Role-Check).
- **(c) RLS:** Consent von A per Service-Role geseedet → **User B sieht ihn nicht**
  (gezielter Leak-Test = 0, plus „alle für B sichtbaren gehören B"), **Gegenprobe:
  A sieht seinen eigenen** (= 1). Marker-Version für exaktes Cleanup.
- `block7-legal.spec.ts` Test „ohne Zustimmung" nachgezogen (Klick→Fehler ⇒
  Button-disabled + Hinweis; fachliche „kein Konto"-Assertion unverändert, Lektion 31).

### 7. Qualitäts-Gates (Cloud-Sandbox)
- **`npm ci`:** ok (node_modules war im frischen Clone leer).
- **`./node_modules/.bin/tsc --noEmit`: GRÜN (0 Errors)** — BEWIESEN. (Ein erster
  Lauf fand einen echten Typfehler in der Spec: `waitForRequest` liefert `Request`
  mit `.method()`, nicht `.request()` — gefixt.)
- **ESLint (alle geänderten Dateien): GRÜN (0)** — BEWIESEN.
- **`next build`: GRÜN (Exit 0)** — „Compiled successfully", „Linting and checking
  validity of types" bestanden, **9/9 Seiten**, Middleware. Mit **Dummy-
  `NEXT_PUBLIC_*`-Keys** gebaut; **nichts an `.env.local` angelegt** (Lektion 27).
- **Playwright-E2E: UNGETESTET** — der Preflight braucht `.env.local` mit echten
  Supabase-Keys + `E2E_USER_A/B`; existieren im Cloud-Sandbox nicht. → **JJ fährt den
  vollständigen Lauf via `e2e/run-verify.ps1`** auf dem PR-Branch. Bei ROT: Fix-Commits
  auf **denselben** Branch/PR (kein neuer PR). Erst bei grünem Lauf gilt Block 13 als
  fertig (Lektion 26).

---

## Geänderte / neue Dateien
**Neu:** `src/lib/consent.ts`, `src/components/create/PhotoUploadField.tsx`,
`e2e/block13-consent.spec.ts`, `uebergabe-2026-07-23-block13.md`.
**Geändert:** `src/components/auth/AuthModal.tsx` (consent_version + Button-Disable +
Hinweis), `src/types/database.ts` (MCP-Generat: +`user_consents`),
`src/components/create/ChameleonForm.tsx` + `src/components/profile/EditListingModal.tsx`
(nativer File-Input → `PhotoUploadField`), `e2e/block7-legal.spec.ts` (Test nachgezogen),
`deploy/vercel-env-push.ps1` (neu im deploy/-Ordner), `CLAUDE.md` (Lektionen 30/31 + Status).

## Nicht angefasst (bewusst)
- **DB:** nur gelesen (MCP `generate_typescript_types`). Keine Migration, kein Write.
- **Impressum-E-Mail:** reale Firmendaten → JJ korrigiert lokal (s. Aufgabe 3).
- **`docs/referenz/Uri_V33.html.html`:** altes Prototyp-HTML mit arabischem Sprachwähler,
  nicht ausgeliefert — kein App-Code, bewusst unberührt.

## JJ-Restschritte (aus dem Block-MD, nicht Teil dieses PR)
1. **Impressum-E-Mail** in `src/app/impressum/page.tsx:30` korrigieren.
2. `e2e/run-verify.ps1` auf dem PR-Branch laufen lassen (tsc + ESLint + Playwright).
3. `deploy/vercel-env-push.ps1` ausführen (Nicht-Stripe-Variablen nach Vercel).
4. Stripe Live (Abschnitt 5 B–F), Vercel Pro, Anwalts-Freigabe AGB, Live-Smoke.

## Klick-Testliste für JJ
1. Registrieren-Tab: ohne Häkchen ist „Registrieren" ausgegraut, darunter der Hinweis;
   Häkchen setzen → Button aktiv.
2. Inserat erstellen → Foto-Bereich: designter Upload-Button **auf Deutsch** (keine
   fremdsprachige Chrome mehr), Zähler `0 / 5`, nach Upload Vorschau + „Weiteres Foto".
3. Eigenes Inserat bearbeiten (`EditListingModal`) → gleicher deutscher Upload-Button.
4. `/impressum` → Kontakt-E-Mail lesbar korrekt (nach JJ-Korrektur).
