# Übergabe 23.07.2026 — Block 14: Smart Form 2.0

> Auslieferung als **Pull Request** (kein Push auf main). Gates im Cloud-Sandbox
> gefahren, soweit ohne Secrets möglich. Status strikt: **BEWIESEN / UNGETESTET /
> ANGEFANGEN**. DB **nur gelesen** — keine Migration, kein Deploy.

---

## 0. database.ts + Streuner (BEWIESEN)
- Streuner aus Commit `23708a4` („Add files via upload") am Repo-Root gefunden:
  `database.ts` (982 Z.) + `block-14-smart-form-2.md` (127 Z.).
- `database.ts` **1:1** nach `src/types/database.ts` übernommen — Diff = **nur die 3
  `auto_release`-Zeilen** (Row/Insert/Update). Kein Handedit (Lektion 11).
- Streuner `database.ts` **gelöscht**; Plan nach `docs/planung/block-14-smart-form-2.md`
  verschoben (`git mv`).

## SCHRITT 0 — Repo-D1-Befund (BEWIESEN, aus dem Code)
| Frage | Befund |
|---|---|
| (a) database.ts-Pfad | `src/types/database.ts` (Suche „export type Database"). |
| (b) ChameleonForm heute | Single-Screen (3 Stufen), lokale `detectCategory`+KI-Fallback (`suggestCategoryAction`), Draft via `saveDraftAction`, Publish via `createListingAction`/`publishDraftAction` → `triggerSmartMatches`. |
| (c) condition-Call-Sites | `validations/listing.ts` (Enum), `actions/listings.ts` (create/update/publish/draft), `ChameleonForm.tsx`, `EditListingModal.tsx`, `MyListings.tsx`, `store/appStore.ts`, `types/database.ts`. **Anzeige gab es bisher NICHT** (condition wurde gespeichert, aber nie im Detail gezeigt) → neu ergänzt. |
| (d) Reserviert-Sticker/Countdown | `ListingCard.tsx` (`reserved-badge` via `reservedRemainingText`), `DealFlow.tsx`, `SellerDashboard.tsx`/`BuyerDashboard.tsx` (via `dealRemainingText`). |
| (e) `src/lib/ai.ts` Exporte | `CLAUDE_MODEL='claude-sonnet-4-6'`, `CLAUDE_MODEL_FAST='claude-haiku-4-5'`. |
| (f) Vision-Aufruf vorhanden? | **Nein** — nur Text (`suggestCategoryAction`). Vision ist neu. |

---

## Aufgaben 2–10

### 2. `src/lib/conditionConfig.ts` — BEWIESEN (Code)
8 kanonische Grade (Slug→Label), Anwendbarkeits-Map (Textil-Grade nur kleider/
kindersachen/sport+Schuh; `defekt` nur elektronik/moebel/fahrzeuge/sport/werkzeug;
dienstleistungen/jobs zeigen keine Card), `gereinigt`-Zusatz, Smart-Default-
Keyword-Erkennung, Altwert-Fallback-Labels, `conditionLabel()`, `detectShoeSubtype()`.

### 3. KI-Feld-Engine — BEWIESEN (Code) / UNGETESTET (echter Call)
- **`src/app/api/analyze-listing/route.ts`** (Route-Handler, kein Server-Action —
  begründet in Lektion 32): Auth-Check, bis 5 Bilder als base64 aus den Storage-URLs,
  `CLAUDE_MODEL_FAST`, strikter JSON-Prompt. **Nie blockierend** → `{result:null}` bei
  jedem Fehler (geloggt). Keine neuen npm-Pakete.
- **`src/lib/analyzeListing.ts`**: Typen + `validateAnalyzeResult` (Whitelist, siehe
  Lektion 32). Läuft server- UND client-seitig (2. Verteidigungslinie).
- **`src/components/create/AiFields.tsx`**: generische Render-Engine
  (chips / zahlen_skala / toggle / text) → smart_data unter normalisiertem KI-`key`.

### 4./5./6./7./8. Card-Flow — BEWIESEN (Code) / UNGETESTET (E2E)
- **`AngebotCardFlow.tsx`** (Angebots-Tab; Gesuch bleibt Block-10-Formular, Plan §4):
  5 Cards (Foto+Titel → Details → Zustand → Preis/Ort → Zusammenfassung), Fortschritts-
  Punkte, „Zurück" immer, Card-in/Shimmer/Chip-Pop/Puls-Gold-Animationen (60fps,
  `prefers-reduced-motion` respektiert). Lokale Sofort-Erkennung + KI-Banner + editierbarer
  Vorschlag; Match-Power bleibt. **Zustands-Card** mit Smart-Default (goldener Puls,
  „✨ Vorschlag — stimmt das?") + Pflicht-Mängelfeld (sichtbarer Fehler + Scroll,
  Lektion 6). **48h-Modal VOR dem Insert** mit `auto_release`-Toggle (Default AN, ehrlicher
  AUS-Text); Block-11-`reserve-hint` entfernt (kein Doppel). **Autosave**: localStorage-
  Recovery-Banner (nie stumm verwerfen/überschreiben) + debounced Draft-Upsert
  (`autosaveDraftAction` — genau EINE Draft-Zeile pro Inserat, kein Spam).
- **`ListingDetail`**: `detail-condition` zeigt Zustand (kanonisch + Altwert-Fallback).
- **`EditListingModal`**: neue 8-Slug-Auswahl + Altwert bleibt sichtbar (bis Backfill).
- **Reserved ohne Countdown** (`auto_release=false`): Card/DealFlow via null-sicherem
  `reservedRemainingText`; Seller/Buyer-Dashboard verzweigen ehrlich (kein „wird wieder
  frei"). `auto_release` in die tx→listing-Selects mitgeladen.
- **`validations/listing.ts`**: `condition` optional + 12 zulässige Werte (8 neu + 4
  Legacy); `auto_release` optional. `actions/listings.ts`: create/publish/draft schreiben
  `auto_release` + neue condition; `autosaveDraftAction` ergänzt.

### 9. E2E `e2e/block14-smart-form.spec.ts` — ANGEFANGEN/UNGETESTET (Sandbox ohne Konten)
T1 KI-Zahlen-Skala 18–48 (kein XL im DOM, 38 → Detail) · T2 defekt-Pflichtfeld
(sichtbarer Fehler) · T3 Smart-Default vorgewählt + ein-Tap · T4 ungültige KI verworfen →
Fallback, kein Crash · T5 Autosave-Recovery nach Reload · T6a/b 48h-Toggle AN (Countdown)
/ AUS (reserved ohne Countdown, `expire_stale_reservations` lässt es reserved) · T7
Altwert `good` → „Guter Zustand". KI in T1/T3/T4 per `page.route` gemockt.
**Alt-Specs nachgezogen** (Lektion 33): block9/10/11 + deal-completion — Card-Nav-Helfer
+ 48h-Bestätigung + KI-Endpoint auf `{result:null}` gemockt (deterministischer Fallback).

### 10. Gates (Cloud-Sandbox)
- **`npm ci`**: ok. **`./node_modules/.bin/tsc --noEmit`: GRÜN (0)** — inkl. `e2e/**`
  (tsconfig `include: **/*.ts`). **ESLint (`next lint --dir src`): GRÜN (0)**.
  **`next build` (Dummy-`NEXT_PUBLIC_*`): GRÜN (Exit 0)**, 10/10 Seiten, Route
  `/api/analyze-listing` registriert. Nichts an `.env.local` angelegt (Lektion 27).
- **Playwright: UNGETESTET** — Preflight braucht `.env.local` + `E2E_USER_A/B`; im
  Sandbox nicht vorhanden. → **JJ fährt `e2e/run-verify.ps1`** auf dem PR-Branch. Bei
  ROT: Fix-Commits auf **denselben** Branch (kein neuer PR). Erst grüner Lauf = fertig
  (Lektion 26).

---

## Geänderte / neue Dateien
**Neu:** `src/lib/conditionConfig.ts`, `src/lib/analyzeListing.ts`,
`src/app/api/analyze-listing/route.ts`, `src/components/create/AiFields.tsx`,
`src/components/create/AngebotCardFlow.tsx`, `e2e/block14-smart-form.spec.ts`,
`uebergabe-2026-07-23-block14.md`, `docs/planung/block-14-smart-form-2.md` (verschoben).
**Geändert:** `src/types/database.ts` (+auto_release), `src/lib/validations/listing.ts`,
`src/app/actions/listings.ts`, `src/components/create/ChameleonForm.tsx` (Angebot →
Card-Flow, reserve-hint raus), `src/components/profile/EditListingModal.tsx`,
`src/components/listing/ListingDetail.tsx`, `src/components/listing/SellerDashboard.tsx`,
`src/components/profile/BuyerDashboard.tsx`, `src/app/profile/page.tsx`,
`tailwind.config.ts`, `src/app/globals.css`, `docs/database-schema.md`, `CLAUDE.md`,
`e2e/block9-match.spec.ts`, `e2e/block10-smart-forms.spec.ts`, `e2e/block11-deal.spec.ts`,
`e2e/deal-completion.spec.ts`.
**Gelöscht:** `database.ts` (Streuner am Repo-Root).

## Nicht angefasst (bewusst)
- **DB:** nur gelesen. Migration M14-2 (condition-Backfill) läuft NACH Merge im
  Planungs-Chat; bis dahin labelt `conditionLabel()` die Altwerte.
- **Gesuch-Tab:** bleibt auf Block-10-Formular (Plan §4).

## JJ-Restschritte
1. `e2e/run-verify.ps1` auf dem PR-Branch (tsc + ESLint + Playwright T1–T7 + Alt-Specs).
2. JJ-Klick-Test: echter Foto-KI-Call (Vision) — im Sandbox nicht testbar.
3. Nach Merge: M14-2 condition-Backfill im Planungs-Chat + D2.

## Klick-Testliste für JJ
1. „+" → Angebot: Card-Reise (Fotos+Titel → Details → Zustand → Preis/Ort →
   Zusammenfassung), Fortschritts-Punkte, „Zurück" überall.
2. Foto hochladen → „✨ Erkannt: …"-Banner (mit echtem Key); Tap übernimmt Vorschlag.
3. Zustand „Defekt" → Veröffentlichen ohne Text zeigt roten Pflichthinweis.
4. Veröffentlichen → 48h-Modal; Toggle AUS → ehrlicher Hinweis; „Alles klar" → Inserat live.
5. Formular abbrechen (Tab schliessen) → erneut öffnen → „✨ Dein angefangenes Inserat
   wartet …" → Weitermachen stellt alles wieder her.
6. Kauf auf `auto_release=false`-Inserat → Karte „⏳ Reserviert" OHNE Countdown.
