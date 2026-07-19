# Übergabe 19.07.2026 — Block 11: Reibungsloser Deal

> Status: **VERIFY GRÜN bei JJ** (run-verify.ps1: tsc + ESLint + Playwright komplett
> grün, nach den 2 Root-Cause-Fixes vom Verify-Rot, s.u.). Cowork-Sandbox war die
> ganze Session nicht lauffähig → `git`/`rm`/Gates liefen NICHT hier, sondern bei JJ
> (Lektion 17). **Offen: Commit + Löschen der 2 Altdateien auf JJ-Seite; KEIN Push
> ohne JJ-OK.**
>
> **Auf JJ-Seite ausführen (Verify ist grün):**
> ```
> git rm src/components/create/AngebotForm.tsx src/components/create/GesuchForm.tsx
> git add -A
> git commit -m "Block 11: Reibungsloser Deal — Prefill, Zahlungen, 48h-Countdown live, Wieder-erhältlich, Vorwarnung, Entwürfe-Schnellzugriff, reject-RPC, E2E"
> ```
> (Push erst nach ausdrücklichem OK.)

---

## Schritt 0 (D1) — gemessener Repo-Ist
- (a) **Kaufformular**: `src/components/listing/DealFlow.tsx` (Modal mit einem
  Kontaktfeld + Zahlungsmethode-Radio + Bestätigungs-Checkbox).
- (b) **Konto/Zahlungen**: kein Modal, sondern `ProfileDashboard.tsx` mit Kacheln;
  „💳 Zahlungen" = `PaymentInfoForm.tsx` existierte bereits vollständig (IBAN/Twint
  + CH-Validierung + Sichtbarkeits-Toggles + „erst nach Bestätigung"-Klartext).
- (c) **RESERVIERT-Sticker**: statisches Overlay „⏳ RESERVIERT" in `ListingCard.tsx`
  und `TikTokScroll.tsx` (kein Countdown).
- (d) **Feed-Query**: `FeedPage.tsx` nutzt `select('*, profiles(...)')` → `reserved_until`
  / `relisted_at` kommen automatisch mit; keine Realtime-Subscription vorhanden.
- (e) **Glocke**: `NotificationPanel.tsx` verlinkt generisch über `listing_id`;
  Icon-Map kannte `tx_expiring`/`tx_expired` noch nicht.
- (f) **Direkte transactions-Writes**: **einer gefunden** → siehe STOPP-Befund.

## STOPP-Befund (f) + Auflösung — Ablehnen-Flow war gebrochen
- `rejectTransactionAction` machte ein **direktes** `UPDATE transactions SET
  status='cancelled'` als Rolle `authenticated`. Live-DB (D2): `authenticated` hat
  auf `transactions` nur **INSERT, SELECT** → das UPDATE lief in **42501** und warf.
  (Schon vorher wirkungslos: keine UPDATE-RLS-Policy → 0 Zeilen; Block-11-Härtung
  machte den stillen Fehler sichtbar.)
- **Auflösung (von JJ eingespielt + D2-verifiziert):** SECURITY-DEFINER-RPC
  `reject_buy_intent(p_transaction_id)`. Ablehnen läuft jetzt ausschliesslich
  darüber; die RPC setzt atomar Transaktion→`cancelled`, Inserat→`active` mit
  `relisted_at` (→ „🔄 Wieder erhältlich"), `reserved_until`→null und
  benachrichtigt den Käufer (Typ `tx_rejected`).

---

## BEWIESEN (an der Live-DB gemessen, D1/D2)
- `database.ts`-Generat enthält `reject_buy_intent` + `warn_expiring_reservations`
  + die 3 neuen Spalten (Row/Insert/Update) — nur +10 Zeilen ggü. HEAD, kein Handedit.
- Grants `transactions`: authenticated = INSERT, SELECT (kein UPDATE/DELETE).
- RPC-Contracts (aus `pg_get_functiondef`): `reject_buy_intent` → `{success}`;
  Käufer-Notification Titel **„Kaufanfrage nicht angenommen"**, Typ `tx_rejected`.
  `warn_expiring_reservations` (pending) → Verkäufer-Notification Titel
  **„⏳ Nur noch 6 Stunden!"**, Typ `tx_expiring`, idempotent via
  `expiry_warning_sent_at`. `expire_stale_reservations` → Inserat active +
  `relisted_at`, Typ `tx_expired`. IBAN-Validator selbst-geprüft (Logik):
  `CH9300762011623852957` → ok, `CH00INVALID` → format-Fehler.

## UMGESETZT (Code fertig, UNGETESTET — Gates bei JJ)
- **TEIL 1** `database.ts` = JJ-Generat, Anker vorhanden (per Grep geprüft).
- **TEIL 2** Prefill: neue Server-Actions `getMyContactAction` / `rememberContactAction`
  (`app/actions/profile.ts`, partieller Upsert nur Kontaktspalte, Lektion 1);
  `DealFlow.tsx` befüllt beim Öffnen vor, „💾 merken"-Checkbox, Fehlerpfade sichtbar.
- **TEIL 3** Zahlungen: bestehende Kachel `PaymentInfoForm` erfüllt die Anforderung
  bereits — **bewusst nicht umgebaut** (dein OK „was entlastender/übersichtlicher ist";
  Umbau = Regressionsrisiko block4-account ohne Mehrwert). Nur verifiziert.
- **TEIL 4** Countdown + Realtime: neue `src/lib/reservation.ts` (hydration-sicherer
  `useMinuteTick` + Texte); `ListingCard`/`TikTokScroll`/`DealFlow`-Detail zeigen
  „⏳ Reserviert — noch X Std." (bzw. Minuten <90min; „🔄 Gleich wieder frei…" bei
  Cron-Lag). `FeedPage` hat eine Realtime-Subscription auf `listings`-UPDATEs
  (Cleanup im unmount, Fehler geloggt).
- **TEIL 5** „🔄 Wieder erhältlich!"-Sticker auf Karte + TikTok + Detail (active &
  `relisted_at` < 48h).
- **TEIL 6** Deal-Countdown aus `reserved_until` (eine Wahrheit): `reserved_until` in
  die Transaktions-Subselects (`profile/page.tsx`) + `SellerDashboard`
  (pending „…um die Anfrage anzunehmen", confirmed „…schliesst euren Deal ab…") +
  `BuyerDashboard` (confirmed).
- **TEIL 7** 48h-Hinweis: dezent unter „Veröffentlichen" (nur Angebot) im
  `ChameleonForm` + als Erfolgs-Toast-`description` (Toast-Titel unverändert → E2E ok).
- **TEIL 8** Entwürfe-Schnellzugriff: `ProfileDashboard` Button „📝 Entwürfe (n)"
  (bei 0 ausgeblendet) → öffnet `MyListings` direkt im Entwürfe-Tab (neue `initialTab`-Prop).
- **TEIL 9** Glocke: `tx_expiring` + `tx_expired` Icons ergänzt; `tx_rejected` war
  schon vorhanden; Verlinkung läuft generisch über `listing_id`.
- **Ablehnen-RPC**: `rejectTransactionAction` → `supabase.rpc('reject_buy_intent', …)`,
  Fehler/`success:false` sichtbar (Lektion 6/7), manuelle Notification entfernt (RPC macht sie).
- **TEIL 11** `e2e/block11-deal.spec.ts` (8 Tests inkl. reject-Test 8), Preflight,
  Cleanup vorher/nachher, Service-Role-REST-Seeds + RPC-Aufrufe, exakte
  Notification-Texte aus der Live-DB.
- **Alt-Spec-Robustheit (Lektion 20)**: Kaufmodal hat jetzt 2 Checkboxen → stabile
  `data-testid` (`agree-intent`, `remember-contact`) gesetzt und die Buy-Helfer in
  `block10`, `block9`, `deal-completion` auf `getByTestId('agree-intent')` umgestellt
  (Flow/Toasts unverändert, nur Selektor-Robustheit).

## ANGEFANGEN / OFFEN (bei JJ auszuführen)
1. **TEIL 10 — Löschen der Altformulare NICHT ausgeführt** (Sandbox `rm` nicht
   verfügbar). Per Grep bewiesen: `AngebotForm.tsx`/`GesuchForm.tsx` werden nirgends
   importiert (nur Eigendefinitionen). **Bei JJ ausführen:**
   `git rm src/components/create/AngebotForm.tsx src/components/create/GesuchForm.tsx`
   (bis dahin build-neutral: unused, kein Import, waren bei Block-10-Verify eslint-grün).
2. **Gates ungefahren** (Sandbox down): `tsc --noEmit`, `next build` (ESLint),
   Playwright — **alles bei JJ** via `e2e/run-verify.ps1`.

## Geänderte / neue Dateien
**Neu:** `src/lib/reservation.ts`, `e2e/block11-deal.spec.ts`, `uebergabe-2026-07-19.md`.
**Geändert:** `src/app/actions/transactions.ts` (reject→RPC),
`src/app/actions/profile.ts` (2 Actions), `src/components/listing/DealFlow.tsx`,
`src/components/feed/{FeedPage,ListingCard,TikTokScroll}.tsx`,
`src/components/listing/{ListingDetail,SellerDashboard}.tsx`,
`src/components/profile/{BuyerDashboard,ProfileDashboard,MyListings}.tsx`,
`src/components/create/ChameleonForm.tsx`,
`src/components/layout/NotificationPanel.tsx`, `src/app/profile/page.tsx`,
`e2e/{block10-smart-forms,block9-match,deal-completion}.spec.ts`, `CLAUDE.md`.
**Zu löschen (TEIL 10, bei JJ):** `src/components/create/AngebotForm.tsx`,
`src/components/create/GesuchForm.tsx`.

## DB — NICHT angefasst
Alle Block-11-Migrationen + `reject_buy_intent` waren bereits eingespielt und
D2-verifiziert. In dieser Session nur **gelesen** (execute_sql), nie geschrieben.

---

## Nächster Schritt für JJ (Verify-Doppelklick)
1. Altformulare entfernen (Befehl oben).
2. `e2e/run-verify.ps1` laufen lassen (Build = tsc + ESLint, dann Playwright).
3. Bei grün Commit (kein Push ohne dein OK):
   „Block 11: Reibungsloser Deal — Prefill, Zahlungen, 48h-Countdown live,
   Wieder-erhältlich, Vorwarnung, Entwürfe-Schnellzugriff, reject-RPC, E2E"

## Verify-Rot 19.07. — 2 Root-Cause-Fixes (D1 gemessen, D3 je ein Fix)
1. **deal-completion:179 — echter Produktbug.** Der async Prefill im Kaufformular
   löste NACH dem Tippen auf und überschrieb die eingegebene Kontaktangabe → der
   Verkäufer sah nicht „E2E Käufer…", sondern die hinterlegte Nummer. Ein realer
   Nutzer verliert so seine Eingabe. **Fix:** Prefill füllt nur ein leeres Feld
   (`setBuyerContact(prev => prev.trim() ? prev : stored)`), überschreibt nie
   getippten Text (`DealFlow.tsx`). Lektion 25.
2. **block10:281/289 — Selektor-Kollision (kein Produktbug).** Der neue
   „📝 Entwürfe (n)"-Button (TEIL 8) und der MyListings-Tab „📝 Entwürfe" matchten
   beide `getByRole('button',{name:/Entwürfe/})` → Strict-Mode. **Fix:** Tabs
   bekamen `data-testid="mylistings-tab-<key>"`; block10 (Z. 289 + 322) zielt darauf.
   RLS-Assertions unverändert (kein Aufweichen). Lektion 24-Nachtrag.

Beide Fixes sind hier **nicht** verifizierbar (Sandbox down) → **erneut
`run-verify.ps1` bei JJ**; erst bei komplett grün gilt Block 11 als fertig
(Lektion 26).

## Klick-Testliste für JJ
1. Als Käufer auf ein Angebot → Kaufformular ist mit deinen Daten vorbefüllt; „merken" an → beim nächsten Mal wieder da.
2. Profil → 💳 Zahlungen: `CH9300762011623852957` speichern klappt; `CH00INVALID` zeigt „…CH und hat 21 Zeichen…", Speichern blockiert.
3. Zweites Fenster (ausgeloggt): reserviertes Inserat zeigt „⏳ Reserviert — noch 48 Std." — und aktualisiert sich OHNE Reload, sobald im ersten Fenster reserviert/freigegeben wird.
4. Verkäufer lehnt eine Anfrage ab → Inserat sofort wieder „🔄 Wieder erhältlich!", Käufer bekommt eine Benachrichtigung, Klick öffnet das Inserat.
5. Profil: „📝 Entwürfe (n)" → ein Klick, direkt im Entwürfe-Tab.
6. Neues Angebot erstellen: 💛-48h-Hinweis sichtbar (Formular + Toast).
