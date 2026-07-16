# Vercel-Deploy — Anleitung für JJ (Block 8)

Stand: 16.07.2026. Quelle der Env-Liste: Repo-Suche nach `process.env.` (nicht Gedächtnis).

---

## 1. Env-Variablen (exakt diese, aus dem Code)

Alle in Vercel unter **Project → Settings → Environment Variables** eintragen,
Environment: **Production** (und Preview, wenn gewünscht).

### Pflicht — ohne diese läuft die App nicht

| Variable | Server/Client | Herkunft | Hinweis |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client + Server | Supabase-Dashboard → Settings → API → Project URL | Wert wie in `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client + Server | Supabase-Dashboard → Settings → API → anon public | Wert wie in `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | NUR Server | Supabase-Dashboard → Settings → API → service_role | Geheim! Nie mit `NEXT_PUBLIC_` |
| `STRIPE_SECRET_KEY` | NUR Server | Stripe-Dashboard → Developers → API keys | Testphase: `sk_test_…`; Go-Live: Restricted Key `rk_live_…` |
| `STRIPE_WEBHOOK_SECRET` | NUR Server | Stripe-Dashboard → **NEUER** Webhook-Endpoint (siehe Abschnitt 2) | ⚠️ NICHT das lokale CLI-`whsec_` |
| `NEXT_PUBLIC_APP_URL` | Client + Server | selbst festlegen | Produktions-URL ohne Slash am Ende, z. B. `https://uri-markt.vercel.app` |

### Aktuell NICHT nötig (im Code noch nicht verwendet — erst bei den jeweiligen Blöcken setzen)

| Variable | Wofür geplant |
|---|---|
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Wird aktuell nicht verwendet (Checkout läuft per Redirect, ohne Stripe.js) |
| `ANTHROPIC_API_KEY` | KI-Features (Phase 3) |
| `RESEND_API_KEY` | E-Mail-Versand (Phase 3/4) |
| `QR_SIGNING_SECRET` | Event-Tickets/QR (Phase 3) |

`SUPABASE_ACCESS_TOKEN` und alle `E2E_*`-Variablen sind reine Entwicklungs-/Test-Werte —
**niemals** in Vercel eintragen.

---

## 2. Stripe: neuer Webhook-Endpoint für Produktion

Das lokale `whsec_…` stammt von der Stripe-CLI und gilt NUR lokal. Für Vercel:

1. Stripe-Dashboard öffnen → **Developers → Webhooks → Add endpoint**
2. Endpoint-URL: `https://<deine-domain>/api/webhooks/stripe`
   (z. B. `https://uri-markt.vercel.app/api/webhooks/stripe`)
3. Event auswählen: `checkout.session.completed`
4. Speichern → den angezeigten **Signing secret** (`whsec_…`) kopieren
5. Diesen Wert in Vercel als `STRIPE_WEBHOOK_SECRET` eintragen (Abschnitt 1)

---

## 3. Supabase: Auth-URLs eintragen

Supabase-Dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://<deine-domain>` (z. B. `https://uri-markt.vercel.app`)
- **Redirect URLs** (beide eintragen):
  - `https://<deine-domain>/auth/callback` ← der im Code verwendete Callback-Pfad
  - `http://localhost:3000/auth/callback` ← damit lokale Entwicklung weiter funktioniert

Der Pfad `/auth/callback` ist aus dem Code gelesen
(`src/app/auth/callback/route.ts`, verwendet von der Registrierung).

---

## 4. Vercel-Projekt anlegen (Klickschritte)

1. https://vercel.com öffnen und anmelden (mit dem GitHub-Konto, das Zugriff auf
   `jennahjamila4-sys/uri-markt` hat)
2. **Add New… → Project** klicken
3. In der Repo-Liste `uri-markt` suchen → **Import** klicken
   (falls das Repo nicht erscheint: **Adjust GitHub App Permissions** → Repo freigeben)
4. Framework wird automatisch als **Next.js** erkannt — nichts ändern
5. **Environment Variables** aufklappen → alle 6 Pflicht-Variablen aus Abschnitt 1
   eintragen (Name + Wert, je Zeile eine)
   - `NEXT_PUBLIC_APP_URL` beim allerersten Deploy: die Vercel-Standard-Domain
     eintragen (`https://uri-markt.vercel.app` — der genaue Name steht nach Schritt 3
     oben im Import-Dialog als Projektname)
   - `STRIPE_WEBHOOK_SECRET`: erst nach Abschnitt 2 verfügbar — falls noch nicht
     vorhanden, vorläufig das lokale `whsec_` eintragen und **nach** dem ersten Deploy
     durch das echte ersetzen (dann **Redeploy**, siehe Schritt 8)
6. **Deploy** klicken → warten bis „Congratulations" erscheint
7. Die echte Domain notieren (steht oben auf der Projektseite) → damit:
   - Abschnitt 2 (Stripe-Webhook) durchführen
   - Abschnitt 3 (Supabase-URLs) durchführen
   - `NEXT_PUBLIC_APP_URL` in Vercel korrigieren, falls die Domain anders lautet
8. Nach jeder Env-Änderung: Projektseite → **Deployments** → oberstes Deployment →
   Menü „⋯" → **Redeploy** (Env-Werte wirken erst nach einem neuen Deploy)

---

## 5. Nach dem Deploy: Smoke-Test (5 Klicks, wie D4)

Auf der echten Domain: 1) Login → Profil-Icon oben rechts, 2) „+" → Formular öffnet,
3) Profil → Dashboard, 4) F5 → eingeloggt bleiben, 5) „Kaufen" auf fremdem Inserat →
Formular öffnet. Zusätzlich: 1 Taler-Testkauf (Stripe-Testkarte 4242 4242 4242 4242)
→ Guthaben steigt genau 1×.

---

## Anhang: Warum es ein `vercel.json` gibt

`vercel.json` mit `"regions": ["cdg1"]` (Paris): Die Supabase-DB läuft in **EU Paris**.
Ohne diese Einstellung deployt Vercel die Server-Funktionen standardmässig nach
Washington (iad1) — jeder DB-Zugriff hätte dann ~80–100 ms Umweg über den Atlantik,
bei mehreren Queries pro Request spürbar langsam. Zudem bleiben so alle
Datenverarbeitungen in der EU (Datenschutz-Doku nennt bereits „Vercel" als Empfänger).
Sonst enthält die Datei nichts — Next.js 15 App Router braucht keine weitere Konfiguration.
