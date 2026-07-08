# Uri-Markt — Übergabe 07.07.2026 (Bug-Session A–D, E offen, Build blockiert)

> Kontext: JJ ist nicht-technisch, testet nur Ergebnisse. Root-Cause statt Workaround.
> Live-DB = Wahrheit. Kein Push/Commit ohne grünes Gate + ausdrückliches OK.
> Verbindliche Referenz: `plaene/phase-2-kern-features.md` (v2). Regeln D1–D5 (CLAUDE.md).

---

## 0. EXAKTER ERSTER SCHRITT MORGEN

> **Fix #2 zuerst:** In `src/app/profile/page.tsx` die `sellerTransactions`-Query von `.in('status', ['pending','confirmed'])` auf `['pending','confirmed','completed']` erweitern UND in `src/components/listing/SellerDashboard.tsx` einen „🏆 Abgeschlossen"-Zustand rendern (analog `BuyerDashboard`, ohne Kontaktdaten/Buttons). Das fixt **zugleich Bug #1** (Bewertungs-Modal): die Verkaufsliste ist dann nach Abschluss nicht mehr leer → der `if (transactions.length === 0) return`-Early-Return greift nicht mehr, und das `ReviewModal` (steht im JSX **nach** diesem Return) bleibt gemountet. Danach: JJ testet (D3). Erst dann Bug #3 messen/fixen.

**Reihenfolge:** Fix #2 (+#1) → JJ-Test → Bug #3 (Messung fertigstellen, dann Fix) → JJ-Test → Debug-Instrumente entfernen → `tsc` + `build` grün → WIP-Commit (kein Push ohne JJ-OK).

_(Der frühere Build-Blocker `/auth/callback` und die Aufgaben C/D/E/F/G/H/I sind erledigt — siehe Abschnitte 4 & 5.)_

---

## 1. WAS HEUTE PASSIERT IST (Bug-Session A–E)

Vorgehen strikt nach D1–D5: pro Aufgabe erst messen/beweisen, dann höchstens **ein** Fix, dann JJ-Test.

### A — Gesuch erscheint nicht im Gesuche-Tab → NICHT REPRODUZIERBAR, kein Fix (D1)
- **Symptom (gemeldet):** erstelltes Gesuch taucht im Gesuche-Tab nicht auf.
- **Bewiesene Ursache:** keine. Messung widerlegt den vermuteten `type`-Mismatch:
  - Schreibwert = `'Gesuch'` (`src/app/actions/listings.ts:66`), Tab-Filterwert = `'Gesuch'` (`TypeTabs.tsx:7`, `.eq('type', selectedType)` in `FeedPage.tsx`).
  - **Live-DB (anon-Rolle):** beide Gesuch-Zeilen stehen mit exakt `type="Gesuch"`, `status="active"` in der DB; der exakte Tab-Query `.eq('type','Gesuch').in('status',['active','sold'])` **liefert sie zurück**.
- **Fix:** keiner (kein Fix auf Verdacht, D1). Vermutlich bereits durch frühere `feedVersion`-Arbeit erledigt.
- **JJ-Gegentest:** ✅ „beide erscheinen".
- **Offene Folgefrage:** keine.

### B — Nach F5 zeigt Header „Anmelden" trotz eingeloggt → NICHT REPRODUZIERBAR, kein Fix
- **Symptom (gemeldet):** nach F5 eingeloggt, aber Header-Button = „Anmelden".
- **Messung (Code):** Header, `AppChrome`, `ProfileMenu` lesen **dieselbe** Quelle (Zustand-Store via `useAuth()` → `useAppStore(s => s.user)`). Store-`user` wird nicht persistiert (nur `onboardingCompleted`, `appStore.ts:82`) → nach F5 muss `useAuth` ihn neu befüllen. Zweite Quelle = serverseitige Session (Cookies), die Middleware/Server-Client korrekt refreshen.
- **JJ-Gegentest:** ✅ „nach F5 zeigt Header korrekt Profil" — alle 4 Debug-Panel-Zeilen grün. Nicht mehr reproduzierbar (vermutlich gleiche Wurzel wie A).
- **Fix:** keiner (D1).
- **Offene Folgefrage:** keine.

### C — Inserate erscheinen doppelt im Feed → GEFIXT
- **Bewiesene Ursache:**
  - **DB-Messung (anon):** genau **1** aktives Angebot, **keine** Query-Duplikate, **kein** Doppel-Insert (0 Zeilen gleicher type+title+user). → Verdopplung ist rein clientseitiger State.
  - **Code-Beweis:** einziger *anhängender* `setListings`-Pfad ist der Infinite-Scroll-Observer (`FeedPage.tsx:72`, `setListings(prev => [...prev, ...data])`). Er lud **Seite 1 erneut**, solange `cursor === null` (beim Mount ist die Sentinel sofort sichtbar) und hängte die bereits vorhandenen Server-Inserate ein zweites Mal an.
- **Fix (ein Guard):** Observer feuert nur noch bei gesetztem `cursor` → lädt ausschließlich *weitere* Seiten, nie Seite 1. Erste Seite lädt allein der Initial-Load-Effekt. (`FeedPage.tsx`, Guard `&& cursor` in der Observer-Callback-Bedingung.)
- **Status:** `tsc` grün. **JJ hatte in-Session „keine Dopplung mehr" bestätigt**, ABER die spätere D-Änderung hat dieselben Feed-Dateien nochmals angefasst → **C ist noch nicht final im aktuellen Stand gegengetestet**. Morgen C+D zusammen testen.

### D — Reservierte Inserate → Fix angewandt, von JJ NOCH NICHT getestet
- **Bewiesene Ursache:** Server-Query (`page.tsx:23`) und beide Client-Queries (`FeedPage.tsx`) filterten auf `['active','sold']` → reservierte Inserate verschwanden **komplett** aus dem Feed (keine Kennzeichnung). Kaufen-Button war für `reserved` **bereits** gesperrt (`DealFlow.tsx:37` zeigt „⏳ Bereits reserviert" statt Kaufen-Button) — dort kein Eingriff.
- **Fix (kohärent, ein Verhalten „reserved sichtbar + gekennzeichnet"):**
  - `reserved` in alle **3** Feed-Queries aufgenommen (`src/app/page.tsx`, `src/components/feed/FeedPage.tsx` ×2) → `['active','reserved','sold']`.
  - „⏳ RESERVIERT"-Sticker in `ListingCard.tsx` (amber Overlay) und `TikTokScroll.tsx` (amber Badge); FOMO-Live-Zähler bei reservierten Angeboten unterdrückt (`!isSold && !isReserved`).
- **Status:** `tsc` grün. **JJ-Test steht aus.** Erwartung: reserviertes „Kinderkleider"-Angebot erscheint mit Sticker; Detail zeigt „⏳ Bereits reserviert" ohne Kaufen-Button.

### E — Deal-Sichtbarkeit im Profil → OFFEN (nicht begonnen)
Kompletter Auftrag, wie erhalten (umsetzen **nur** über die im Phase-2-Plan definierten RPCs, kein Neubau von Logik):
1. **Verkäufer** sieht offene Kaufanfragen — `transactions` mit `status='pending'` auf eigene Inserate — mit **Bestätigen/Ablehnen**. Bestätigen läuft **ausschließlich** über die RPC `process_transaction_commission` (atomarer Provisions-Abzug).
2. **Käufer** sieht seine Käufe mit Status:
   - „Wartet auf Bestätigung" (`pending`),
   - „Bestätigt" inkl. Kontaktdaten **nur** via RPC `get_transaction_contact` (liefert nur bei Käufer/Verkäufer UND `status='confirmed'`),
   - „Abgeschlossen" (`completed`).
- Bezug: `plaene/phase-2-kern-features.md` Schritt 2 (`src/app/actions/transactions.ts`, `SellerDashboard.tsx`, `ContactSection.tsx`, `DealFlow.tsx`) + Schritt 6 (Profil). RPC-Liste siehe Plan.

---

## 🚫 BLOCKIERT — Build rot (MORGEN SCHRITT 1)

- **Symptom:** `npm run build` bricht ab:
  ```
  ✓ Compiled successfully
  Collecting page data ...
  [Error [PageNotFoundError]: Cannot find module for page: /auth/callback]  code: 'ENOENT'
  [Error: Failed to collect page data for /auth/callback]
  ```
- **Messergebnis (vorbestehend oder durch heutige Fixes verursacht?):** **Vorbestehend / unabhängig von den heutigen Änderungen.** Begründung:
  - `git status` zeigt heute geändert: `src/app/page.tsx`, `src/components/feed/FeedPage.tsx`, `ListingCard.tsx`, `TikTokScroll.tsx` (D/C) sowie aus Vorsession `AppChrome.tsx`, `useAuth.ts`, `CLAUDE.md`. **Nichts unter `src/app/auth/`.**
  - `src/app/auth/callback/route.ts` ist getrackt, **unverändert** und ein **gültiger** Handler (`export async function GET(request)`, `exchangeCodeForSession`). Kein Syntax-/Export-Fehler erkennbar.
  - `tsc --noEmit` ist **grün** — der Fehler tritt erst in `next build` bei „Collecting page data" auf.
- **Verdachtskandidaten für morgen (erst messen, dann fixen — D1):**
  1. Stale `.next`-Cache → `rm -rf .next` und neu bauen; prüfen ob der Fehler verschwindet.
  2. Next.js 15.2.8 Routing-Quirk mit `route.ts` unter `app/auth/callback/` (ggf. bekannte Issue prüfen).
  3. Untracked `src/app/api/whoami/route.ts` (Debug-Instrument) als Störfaktor ausschließen — verschwindet ohnehin beim Aufräumen (siehe unten).
- **Regel-Konsequenz:** Build-Gate rot → **KEIN Commit heute** (D4 / Pre-Commit-Regel). Änderungen bleiben uncommitted im Arbeitsverzeichnis (nichts geht verloren).

---

## 2. AKTUELLER WORKING-TREE-STAND (uncommitted, KEIN Commit heute)

Heute geändert (im Arbeitsverzeichnis, nicht committet):
- `src/app/page.tsx` — Feed-Query: `reserved` aufgenommen (D).
- `src/components/feed/FeedPage.tsx` — cursor-Guard (C) + `reserved` in beiden Client-Queries (D).
- `src/components/feed/ListingCard.tsx` — „⏳ RESERVIERT"-Overlay + Live-Zähler-Unterdrückung (D).
- `src/components/feed/TikTokScroll.tsx` — „⏳ RESERVIERT"-Badge (D).

Aus Vorsession noch offen im Tree (Diagnose-Instrumente — erst NACH E entfernen):
- `src/app/api/whoami/route.ts` (untracked) — löschen.
- `src/components/layout/AuthDebugPanel.tsx` (untracked) — löschen.
- `src/components/layout/AppChrome.tsx` — die zwei Zeilen `import { AuthDebugPanel }` und `<AuthDebugPanel />` (nach `<OnboardingFlow />`) entfernen.
- `src/hooks/useAuth.ts` — 3× `// TEMP-DIAGNOSE` `console.error` entfernen und die dafür eingeführten `error`-Destrukturierungen zurückbauen (Original nutzte nur `{ data }`).
- ggf. `.git/q.json` (temporäre SQL-Datei) — löschen, falls noch vorhanden.

> Die Debug-Instrumente wurden heute bewusst **noch nicht** entfernt, weil B mit ihnen gemessen wurde und E ggf. noch davon profitiert. Aufräumen = letzter Schritt nach E.

---

## 3. NÄCHSTE SCHRITTE (Reihenfolge)

1. **Build-Blocker `/auth/callback` lösen** (messen → fixen), Gate grün machen.
2. **JJ testet C + D** im Browser (Dopplung weg? reserviert sichtbar mit Sticker + Kaufen gesperrt?).
3. **Aufgabe E** umsetzen (nur via RPCs, siehe oben).
4. Debug-Instrumente entfernen (Liste Abschnitt 2).
5. `npx tsc --noEmit` + `npm run build` grün → **dann** WIP/Feature-Commit (kein Push ohne JJ-OK).

---

## 4. SESSION-UPDATE 07.07.2026 (Fortsetzung — Build-Blocker + Mess-Session F–H)

### Build-Blocker `/auth/callback` — GELÖST (kein Code-Fix)
- **Symptom:** `next build` brach bei „Collecting page data" mit `PageNotFoundError: Cannot find module for page: /auth/callback`.
- **Bewiesene Ursache:** stale/korrupter `.next`-Cache. Der Fehler war **nicht** codebedingt — Build auf dem aktuellen Tree (mit allen heutigen Änderungen) sowie ein kompletter Neubau nach `rm -rf .next` sind **beide grün**. `/auth/callback` ist ein gültiger Handler, unverändert.
- **Fix:** `.next` verworfen. `tsc --noEmit` + `next build` grün.
- **Offene Folgefrage:** Wodurch der Cache gestern in den kaputten Zustand geriet (vermutlich abgebrochener Build). Vorsichtsmassnahme bei künftigen mysteriösen Build-Fehlern: zuerst `.next` löschen.

### C + D — von JJ gegengetestet: ✅ bestätigt
- C (Feed-Dopplung weg) und D (reserviertes Inserat mit „⏳ RESERVIERT"-Sticker sichtbar, Kaufen gesperrt) im Browser bestätigt.

### F — GESUCHE-TAB dauerhaft Ladezustand → GELÖST (kein Code-Fix, D5)
- **Symptom:** Gesuche-Tab zeigte dauerhaft Ladespinner, keine Gesuche, obwohl 2 mit `status='active'` in der DB.
- **Messung (D1):** Exakte Tab-Query (inkl. `profiles`-Join) gegen Live-DB reproduziert → **HTTP 200, beide Gesuche in 0.86s**. `createBrowserClient` ist im Browser ein **Singleton** (Endlos-Effekt ausgeschlossen), `ListingCard` rendert Gesuche sauber, **kein** Service Worker im `src`-Code. → Alle server-/code-seitigen Schichten gesund.
- **Bewiesene Ursache:** **veralteter JS-Chunk im Browser-Cache.** JJ-Hard-Reload (Strg+Shift+R) hat den Tab sofort gelöst — deckt sich mit der Messung (Problem lag ausschliesslich in der Browser-Laufzeit).
- **Fix:** keiner nötig (Cache-Artefakt). 
- **Offene Folgefrage:** Ob nach Deploys generell ein Cache-Bust nötig ist (Phase-4-Thema: Versionierung/Cache-Header/PWA).

### G — AUTH-BESTÄTIGUNGSLINK führt ins Leere → OFFENER PUNKT (Config-Fix vor Deploy, NICHT jetzt)
- **Symptom:** Bestätigungslink nach Registrierung führt ins Leere, keine Rückkehr zur App.
- **Bewiesene Ursache (D1, gemessen):**
  1. `emailRedirectTo` = `${NEXT_PUBLIC_APP_URL}/auth/callback`, und `NEXT_PUBLIC_APP_URL=http://localhost:3000` → **Link zeigt auf localhost**. JJ hat die Mail auf einem **anderen Gerät** geöffnet → localhost nicht erreichbar → toter Link. (Bestätigt durch JJ.)
  2. Supabase-Config (Management-API gemessen): `site_url=http://localhost:3000`, **`uri_allow_list` leer** → Produktions-/Fremd-URLs nicht erlaubt.
  3. Client nutzt **PKCE** (`flowType: "pkce"`): `exchangeCodeForSession` verlangt den `code_verifier` aus **demselben Browser** wie die Registrierung → Bestätigung auf anderem Gerät scheitert ohnehin.
- **Callback-Route selbst ist korrekt** (kein Code-Bug): ohne/mit ungültigem `code` → 307 → `/?auth_error=true`.
- **TODO vor Vercel-Deploy (Config, kein Code):**
  - `NEXT_PUBLIC_APP_URL` in der Vercel-Env auf die echte Domain setzen (z.B. `https://uri-markt.vercel.app`).
  - Supabase Auth: `site_url` auf Produktions-Domain, `uri_allow_list` um `https://<domain>/auth/callback` (+ ggf. `http://localhost:3000/auth/callback` für lokale Tests) ergänzen.
  - PKCE-Same-Browser-Anforderung beachten: Bestätigung muss im selben Browser wie die Registrierung erfolgen (oder auf einen OTP-/Token-Hash-Flow umstellen — separat entscheiden).

### H — TikTok-Vollbild: Mausrad-Scroll läuft nicht → GEFIXT
- **Symptom:** Im Vollbild-Modus (TikTokScroll) scrollte das Mausrad auf dem Laptop nicht; Touch/Swipe funktionierte.
- **Bewiesene Ursache (D1):** Komponente hat **keine** JS-Scroll-Handler (kein onWheel/onTouch) — reines natives CSS-Scrolling mit `snap-y snap-mandatory` und Items je `h-[100dvh]`. Diskrete Mausrad-Ticks (~100px) überschreiten die Snap-Schwelle (~halbe Item-Höhe) nicht → Container schnappt zum aktuellen Item zurück → Rad wirkt „tot". JJ-Gegencheck bestätigte: schnelles Drehen (grosser Delta) springt weiter, langsames nicht.
- **Fix (ein Change):** `snap-mandatory` → `snap-proximity` in `TikTokScroll.tsx`. Kleine/langsame Ticks scrollen jetzt frei, Snap greift nur noch in Item-Nähe. JJ-Gegentest: ✅ „Mausrad läuft sauber".

### I — Vollbild-Modus lädt nicht nach → GEFIXT
- **Symptom (Soll-Abweichung):** Vollbild zeigte nur die bereits geladenen Inserate und endete mit „Zurück zum Markt"; kein Auto-Nachladen beim Swipen (anders als das Grid).
- **Fix:** Pagination vereinheitlicht. `FeedPage.tsx`: „nächste Seite"-Logik in **eine** `loadMore`-Funktion (`useCallback`) extrahiert — genutzt von Grid-Observer UND Vollbild. Spaltenliste in `LISTING_SELECT` zentralisiert (vorher 2× dupliziert). `loadMore`/`hasMore`/`isLoading` an `TikTokScroll` durchgereicht. `TikTokScroll.tsx`: IntersectionObserver am Lade-Panel (rootMargin 600px, Vorladen) triggert `onLoadMore`; Ende-Marker nur noch bei `!hasMore`. Cursor-Pagination identisch zum Grid, Guards in `loadMore` (isLoading/hasMore/cursor) machen Mehrfach-Trigger unschädlich.
- **Status:** `tsc --noEmit` grün, Dev-Server sauber hot-reloaded. JJ-Gegentest bei ≤10 Inseraten: ✅ Ende-Marker sofort (korrekt, keine 2. Seite). **Offene Folgefrage:** sichtbarer Nachlade-Test steht aus — braucht >10 aktive Inserate eines Typs (Seitengröße 10). Später mit echten Daten prüfen.

---

## 5. SESSION-UPDATE 07.07.2026 (Abschluss — E.1/E.2 fertig, 3 offene Bugs gemessen)

### E.1 + E.2 — Deal-Sichtbarkeit im Profil → ✅ IMPLEMENTIERT & von JJ getestet
- **E.1 Verkäufer** (`SellerDashboard.tsx`, war bereits gebaut) + **E.2 Käufer** (NEU) funktionieren. JJ-Test mit **zwei Accounts**: Kern-Flow grün — Kauf → Verkäufer bestätigt → **Provision korrekt abgezogen** (`process_transaction_commission`) → Feed-Status korrekt (Inserat `reserved`).
- **Neu gebaut für E.2:**
  - `src/app/profile/page.tsx`: Query `buyerTransactions` (`buyer_id = user.id`, Status `pending/confirmed/completed`, explizite Spalten, Listing-Join) + Durchreichung an `ProfileDashboard`.
  - `src/components/profile/BuyerDashboard.tsx` (NEU): Zustände `pending` → „⏳ Wartet auf Bestätigung", `confirmed` → `<ContactSection role="buyer" />` (Kontakt NUR via RPC `get_transaction_contact`), `completed` → „🏆 Abgeschlossen".
  - `src/components/profile/ProfileDashboard.tsx`: Kachel „🛒 Meine Käufe" (Badge = offene Käufe), View-Zustand `purchases`, Rendering `BuyerDashboard`.
- `tsc --noEmit` grün. Keine neue Logik/RPC — nur bestehende Bausteine verdrahtet. Kontaktdaten-Regel (nur via RPC/RLS) eingehalten.

### 3 OFFENE BUGS aus dem JJ-Test (erst messen D1, dann Fixes einzeln D3 — MORGEN)

**Bug #1 — Bewertungs-Modal springt auf und verschwindet sofort → GEMESSEN, Ursache klar**
- **Bewiesene Ursache (Code):** In `SellerDashboard.tsx` steht `if (transactions.length === 0) return (…)` als **Early-Return** (Z. ~42), das `ReviewModal` wird aber erst **danach** im JSX gerendert (Z. ~200). Nach „Übergabe abgeschlossen" ruft `completeTransactionAction` `revalidatePath('/profile')` → Neuladen der Serverdaten. Da `sellerTransactions` `completed` herausfiltert (siehe #2), wird die Liste leer → Early-Return greift → das gerade per `setReviewTxId` geöffnete Modal wird nicht mehr gerendert → „flasht" kurz und verschwindet.
- **Fix (morgen, gekoppelt an #2):** Sobald `completed` in der Liste bleibt (#2), ist die Liste nicht mehr leer → Modal bleibt. Zur Robustheit zusätzlich erwägen, das `ReviewModal` **vor** den Early-Return zu ziehen bzw. das Modal top-level in `ProfileDashboard` zu halten.

**Bug #2 — Abgeschlossener Verkauf verschwindet aus „Meine Verkäufe" → GEMESSEN, Ursache klar**
- **Bewiesene Ursache (Code):** `src/app/profile/page.tsx`, `sellerTransactions`-Query filtert `.in('status', ['pending','confirmed'])` → `completed` fällt raus. (Käufer-Query enthält `completed`, darum sieht der Käufer den Deal, der Verkäufer nicht.)
- **Soll:** Deal bleibt beim Verkäufer als „Abgeschlossen" sichtbar (wie beim Käufer), **ohne** Kontaktdaten.
- **Fix (morgen, siehe Abschnitt 0):** `completed` in die Query aufnehmen + `SellerDashboard` um einen „🏆 Abgeschlossen"-Zustand ergänzen (ohne Kontakt/Buttons).

**Bug #3 — Dauerhafter Spinner in der Deal-Karte (Verkäufer- UND Käufer-Sicht) → TEILWEISE GEMESSEN, Ursache noch NICHT gesichert**
- **Was gemessen ist:** Die RPC `get_transaction_contact` **existiert und ist korrekt** (Management-API, `pg_get_functiondef`): SQL, SECURITY DEFINER, `search_path=''`, liefert `(buyer_contact, seller_contact, status)` **nur** wenn Aufrufer Käufer/Verkäufer ist UND `status='confirmed'`. Die Funktion hängt also nicht von sich aus.
- **Noch NICHT gemessen (Test wurde abgebrochen):** das tatsächliche HTTP-Verhalten des RPC-Aufrufs + die Werte `buyer_contact`/`seller_contact` einer echten confirmed-Transaktion. → **MORGEN zuerst nachholen** (REST-`/rpc/get_transaction_contact` bzw. Browser-Network/Console auf der confirmed-Karte).
- **Leitende Hypothesen (noch zu beweisen, KEIN Fix auf Verdacht):**
  1. `ContactSection.tsx` hat in der async-Effekt-IIFE **kein try/catch**: Falls der RPC-Promise **rejected** (nicht nur `{error}` liefert), wird `setLoading(false)` nie erreicht → Spinner bleibt ewig. (Kandidat für den Hänger.)
  2. `seller_contact` ist vermutlich **nie befüllt** — es gibt (noch) kein Verkäufer-Kontakt-/Zahlungs-Formular (siehe offener Punkt unten). Selbst bei korrekter Freigabe hätte die Karte dann nichts anzuzeigen.
- **Vorgehen morgen:** erst Messung (Hypothese 1 vs. 2 entscheiden), dann genau ein Fix.

### OFFENER PUNKT — Verkäufer-Kontaktdaten-/Zahlungs-Formular (noch nicht gebaut)
- Es fehlt ein **„Zahlungen"-Tab** im Profil, in dem der Verkäufer seine Kontakt-/Zahlungsdaten (**IBAN / TWINT**) hinterlegt.
- Diese gehören in eine **`profiles_private`**-Tabelle (nicht in `profiles`), streng RLS-geschützt (nur Eigentümer lesbar; Freigabe an die Gegenseite ausschliesslich über die Deal-RPC `get_transaction_contact`).
- Bezug zu Bug #3: Ohne hinterlegte Verkäuferdaten bleibt `seller_contact` leer → die Käufer-Karte kann selbst nach Bestätigung keinen sinnvollen Kontakt anzeigen. Reihenfolge (Messung #3 zuerst) klärt, ob das die Ursache des Spinners ist oder nur eine Anzeige-Lücke.

### WORKING-TREE / GATE-STATUS (Ende 07.07.2026)
- **Kein Commit heute, kein Push.** Alle Änderungen uncommitted im Arbeitsverzeichnis.
- Heute geändert/neu (zusätzlich zu C/D aus Abschnitt 2): `TikTokScroll.tsx` (Fix H+I), `FeedPage.tsx` (Fix I: `loadMore`/`LISTING_SELECT`), `src/app/profile/page.tsx` (E.2 buyer-Query), `src/components/profile/ProfileDashboard.tsx` (E.2 Kachel/View), **NEU** `src/components/profile/BuyerDashboard.tsx`.
- **Debug-Instrumente: NOCH DRIN** (bewusst, erst nach den 3 Bugs entfernen). Entfern-Liste unverändert in Abschnitt 2: `src/app/api/whoami/route.ts`, `src/components/layout/AuthDebugPanel.tsx`, dessen Einbindung in `AppChrome.tsx`, die `// TEMP-DIAGNOSE`-Logs in `useAuth.ts`.
- **Build-Gate:** `npx tsc --noEmit` zuletzt **grün** (nach E.2). Voller `npm run build` seit E.2 **nicht** neu gelaufen → **vor jedem Commit erneut ausführen** (D4). Der `/auth/callback`-Build-Blocker ist gelöst (Cache), ein sauberer Build war heute grün.
- **Nebenbefund (nicht angefasst, für später):** Kommentar-Absenden wirft `PGRST205 – Table 'public.comments' not found` (Server-Log). Separates DB-Thema.
