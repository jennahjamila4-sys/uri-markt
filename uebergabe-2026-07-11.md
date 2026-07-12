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


---

## ✅ Block 2 — Öffentliche Bewertungen (Commit `5e36835`, Doku-Commit folgt)
**Arbeitsmodus ab hier (JJ-Vorgabe, bindend):** Claude schreibt Code + fährt `tsc`
selbst. Build + E2E laufen NICHT hier (Umgebungslimit, s.u.) — JJ führt pro Block EINEN
PowerShell-Befehl aus und meldet nur `BUILD_EXIT/PW_EXIT` (+ letzte 30 Zeilen bei Rot).
Abhaken im Masterplan NUR nach von JJ gemeldetem Grün. Kein Push ohne JJ-OK.

- Neu `src/components/profile/ReviewList.tsx`: präsentationale, serverfähige Liste
  (Sterne, Datum dd.MM.yyyy, Kommentar, sauberer Leerzustand `data-testid=reviews-empty`,
  „Gelöschter Nutzer" wenn Reviewer null). testids: reviews-list, review-item.
- `src/app/profile/[username]/page.tsx`: lädt Einzelbewertungen (reviews, öffentlich
  lesbar) mit Reviewer-Join `reviewer:profiles!reviews_reviewer_id_fkey`; robustes
  Array/Objekt-Flatten; `profile-avg-rating` testid. Durchschnitt + Anzahl (bestehend) +
  Liste (neu).
- `src/components/listing/ListingDetail.tsx`: Verkäufer-Rating (⭐ + avg_rating) in der
  Verkäufer-Zeile, `data-testid=seller-rating`. avg_rating null → „0.0" (keine erfundene Zahl).
- E2E `e2e/block2-reviews.spec.ts` (3 Tests, self-contained: seedet Reviews für A via
  Service-Role, B bewusst leer, seedet 1 Listing für Verkäufer-Rating; räumt per
  `E2E-REVIEWS%`/`E2E-TEST-REVIEWS%` wieder ab). **Von JJ GRÜN gemeldet: BUILD_EXIT=0
  PW_EXIT=0, 3 passed.**
- DB verifiziert (D1): reviews RLS „public select" ok; UNIQUE(reviewer_id, transaction_id)
  → Seeds mit transaction_id null kollidieren nie; keine Check-Constraint auf rating.

### ⚠️ WICHTIGE UMGEBUNGS-ERKENNTNISSE (für jede Folge-Session lesen)
1. **Shell-Limit 45s pro Befehl, keine Hintergrundprozesse** (Sandbox `--die-with-parent`).
   `next build` (Webpack-Compile allein >45s) und Playwright-E2E laufen daher NICHT hier —
   nur `tsc --noEmit --incremental` (~21s) ist lokal machbar. Deshalb der JJ-Verify-Flow.
2. **Windows-Mount erlaubt kein `unlink`, nur `rename`.** Folgen: `git checkout -- .`
   scheitert; git hinterlässt Stale-`*.lock` (index.lock/HEAD.lock), die den nächsten
   git-Befehl blockieren. Workaround: Locks per `mv .git/index.lock .git/stale.$$`
   wegräumen (rename geht). git commit/add funktionieren (rename-basiert).
3. **Die Datei-Tools (Write/Edit) schneiden auf dem Mount an bestimmten Emoji-Bytes
   (z.B. ⭐ U+2B50) ab bzw. syncen nicht immer** (mein `.gitignore`-Edit landete nicht).
   → Quellen mit Sonderzeichen per bash-Heredoc schreiben und Bytes verifizieren
   (`python3 -c` lines/bytes/ends-with-brace). Emojis wo möglich als `\u{...}`-Escape.
4. **git-Identität** war leer → lokal auf `jennahjamila4-sys / jennahjamila4@gmail.com`
   gesetzt (aus bestehenden Commits übernommen).
5. **gen types CLI** geht nicht (npm-Registry 403 auf `supabase`). Ersatz: Supabase-MCP
   `generate_typescript_types` → gegen `database.ts` verifiziert, **kein Drift** (Vorab-
   Schritt erledigt, nichts zu ändern).

### Verify-Infrastruktur (neu, committet)
- `e2e/verify.ps1 [spec]` → `npm run build` dann `npx playwright test [spec]`, Ausgabe
  `BUILD_EXIT=n PW_EXIT=n` (+ letzte 30 Zeilen bei Rot). Per-Block-Tool.
- `e2e/run-verify.ps1` → wie oben, aber grosses farbiges GRUEN/ROT, Fenster bleibt offen.
- `e2e/install-shortcut.ps1` → legt Desktop-Verknüpfung „Uri-Markt Verify" an (einmalig).

## ✅ Block 3 — Listing verwalten (Commit `c7f1352`, JJ-Verify GRÜN: BUILD_EXIT=0 PW_EXIT=0)
**Arbeitsmodus:** Claude schreibt Code + fährt `tsc` selbst (grün, Exit 0). Build + E2E
laufen NICHT hier (Umgebungslimit) — JJ fährt `Uri-Markt Verify` und meldet
`BUILD_EXIT/PW_EXIT`. Masterplan-Haken erst nach gemeldetem GRÜN. Kein Push.

**Live-DB verifiziert (D1/Lektion 4):** listings.status hat KEINEN CHECK-Constraint;
real vorhanden active/sold. RLS: `listings_update_own` + `listings_delete_own` (nur
Besitzer) vorhanden → Edit/Deaktivieren via UPDATE gedeckt. `updated_at` wird vom
Trigger `set_fomo_on_sold` (BEFORE UPDATE) bei JEDEM Update gesetzt. Status-Maschine
aus den RPCs bewiesen: `create_buy_intent` verlangt status='active' → setzt 'reserved';
`complete_transaction` setzt 'sold'. **Keine `favorites`-Tabelle** → Favoriten als
eigener Block ausgelagert (nicht trivial), notiert in `docs/manage-listings.md`.

**Umgesetzt:**
- `src/app/actions/listings.ts`: `updateListingAction` (typ-genau Angebot/Gesuch),
  `setListingActiveAction` (active⇄cancelled), `deleteListingAction` gehärtet. Alle
  Schreibpfade **atomar status-gesichert** (Status-Filter im UPDATE/DELETE, kein
  Read-then-Write-Race); auf 0-Zeilen frischer Status-Read → präzise Begründung
  (`explainBlockedListingAction`). Regel: bearbeiten/deaktivieren/löschen nur bei
  active/cancelled; reserved → „Deal läuft", sold → gesperrt (Nachweis).
- `src/components/profile/EditListingModal.tsx` (neu): typ-abhängiges Edit-Formular,
  Foto-Tausch, sichtbare Feldfehler; reuse `AngebotSchema`/`GesuchSchema`.
- `src/components/profile/MyListings.tsx`: Tabs Aktiv/Reserviert/Verkauft/**Deaktiviert**,
  pro Zeile Bearbeiten / Deaktivieren·Reaktivieren / **Löschen mit Bestätigungsdialog**,
  sichtbarer Sperr-Grund (Lektion 6). testids: my-listing-row, listing-edit-btn,
  listing-toggle-active-btn, listing-delete-btn, listing-delete-confirm-btn,
  listing-blocked-reason.
- `src/components/listing/DealFlow.tsx`: deaktiviertes Inserat → „nicht verfügbar"
  statt Kaufen (create_buy_intent blockt serverseitig ohnehin).
- Doku: `docs/manage-listings.md` (neu). E2E: `e2e/block3-manage.spec.ts` (4 Tests,
  self-contained, Seed/Cleanup Service-Role `E2E-BLOCK3%`).

**Verify-Zyklus:** Lauf 1 rot (2 Fails) — reine Test-Selektor-Ambiguität, KEIN Produktbug
(D1 am Playwright-Log gemessen): `name:'Aktiv'` traf per Teilstring auch Deaktiviert/
Reaktivieren; `getByText(/Reserviert/)` traf Badge + Sperr-Grund. Nur Selektoren
geschärft (exact / gezielt auf Testid), Produktcode unverändert (Lektion 9). Spec danach
ASCII-only per Heredoc geschrieben (Edit-Tool schnitt an `→` ab, Übergabe-Notiz 3).
Lauf 2 GRÜN. Masterplan §3 abgehakt (`c7f1352`).

**Nächster Schritt:** Neue Session, Block 4.

## DANACH: Block 4 (Profil & Konto: Zahlungsangaben-Validierung, Taler-Historie, Konto-Löschung)

## ✅ Block 4 — Profil & Konto (Commit `7dd55d9`, JJ-Verify GRÜN: BUILD_EXIT=0 PW_EXIT=0)
**Arbeitsmodus:** Code + `tsc` selbst (grün). Build + E2E via `Uri-Markt Verify` bei JJ.
DB-Operationen/Verifikation im Planungs-Chat (Supabase-MCP). Kein Push.

**Live-DB verifiziert (D1, keine Migration nötig):**
- Zahlungsangaben liegen in `profiles_private` (iban, twint_phone, phone, address +
  show_*-Flags), RLS: nur Eigentümer liest/schreibt. War bereits fertig implementiert
  (swiss.ts Mod-97 + Tests, PaymentInfoForm, savePaymentInfoAction) → nur verifiziert.
- Taler-Historie: `wallet_transactions`, RLS `wallet_select_own`. Reale Typen aktuell
  nur `commission` (negativ) / `commission_refund` (positiv); Topups kommen erst Block 6
  → UI rendert generisch über Typen.
- Konto-Löschung: gesamte FK-Kette geprüft — `auth.users`→CASCADE zu profiles/
  profiles_private; von profiles alles CASCADE oder SET NULL, **kein RESTRICT** →
  `auth.admin.deleteUser` läuft garantiert durch. `transactions`-SELECT-Policy =
  `buyer_id OR seller_id` → Offene-Deals-Zählung stimmt unter Nutzer-Session.

**Umgesetzt:**
- `src/lib/supabase/admin.ts` (neu): Service-Role-Client, NUR Server (Konto-Löschung).
- `src/app/actions/profile.ts`: `updateProfileAction` (Name/Gemeinde/Kategorien,
  user_id serverseitig) + `deleteAccountAction` (offene Deals pending/confirmed als
  Käufer ODER Verkäufer → blockiert mit sichtbarer Begründung, Lektion 6; sonst
  admin.deleteUser). savePaymentInfoAction unverändert.
- `src/lib/validations/profile.ts`: `EditProfileSchema` (Gemeinde nur aus GEMEINDEN-Liste).
- `src/components/profile/EditProfileForm.tsx`, `TalerHistory.tsx`,
  `DeleteAccountSection.tsx` (zweistufig: Wort „LÖSCHEN" tippen; Erfolg → signOut +
  Redirect). ProfileDashboard: neue Kacheln „Taler-Historie" + „Konto".
- `src/app/profile/page.tsx`: lädt wallet_transactions (RLS own) und reicht sie durch.
- E2E `e2e/block4-account.spec.ts` (4 Tests, self-contained, Seed/Cleanup Service-Role
  `E2E-B4%`): Profil-Edit persistiert (DB+F5); Taler-Historie mit Vorzeichen;
  Löschung blockiert bei offenem Deal (Grund sichtbar, Konto bleibt); Löschung eines
  Wegwerf-Users erfolgreich (Redirect + Profil weg + Re-Login schlägt fehl).

**Verify-Zyklen (D1/D3, ehrlich dokumentiert):**
- Zyklus 1 ROT (BUILD_EXIT=1): rohes `"` in JSX-Text (DeleteAccountSection) — `next build`
  fährt ESLint (`react/no-unescaped-entities`), `tsc` sieht das nicht. Fix: deutsches
  „…" (U+201C), Regel NICHT deaktiviert. → **Lektion 12** ergänzt. Beweis: `eslint` auf
  allen 8 Dateien grün.
- Zyklus 2 ROT (PW_EXIT=1, 11/12): T4 erwartete nach Löschung URL `auth=required`, real
  war `/`. **D1-Messung:** kein Produktbug — `/profile`→`redirect('/?auth=required')`,
  `AppChrome` öffnet Login-Modal und entfernt den Param per replaceState (URL→`/`).
  Falsch war die Test-Erwartung (transienter Param), nicht der Code (Lektion 9 erfüllt).
  Fix nur im Test: prüft jetzt offenes Login-Modal + weg von /profile + DB-Beweise.
- Zyklus 3 GRÜN: BUILD_EXIT=0 PW_EXIT=0.

**Nächster Schritt:** Neue Session, Block 5 (Kommentar-UI auf Listing-Detail;
comments-Tabelle existiert, Spalte `content`).
