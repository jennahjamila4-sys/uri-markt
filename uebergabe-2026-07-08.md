# Uri-Markt — Übergabe 08.07.2026 (Deal-Sichtbarkeit + Foto-Upload fertig, Debug-Cleanup, Commit lokal)

> Kontext: JJ ist nicht-technisch, testet nur Ergebnisse im Browser.
> Root-Cause statt Workaround. Live-DB = Wahrheit. Kein Push ohne JJ-OK.
> Regeln D1–D5 (CLAUDE.md). Arbeitsmodus seit heute: **komplette Blöcke, selbst geprüft** —
> Claude liefert fertige, mit `tsc`+`build` verifizierte Ergebnisse, JJ testet nur das Endergebnis.
>
> ⚠️ Dauerregeln (gelten ab sofort, alle Sessions):
> 1. **Nie Secrets im Output** (keine Tokens/Keys/`.env`-Werte; Env-Variablen nur auf Existenz prüfen).
> 2. **Nie JJs Testergebnisse selbst schreiben** — ein Test gilt erst als bestanden, wenn JJ es ausdrücklich meldet.
> 3. **Kein Push ohne ausdrückliches JJ-OK** — Commits bleiben lokal, bis JJ den Push freigibt.

---

## 1. HEUTE ERLEDIGT (alle mit `tsc`+`build` grün, von JJ gegengetestet)

### A — Deal-Sichtbarkeit im Profil: abgeschlossene Verkäufe + Bewertungs-Modal
- **Symptom:** (Bug #2) Abgeschlossener Verkauf verschwand aus „Meine Verkäufe". (Bug #1) Das Bewertungs-Modal des Verkäufers flashte kurz auf und verschwand sofort.
- **Bewiesene Ursache:** `src/app/profile/page.tsx` filterte `sellerTransactions` auf `['pending','confirmed']` → `completed` fiel raus. In `SellerDashboard.tsx` steht der Early-Return `if (transactions.length === 0) return` **vor** dem `ReviewModal` im JSX → nach Abschluss wurde die Liste leer, der Early-Return griff, das gerade geöffnete Modal wurde nicht mehr gerendert.
- **Fix (ein kohärenter Block):**
  - `src/app/profile/page.tsx`: `sellerTransactions`-Query auf `['pending','confirmed','completed']` erweitert.
  - `src/components/listing/SellerDashboard.tsx`: `completed`-Zustand „🏆 Abgeschlossen" ergänzt (analog `BuyerDashboard`, **ohne** Kontaktdaten/Buttons).
  - Dadurch bleibt die Liste nach Abschluss nicht leer → Early-Return greift nicht → `ReviewModal` bleibt gemountet (fixt #1 gleich mit).
- **JJ-Test:** ✅ „Modal bleibt offen, Deal zeigt Abgeschlossen".

### B — Foto-Upload Ende-zu-Ende komplett funktionsfähig
- **Symptom:** Hochgeladenes Foto erschien nicht am Inserat; später Runtime-Error von `next/image`.
- **Bewiesene Ursachen + Fixes (drei Teile, gemeinsam fertiggestellt):**
  1. **Spalten-Mismatch (Anzeige):** Formular schrieb `image_urls` (Array), alle Anzeige-Stellen lesen `image_url` (Singular). → In `src/app/actions/listings.ts` (`createListingAction`) wird jetzt zusätzlich `image_url: validated.data.image_urls?.[0] ?? null` gesetzt (erstes Bild gespiegelt). `ListingCard`/Feed/Profil lesen Singular, `TikTokScroll` liest `image_url ?? image_urls[0]`.
  2. **Storage-Bucket + Policy verifiziert:** Bucket `listings` (public) existiert. Policy: Upload nur in eigenen Ordner (erster Pfadteil = `auth.uid()`). `src/lib/supabase/storage.ts` erzeugt den Pfad als `${userId}/<datei>` → passt exakt zur Policy. **Kein Codefix nötig, verifiziert.**
  3. **`next/image`-Host nicht erlaubt:** Runtime-Error „Invalid src prop … hostname `<projekt>.supabase.co` is not configured under images". Ursache: es gab **gar keine** Next-Config. → **NEU `next.config.js`** (CommonJS, Projekt hat kein `"type":"module"`) mit `images.remotePatterns` für den Supabase-Host + Pfad `/storage/v1/object/public/**`, Protokoll `https`.
- **JJ-Test:** ✅ Foto erscheint am neuen Inserat.
- **Offene Folgefrage:** Altdaten-Inserate haben `image_url = NULL` → bleiben ohne Foto, bis ein **einmaliges Backfill-SQL** läuft (`UPDATE listings SET image_url = image_urls[1] WHERE image_url IS NULL AND image_urls IS NOT NULL`). Läuft über die **Supabase-MCP im Planungs-Chat**, NICHT über Claude Code (D2: danach Grant-Check).

### C — Debug-Instrumente vollständig entfernt (Cleanup)
- **Symptom:** Roter „SIGNED_OUT"-Kasten + Debug-Overlay im Browser; Next.js-Overlay zählte `console.error`-Diagnosen als Issues.
- **Entfernt:**
  - `src/hooks/useAuth.ts`: alle 3 `// TEMP-DIAGNOSE`-`console.error` (u.a. das bei jedem Auth-Event feuernde `onAuthStateChange`-Log = Quelle des roten Kastens); `{ data, error }` → `{ data }` zurückgebaut, Event-Param `_event`.
  - `src/components/layout/AppChrome.tsx`: Import + `<AuthDebugPanel />` entfernt (Datei damit wieder auf committetem Stand).
  - **Gelöscht:** `src/components/layout/AuthDebugPanel.tsx`, `src/app/api/whoami/route.ts` (+ leeres `src/app/api/`).
- **Belassen (kein Debug, echtes Fehler-Logging in catch-Blöcken):** `console.error/warn` in `transactions.ts`, `FeedPage.tsx`, `ListingDetail.tsx`, `smartMatch.ts`, `ContactSection.tsx`, Onboarding-Screens.

### Mit-committet: zuvor uncommittete Arbeit aus den Vorsessions (jetzt gemeinsam gesichert)
- C (Feed-Dopplung/cursor-Guard), D (reservierte Inserate sichtbar + „⏳ RESERVIERT"-Sticker), E.2 (`BuyerDashboard` + Käufer-Sicht im Profil), H (TikTok-Mausrad `snap-proximity`), I (Vollbild-Nachladen `loadMore`/`LISTING_SELECT`) — alle bereits JJ-getestet, waren nur noch nicht committet.

---

## 2. GATE-STATUS (Ende 08.07.2026)
- `npx tsc --noEmit` → **0 Errors**.
- `npm run build` → **0 Errors, 0 Warnings**, `ƒ Middleware` gelistet.
- **Commit:** lokal auf `main`, **KEIN Push** (wie in diesem Repo durchgängig; Push erst nach ausdrücklichem JJ-OK).

---

## 3. OFFENE PUNKTE BIS LAUNCH (nicht heute — Backlog)

> DB-Teile (Migrationen, RLS, RPCs, Tabellen) laufen über die **Supabase-MCP im Planungs-Chat**,
> NICHT über Claude Code. Claude Code macht den App-/Code-Teil.

### Features (Code)
- **Zahlungen-Tab im Profil** (Verkäufer hinterlegt Zahlungs-/Kontaktdaten): **IBAN**, **TWINT** und **Telefon** — gespeichert in einer eigenen Tabelle **`profiles_private`** (streng RLS: nur Eigentümer lesbar). Der Verkäufer wählt aus, **welche dieser Angaben der Käufer nach Bestätigung sieht** (z.B. „nur TWINT", „TWINT + Telefon"). Freigabe an die Gegenseite ausschliesslich über die Deal-RPC `get_transaction_contact` (nur bei `status='confirmed'`, nur an Beteiligte). → **direkter Bezug zu Bug #3**: Ohne hinterlegte Verkäuferdaten ist `seller_contact` leer, die Käufer-Karte kann nichts anzeigen. (DB-Teil `profiles_private` + RPC-Anpassung via MCP.)
- **Inserat bearbeiten**: bestehendes Angebot/Gesuch nachträglich ändern (Titel, Beschreibung, Preis, Bilder, Kategorie). Aktuell nur Erstellen + Löschen vorhanden.
- **Reserviert-48h-Auto-Ablauf**: ein `reserved`-Inserat fällt nach 48 h ohne Abschluss automatisch zurück auf `active` (Reservierung verfällt). **DB-Teil** (Cron/Scheduled Function oder RPC + `reserved_at`-Timestamp) via **MCP im Planungs-Chat**; Code-Teil = Anzeige/Verhalten.
- **Bewertungen öffentlich sichtbar**: abgegebene Reviews (Sterne + Text) auf dem öffentlichen Profil (`/profile/[username]`) und ggf. an der Karte anzeigen. Daten liegen in `reviews`.
- **Taler-Historie im Profil**: Liste der Uri-Taler-Bewegungen (Gutschriften/Abzüge, z.B. Provision) aus `wallet_transactions` im Profil anzeigen.

### Bugs / DB-Themen
- **Bug #3 — Dauerspinner in der Deal-Karte** (Verkäufer- UND Käufer-Sicht): noch nicht final gemessen. Kandidat: `ContactSection.tsx` — die async-IIFE im Effekt (Z. ~31–44) hat **kein try/catch**; bei einem rejecteten RPC-Promise wird `setLoading(false)` nie erreicht → Spinner bleibt ewig. Zweiter Kandidat: `seller_contact` ist nie befüllt (kein Verkäufer-Zahlungsformular, siehe Zahlungen-Tab). **D1: erst HTTP-Verhalten von `get_transaction_contact` messen, dann ein Fix.**
- **`comments`-Tabelle fehlt**: Kommentar-Absenden wirft `PGRST205 – Table 'public.comments' not found`. Tabelle + RLS anlegen — **via MCP im Planungs-Chat**.
- **Foto-Backfill Altdaten** (siehe 1.B): `UPDATE listings SET image_url = image_urls[1] WHERE image_url IS NULL AND image_urls IS NOT NULL` — **via MCP im Planungs-Chat** (D2: danach Grant-Check).

### Recht / Deploy (vor Launch)
- **Impressum, Datenschutzerklärung, Konto-Löschen** (DSGVO): Pflichtseiten + Funktion „Konto löschen" (Daten-Löschung). Siehe `docs/dsgvo.md`.
- **Bug G — Auth-Bestätigungslink + Vercel-Deploy-Config**: `NEXT_PUBLIC_APP_URL` in Vercel auf echte Domain; Supabase `site_url` + `uri_allow_list` (`https://<domain>/auth/callback`) setzen; PKCE verlangt denselben Browser wie die Registrierung (oder auf OTP-/Token-Hash-Flow umstellen — separat entscheiden).

---

## 4. NÄCHSTER AUFTRAG — BLOCK 2: STATUS-AUDIT & KORREKTUR (kompletter Block, selbst geprüft)

**Soll-Verhalten für jeden Listing-Status an jedem Anzeigeort:**
- **active:** normale Karte im Feed (Angebote-Tab), TikTok-Modus, eigenes Profil „Aktiv", kaufbar.
- **reserved:** Karte MIT ⏳-RESERVIERT-Sticker im Feed sichtbar, nicht erneut kaufbar, im Profil des Verkäufers als „Reserviert".
- **sold:** NICHT mehr als normale Karte im Feed. Erscheint ausgegraut mit VERKAUFT-Stempel im „Kürzlich verpasst"-Streifen (Design-Referenz). Im Verkäufer-Profil unter „Abgeschlossen". Nicht kaufbar, nicht im TikTok-Modus.
- **Transaktion completed:** Deal bleibt bei Verkäufer UND Käufer dauerhaft sichtbar als „Abgeschlossen".

**Aufgabe:** Prüfe ALLE Queries und Komponenten (Feed, Verpasst-Streifen, TikTokScroll, ListingCard, Profil, DealFlow) gegen dieses Soll, korrigiere jede Abweichung, entferne verkaufte Inserate aus dem normalen Feed-Grid.

**Abschluss:** `tsc` + `build` 0 Errors, dann kurze Testliste für JJ (max. 5 Punkte).

**Regel:** Schreibe niemals Testergebnisse selbst ins Eingabefeld — nur JJ bestätigt Tests.

**Erste Mess-Hinweise (Startpunkte für BLOCK 2, noch nicht verifiziert):**
- Feed-Grid-Queries stehen in `src/app/page.tsx` (Server, `.in('status', ['active','reserved','sold'])`) und `src/components/feed/FeedPage.tsx` (2× Client-Query). → `sold` müsste laut Soll aus dem **normalen Grid** raus und stattdessen im „Verpasst"-Streifen (`src/components/feed/FomoZone.tsx`?) landen.
- „⏳ RESERVIERT"-Sticker existiert bereits in `ListingCard.tsx` + `TikTokScroll.tsx`. VERKAUFT-Stempel/Ausgrauen für `sold` gegen Design-Referenz prüfen (`docs/design/design-referenz.html`).
- TikTok-Modus soll nur `active` (ggf. `reserved` sichtbar, aber nicht kaufbar) zeigen — `sold` ausschliessen.
- Profil-Ansicht: `MyListings.tsx` / `ProfileDashboard.tsx` — „Aktiv" / „Reserviert" / „Abgeschlossen"-Zuordnung prüfen.
- Kaufbarkeit: `DealFlow.tsx` sperrt Kaufen bereits für `reserved` („⏳ Bereits reserviert"); für `sold` ebenfalls sicherstellen.
