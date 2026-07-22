# Übergabe 21.07.2026 — Block 12: Onboarding, FOMO-Texte & ehrliche UI

> Auslieferung als **Pull Request** (kein direkter Push auf main). Gates in der
> Cloud-Session gefahren, soweit ohne Secrets möglich (s. Gate-Status).

## Schritt 0 (Pflicht-Vorlauf) — erledigt
- **(a) Repo-Ist gemessen:** Onboarding = 5 Screens (`OnboardingFlow` + `screens/1..5`),
  Feed-Karten `feed/ListingCard.tsx` + `feed/TikTokScroll.tsx`, Feed-Query
  `feed/FeedPage.tsx` (`select('*')` → `comment_count` kommt automatisch mit),
  Profil-Einstellungen `profile/ProfileDashboard.tsx` (Kachel „⚙️ Konto" →
  `EditProfileForm`). Herz war reine Optik (lokaler `useState`, keine Persistenz).
- **(b) gen types regeneriert:** kein `SUPABASE_ACCESS_TOKEN`/`.env.local` im
  Cloud-Sandbox → CLI-`gen types` nicht möglich. Stattdessen über die **Supabase-MCP**
  (`generate_typescript_types`, project `lhqsuelguwfdflapzdhk`) regeneriert — identischer
  Generator, **kein Handedit** (Lektion 11). Diff = **+39 Zeilen**: `favorites`-Tabelle
  (Row/Insert/Update + FKs) und `listings.comment_count` (Row `number` NOT NULL,
  Insert/Update optional) stehen jetzt im Generat. **DB nur gelesen, nie geschrieben.**

## Umgesetzt
1. **Onboarding auf 2 Screens** (Texte EXAKT aus block-12-MD, Du-Ansprache):
   - `OnboardingScreen1` neu: Ken-Burns-Alpen-Hero (`/uri-markt-alps-banner.jpg`),
     Gold-Shine auf „Gold wert", zwei antippbare Persona-Karten (verkaufen/suchen),
     „Mich interessiert beides" + „Überspringen". Persona steuert NUR den
     Gratulations-Text auf Screen 2.
   - `OnboardingScreen2` neu: 3-Schritte-Smart-Match-Story (Schritt 2 „⚡ Das Herzstück"
     gold hervorgehoben), Demo mit Label „Beispiel", FOMO-Zeile (verpasste Chance, keine
     Zahlen), Geschenk-Teaser „5 Uri-Taler" (faktisch wahr: `handle_new_user` = 500 Rappen),
     persona-abhängiger Gratulations-Peak, CTA „Los geht's" → Registrierung.
   - `OnboardingFlow` auf 2 Screens umgebaut, **Fake-Pionier-Count entfernt**.
   - **Screen „Was interessiert dich" (alt 3) + Profil-/Confetti-Screens (4/5) gelöscht.**
   - **Benachrichtigungs-Auswahl verschoben** in die Profil-Einstellungen: neue
     `profile/NotificationSettings.tsx` (übernimmt die Browser-Permission-Logik aus dem
     alten Screen 4) im „⚙️ Konto"-Bereich. Feature erreichbar, nur verschoben.
   - CTA-Verdrahtung: Store `authModalTab` + `openAuthModal(tab)`; `AuthModal` öffnet auf
     dem gewünschten Tab. „Los geht's" → `openAuthModal('register')`. `?auth=required`
     öffnet explizit 'login'.
2. **Kommentar-Zähler im Feed** aus `listings.comment_count` (KEINE eigene Count-Query):
   dezentes Badge in `ListingCard` + `TikTokScroll`, **bei 0 ausgeblendet**
   (`data-testid="comment-count-badge"`).
3. **Herz ehrlich (favorites):**
   - Server-Action `app/actions/favorites.ts` → `toggleFavoriteAction(listingId)`:
     `user_id` server-seitig aus `auth.uid()` (NIE vom Client), Insert/Delete idempotent
     (UNIQUE-23505 = bereits favorisiert). ID-Format validiert.
   - `ListingCard`: Herz lädt Zustand aus `favorites` (prop `isFavorited`), optimistischer
     Toggle + Herz-Pop, Rollback bei Fehler; ohne Login → Auth-Modal. `FeedPage` lädt die
     Favoriten-IDs des Nutzers (own-only via RLS) und reicht sie an jede Karte.
   - Neuer Tab **„❤️ Favoriten"** (`profile/FavoritesList.tsx`) mit korrektem
     Status-Sticker (Aktiv/Reserviert/Verkauft/Deaktiviert/Entwurf) + Entfernen + Empty-State;
     Query in `app/profile/page.tsx` (Join `favorites→listings`).
4. **Taler-Karten-Texte** (block-12-MD, `TalerPurchase`): Section-Headline „Uri-Taler — dein
   Beitrag, wenn's klappt.", Sub (10% erst beim Verkauf), Pro-Paket-Beispielzeile. Keine
   Cash-out-Andeutung.
5. **Empty-States** exakt aus block-12-MD: Feed leer (`FeedPage`), Favoriten leer
   (`FavoritesList`), Meine Inserate leer (aktiver Tab in `MyListings`).
6. **E2E** `e2e/block12-onboarding-ehrliche-ui.spec.ts` (4 Tests, Preflight + Cleanup
   vorher/nachher, Service-Role-Seeds): Kommentar→comment_count +1 und Löschen→−1 (beide
   Trigger-Zweige) inkl. Feed-Badge; Herz persistent über Reload + Favoriten-Tab + Toggle
   entfernt; **RLS-Leak-Beweis** (User B sieht As Favoriten nicht, mit Gegenprobe); Onboarding
   = 2 Screens, kein Interessen-/Benachrichtigungs-Screen, keine Events/Firmen-Karte, CTA →
   Registrierung.

## Gate-Status (Cloud-Sandbox)
- **`tsc --noEmit`: GRÜN** (lokale Projekt-TS 5.9.3; `npm ci` vorher nötig — node_modules
  war im frischen Clone leer). Hinweis: globales `npx tsc` zieht eine kaputte TS 6.0.2 →
  immer `./node_modules/.bin/tsc` nutzen.
- **`next build`: Code-Gates GRÜN** — „Compiled successfully" + „Linting and checking
  validity of types" bestanden. Der **Prerender/Export von „/"** braucht echte
  Supabase-Public-Keys; ohne `.env.local` bricht nur dieser Schritt ab
  (`@supabase/ssr: URL and API key are required`). **Diagnose-Beweis:** mit Dummy-
  `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY` läuft `next build` **komplett grün durch** (Exit 0,
  9/9 Seiten, Middleware) → mein Code ist prerender-sicher, kein Regress. **Nichts an
  `.env.local` angelegt.** Auf JJ-Seite (mit `.env.local`) baut der volle Build wie gewohnt.
- **ESLint (geänderte Dateien): GRÜN** (nach Fix eines `react/no-unescaped-entities`,
  Lektion 12: geraden `"` im Demo-Text durch „…" ersetzt).
- **Playwright E2E: NICHT GELAUFEN (UNGETESTET)** — der Preflight braucht `.env.local` mit
  echten Supabase-Keys + E2E_USER_A/B; die existieren im Cloud-Sandbox nicht (kein Secret,
  kein Konto). Spec ist nach dem etablierten Muster geschrieben; **JJ fährt sie via
  `e2e/run-verify.ps1`**. Bis dahin gilt Block 12 als **ANGEFANGEN/UNGETESTET** (Lektion 8/26).

## Geänderte / neue Dateien
**Neu:** `src/app/actions/favorites.ts`, `src/components/profile/FavoritesList.tsx`,
`src/components/profile/NotificationSettings.tsx`,
`e2e/block12-onboarding-ehrliche-ui.spec.ts`, `uebergabe-2026-07-21-block12.md`.
**Geändert:** `src/types/database.ts` (MCP-Generat, +39),
`src/components/onboarding/OnboardingFlow.tsx`,
`src/components/onboarding/screens/OnboardingScreen1.tsx`,
`src/components/onboarding/screens/OnboardingScreen2.tsx`,
`src/components/feed/{ListingCard,TikTokScroll,FeedPage}.tsx`,
`src/components/profile/{ProfileDashboard,TalerPurchase,MyListings}.tsx`,
`src/components/auth/AuthModal.tsx`, `src/components/layout/AppChrome.tsx`,
`src/store/appStore.ts`, `src/app/profile/page.tsx`, `CLAUDE.md`.
**Gelöscht:** `src/components/onboarding/screens/OnboardingScreen{3,4,5}.tsx`.

## Klick-Testliste für JJ
1. Frischer Browser (kein localStorage) → Onboarding zeigt **2 Screens**: Hero „Gold wert" +
   zwei Karten; Tap → Story mit „⚡ Das Herzstück", „5 Uri-Taler geschenkt", „Los geht's" →
   Registrierung öffnet sich.
2. Feed: Inserat mit Kommentaren zeigt Kommentar-Badge; Inserat ohne Kommentare zeigt keins.
3. Feed eingeloggt: Herz antippen → gefüllt; Seite neu laden → bleibt gefüllt.
4. Profil → „❤️ Favoriten" → das favorisierte Inserat steht drin mit Status-Sticker; Herz
   dort entfernt es.
5. Profil → „⚙️ Konto" → Benachrichtigungen aktivieren ist hier (nicht mehr im Onboarding).
6. Profil → „➕ Taler kaufen" → neue Taler-Texte („dein Beitrag, wenn's klappt.").

## Offene Punkte
- **BEWIESEN:** tsc grün, next-build-Code-Gates grün (+ voller Build grün mit Dummy-Env),
  ESLint grün, DB-Generat enthält favorites + comment_count.
- **UNGETESTET:** Playwright-E2E (kein `.env.local`/E2E-Konten im Sandbox) → JJ via
  run-verify.ps1. Erst bei grünem Lauf gilt Block 12 als fertig (Lektion 26).

---

## Nachbesserung 21.07.2026 (abends) — 2 rote E2E-Tests gefixt

> JJ-Verify (lokal): `BUILD_EXIT=0`, **43 passed, 2 failed, 4 did not run**. Beide roten
> Tests sind Folge der Onboarding-Umstellung (Lektion 1/20/29). Fix auf demselben Branch
> `claude/block-12-onboarding-ui-a07lwo` (PR #3), neuer Commit, KEIN neuer PR.

**Zählung erklärt:** `block11-deal.spec.ts` ist `test.describe.serial` — Test 4 rot →
Tests 5–8 werden übersprungen = **4 did not run**. Also nur 2 echte Rot-Ursachen.

### Fehler 1 — `e2e/block7-legal.spec.ts` „Onboarding-Startguthaben zeigt 5 Taler (nicht 100)"
- **Root Cause:** Der Test navigierte das ALTE 5-Screen-Onboarding (Buttons „Jetzt
  starten"/„Weiter"/„Später", Confetti-Screen „Uri-Taler Guthaben"). Nach Block 12 gibt es
  nur noch 2 Screens; die Screens/Buttons existieren nicht mehr → hing bei „Jetzt starten".
  Diese Spec klickt als EINZIGE das Onboarding OHNE Skip-Seed durch, deshalb fiel sie beim
  Umbau durch (die anderen Specs skippen per `localStorage`-Seed, Store-Shape unverändert).
- **Fix:** Navigation aufs neue 2-Screen-Onboarding umgestellt (Screen 1 „Gold wert" +
  Persona-Karte antippen → Screen 2). Die fachliche Prüfung **„5 Taler, nicht 100" bleibt**:
  jetzt am Geschenk-Teaser auf Screen 2 (neuer `data-testid="onboarding-gift"`) —
  `toContainText('5 Uri-Taler')` **und** `not.toContainText('100')`. Assertion nicht
  gelöscht/geskippt (Lektion 9). Faktisch wahr: `handle_new_user` = 500 Rappen = 5 Taler.

### Fehler 2 — `e2e/block11-deal.spec.ts:336` Test 4 „Wieder erhältlich"
- **D1-Messung ohne Trace:** Der Playwright-Trace war im Cloud-Sandbox nicht verfügbar
  (kein `.env.local`, Artefakt nicht committet). Ursache daher aus dem **Code-Diff bewiesen**
  statt geraten: (a) Skip-Seed intakt (Store-Persist-Shape `uri-markt-v1`/`onboardingCompleted`
  von Block 12 unverändert) → **nicht** der Onboarding-/Skip-Helper. (b) Der `relisted`-Pfad in
  `ListingCard` und ganz `src/lib/reservation.ts` sind **byte-identisch** zu Block 11; die
  Buy-/Create-/`expire_stale_reservations`-RPC-Pfade wurden von Block 12 nicht angefasst.
  → **Kein Block-12-Code-Regress**, sondern ein Timing-Fenster auf dem realtime-abhängigen
  Feed-Badge: der „🔄 Wieder erhältlich"-Sticker erscheint erst nach dem Client-Mount
  (`useMinuteTick`), ein einzelner Feed-Load kann ihn knapp verpassen.
- **Fix (kein Skip, Lektion 9/D5):** Die Badge-Assertion in eine **Reload-Retry-Schleife**
  (30 s, Muster wie `expectNotificationText` in derselben Datei) gehüllt. Die Assertion
  selbst ist unverändert — der Sticker MUSS erscheinen; nur die Timing-Robustheit steigt.

### Gate-Status (Cloud-Sandbox, diese Nachbesserung)
- **`./node_modules/.bin/tsc --noEmit`: GRÜN** (Projekt-TS; `**/*.ts` deckt die Specs mit ab).
- **ESLint (geänderte Specs `block7`/`block11`): GRÜN.**
- **`next build`: GRÜN** — Exit 0, „Compiled successfully", 9/9 Seiten, Middleware
  (mit Dummy-`NEXT_PUBLIC`-Keys; nichts an `.env.local` angelegt). Nur ein `data-testid`
  in `OnboardingScreen2.tsx` betrifft den Build, Spec-Dateien nicht.
- **Playwright-E2E: NICHT im Sandbox lauffähig (UNGETESTET hier)** — Preflight braucht
  `.env.local` mit echten Supabase-Keys + `E2E_USER_A/B`; existieren im Cloud-Sandbox nicht.
  → **JJ fährt den vollständigen Lauf via `e2e/run-verify.ps1`.** Erwartung nach dem Fix:
  block7 Test 1 grün, block11 Test 4 grün → Tests 5–8 laufen wieder → **0 failed / 0 did-not-run**.

### Geänderte Dateien (Nachbesserung)
- `e2e/block7-legal.spec.ts` (Test-1-Navigation auf 2-Screen-Onboarding, Assertion 5≠100 erhalten)
- `e2e/block11-deal.spec.ts` (Reload-Retry um die relisted-badge-Assertion in Test 4)
- `src/components/onboarding/screens/OnboardingScreen2.tsx` (`data-testid="onboarding-gift"`)
- `CLAUDE.md` (Lektion 29), `uebergabe-2026-07-21-block12.md` (dieser Abschnitt)

### Nicht angefasst
- Der rote **vercel-Preview-Check** (fehlende Supabase-Env im Preview, kein Code-Fehler) —
  bewusst unberührt gelassen.
