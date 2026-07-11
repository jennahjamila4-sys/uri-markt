# Übergabe 11.07.2026 — Autopilot-Session (Block 0 + Block 1)

**Arbeitsweise:** Autopilot laut Startnachricht. CLAUDE.md ## Lektionen zuerst lesen
(jetzt 1–10). Kein Push ohne JJ-OK. D1–D5 gelten. Workaround-Sperre (Lektion 9):
Tests, die echte Bugs aufdecken, werden NICHT umgebaut — erst Root-Cause-Fix.

---

## ✅ BEWIESEN & ABGESCHLOSSEN

### Block 0 — DB-Types + nullable-Fixes + AUTH-DIAG raus (Commit `028ea30`)
- `src/types/database.ts` frisch via `supabase gen types` generiert (Schema-Drift weg).
- Notifications-Konsumenten aufs echte Schema gezogen: `recipient_id`/`is_read`/
  `title`/`message`/`listing_id` statt `user_id`/`read`/`payload` (useNotifications,
  NotificationPanel). War ein echter Laufzeit-Bug (400) — Lektion 1.
- transactions.ts: RPC-Json-Rückgaben typisiert; nullable FKs (buyer/seller/
  listing_id) mit Guards; Bewertungs-Unique (23505) als klare Meldung; Comment-Insert
  auf `content`. reviewee_id-Null-Guard („Gegenpartei nicht mehr vorhanden").
- listings.ts: smart_matches ohne nicht existierendes `dismissed_at`.
- Listing-Selects auf `*` (robust gegen neue Spalten).
- `[AUTH-DIAG]`-Logs entfernt (D5). tsc 0, build 0 (Middleware aktiv), 14 Unit-Tests grün.

### E2E-Infrastruktur
- `e2e/setup-users.mjs` umgebaut: legt die 2 Test-Accounts über die **Admin-API** an
  (`email_confirm: true`), weil (a) GoTrue MX-lose Fantasie-Domains als „invalid"
  ablehnt und (b) E-Mail-Bestätigung im Projekt aktiv ist + E-Mail-Rate-Limit.
  Deshalb **kein** STOPP-PUNKT 1 nötig. Accounts:
  `jennahjamila4+e2ea@gmail.com` (Verkäufer A), `jennahjamila4+e2eb@gmail.com` (Käufer B).
  Passwörter NUR in `.env.local` (E2E_USER_A/B_*), nie geloggt. Beide Login OK,
  Profile existieren, `credits: 500` (= 5 Taler, bestätigt neues Startguthaben).
- `playwright.config.ts`: `next start -p 3100`, 1 Worker, testDir `e2e`.
- vitest schließt `e2e/**` aus (eigener Runner).

### Block 1 — Beidseitiger Deal-Flow E2E GRÜN (`e2e/deal-completion.spec.ts`)
Ein Lauf, headless chromium, deckt die JJ-Testliste ab:
1. A (Verkäufer) erstellt Gratis-Angebot „E2E-TEST …". B (Käufer) kauft (Zahlungsweg
   + Kontakt + Zustimmung).
2. A bestätigt → Reservierung; A sieht B's Kontakt (Kontakt NUR bei confirmed).
3. B sieht confirmed-Zustand + „Übergabe bestätigen"; bestätigt zuerst →
   „Wartet auf Gegenseite" (nach Reload F5-fest).
4. A bestätigt Übergabe → completed; Bewertungs-Modal öffnet automatisch; A bewertet.
5. B sieht „Abgeschlossen" + bewertet genau 1×; nach Reload „Bewertet – merci",
   kein Bewerten-Button mehr.
6. Zweiter Bewertungsversuch (direkter Insert mit Käufer-JWT) wird DB-seitig
   abgelehnt (unique) — Backstop hinter dem App-Precheck.
- Test räumt eigene Test-Inserate vor/nach dem Lauf per Service-Role wieder ab.
- **Caveat (ehrlich):** Gratis-Listing → Provision = 0. Der Provisions-RPC-Pfad läuft,
  aber die **Höhe** (10 % auf einen echten Betrag) ist damit NICHT bewiesen. Foto-Upload
  (PNG+JPG) und Status-Sticker RESERVIERT/VERKAUFT im Feed sind ebenfalls NICHT im
  E2E abgedeckt → im Masterplan bewusst offen gelassen.

### 🐛 Root-Cause-Fix: Session-Verlust nach Navigation (echter Produktbug)
**Symptom:** Nach jeder Voll-Navigation wirkte der eingeloggte Nutzer ausgeloggt
(Header „Anmelden"), obwohl Cookie da war.
**Messung (D1, per Diagnose-Spec, wieder entfernt):**
- (A) direkt nach Login, selbe Seite → eingeloggt.
- (B) `/profile` (serverseitig geschützt) → **HTTP 200, kein Redirect** ⇒ Server/
  Middleware sehen die Session. **Middleware ist NICHT die Ursache** (entspricht dem
  offiziellen `getAll`/`setAll`-Pattern, ruft `getUser()`, schreibt Response-Cookies).
- (C) nach Navigation → Client „Anmelden". `onAuthStateChange` feuerte `SIGNED_IN`
  (Session da), aber die anschließende `profiles`-Query **löste nie auf**.
**Bewiesene Ursache:** `useAuth` rief `await supabase.from('profiles')…` DIREKT im
`onAuthStateChange`-Callback. supabase-js hält im Callback den Auth-Lock
(`navigator.locks`); der PostgREST-Call braucht intern `getSession()` → denselben
Lock → **Deadlock**.
**Fix (2 Teile, Root-Cause):**
1. `src/hooks/useAuth.ts`: Profil-Laden mit `setTimeout(…,0)` aus dem Callback
   herausgeschoben; Query-Fehler kippen die Session nicht mehr auf null (Lektion 7).
2. `src/lib/supabase/client.ts`: Browser-Client als **Singleton** (verhindert
   mehrere GoTrue-Instanzen + Refresh-Token-Race).
**Beweis:** Diagnose (C) danach eingeloggt; kompletter Deal-Flow-E2E grün.
→ Als **Lektion 10** in CLAUDE.md dokumentiert.

---

## 📋 STATUS / NÄCHSTE BLÖCKE (Reihenfolge der Startnachricht)
- Block 0 ✅, Block 1 ✅ (E2E grün, tsc+build 0, vitest grün).
- Offen: Block 2 (öffentliche Bewertungen), 3 (Listing verwalten), 4 (Profil/Konto/
  Konto-Löschung), 5 (Kommentar-UI), 6 (Stripe-Taler-Kauf — STRIPE_WEBHOOK_SECRET in
  .env.local noch LEER → für Block 6 relevant), 7 (5-Taler-Texte + Rechtsseiten),
  8 (Vercel-Deploy-Vorbereitung).

## 🔄 ANGEFANGEN / Nachzuhalten
- **`src/types/database.ts`**: Die früheren Hand-Edits (u.a. 3-Argument-RPC
  `create_buy_intent`) wurden in Block 0 durch einen frischen `npx supabase gen types`
  (SUPABASE_ACCESS_TOKEN aus `.env.local`, Exit 0) **komplett ersetzt** — die Datei ist
  aktuell reines Generat, kein Hand-Edit mehr, Drift beseitigt. Regel ab jetzt
  (Lektion 11): NIE von Hand editieren; nur via `gen types` regenerieren. Falls
  `gen types` mal nicht läuft (fehlender Access-Token) → STOPP-Punkt, JJ melden,
  Planungs-Chat verifiziert Live-Signatur per MCP.

## ⚠️ Offene Punkte / Schulden
- E2E deckt Foto-Upload, Feed-Status-Sticker und echte 10%-Provision (bezahltes
  Listing) NICHT ab — bei Bedarf später ergänzen.
- STRIPE_WEBHOOK_SECRET fehlt (leer) — STOPP-PUNKT 2 erst bei Block 6.
- Deal-Flow bewusst mit Gratis-Listing getestet (kein Taler-Bedarf), wie vom
  Planungs-Chat vorgesehen.

## Arbeitsteilung (unverändert)
- DB-Migrationen NUR Planungs-Chat. Kein git push ohne JJ-OK. D1–D5, Lektionen 1–10.
