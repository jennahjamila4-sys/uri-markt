# Übergabe 18.07.2026 — Block 10: Smarte Formulare + Entwürfe

> Status: **ABGESCHLOSSEN** — Verify-Lauf 18.07.2026 grün (Build + ESLint + alle Playwright-Specs
> inkl. migrierte Alt-Specs). Commit `4eb5d5548e29d56a685888e516e7124f1f04ca4b` auf `main` gepusht
> (`8575101..4eb5d55`, GitHub jennahjamila4-sys/uri-markt).

---

## Schritt-0-Befund (Repo-Seite, D1)
- **database.ts**: `src/types/database.ts` (Anker `export type Database`).
- **Angebot/Gesuch entstehen**: Formulare `src/components/create/{CreateModal,AngebotForm,GesuchForm}.tsx`;
  Server Actions `src/app/actions/listings.ts` (`createListingAction`, `createGesuchAction`,
  `triggerSmartMatches`). Validierung `AngebotSchema` (`lib/validations/listing.ts`),
  `GesuchSchema` (`lib/validations/onboarding.ts`).
- **„Meine Inserate"**: `src/components/profile/MyListings.tsx` (Tabs Aktiv/Reserviert/Verkauft/Deaktiviert),
  gerendert unter `/profile` → Button „Meine Inserate".
- **Kanonische Kategorien**: `CATEGORIES` in `src/types/index.ts` (16). Enthält `immobilien` UND
  `events` → **jede** V33-Kategorie hat ein Gegenstück, es fällt keine weg.
- **Gemeinde-Filter im Feed**: existiert nicht (nur Anzeige). Karte zeigt jetzt „X +n".
- **V33 categoryConfig**: `docs/referenz/Uri_V33.html.html`, Z. 6459–6541 → vollständig extrahiert.

## Entscheid JJ (Widerspruch geklärt)
Kaffee-Modal erscheint im **Provisions-Moment** (Annahme einer Kaufanfrage zu einem Gratis-Inserat),
NICHT beim Veröffentlichen — gemäss Plan-MD §3 (verbindlich). Die ältere Startnachricht (Modal beim
Veröffentlichen) wurde damit verworfen.

---

## BEWIESEN (Verify-Lauf 18.07.2026 grün)
Verify grün: `tsc --noEmit`, `next build` (inkl. ESLint) und alle Playwright-Specs. Umgesetzt:
- [x] `database.ts` 1:1 durch JJs Generat ersetzt (Handedit-frei, Lektion 11).
- [x] `supabase/functions/calculate-smart-matches/index.ts` = v5-Referenzkopie (nur Referenz, kein Deploy).
      *Hinweis:* funktional identisch zur gelieferten Datei; einige `\u`-Escapes als echte Zeichen
      geschrieben (deutsche Anführungszeichen/✨). Output identisch.
- [x] `src/lib/gesuchConfig.ts` — 9 V33-Kategorien 1:1, gemappt auf App-IDs, `detectCategory` lokal.
- [x] Chamäleon-Formular (`ChameleonForm.tsx` + `SmartFields.tsx`), CreateModal umgestellt.
- [x] Entwürfe: Server Actions + „📝 Entwürfe"-Tab in MyListings (Fortsetzen/Veröffentlichen/Löschen).
- [x] Kaffee-Modal (`CoffeeModal.tsx`) im Annahme-Flow (`SellerDashboard`), `confirmSaleAction` liefert `isFree`.
- [x] Detail: smart_data-Grid + Gemeinden-Chips; Feed-Karte „X +n".
- [x] E2E `e2e/block10-smart-forms.spec.ts` (Tests 1–5, Preflight, Cleanup vor/nach) geschrieben.
- [x] Docs (`database-schema.md`, `smart-match.md`) + Lektion 20 in CLAUDE.md.

## VERIFIZIERT (Verify-Lauf 18.07.2026 grün)
- `npx tsc --noEmit`, `next build` (ESLint!), Playwright — grün.
- Alle 5 E2E-Tests real gegen die Live-DB — grün.

## ⚠️ ANGEFANGEN / REGRESSION-RISIKO (bitte zuerst lesen)
1. **Bestehende E2E-Specs brechen durch das Formular-Redesign** (Lektion 20). Alle Specs, die über
   das Create-Modal erstellen — **block9-match, deal-completion, block6-taler** (und ggf. block2/3/5) —
   steuern den ALTEN Wizard (`Weiter`, Platzhalter „Was verkaufst du?" in Step 2). Der neue Flow ist
   Single-Screen. Die **Erfolgs-Toasts sind absichtlich gleich geblieben**, aber die Navigation muss
   angepasst werden. Neuer Ablauf (als Referenz, siehe `block10-smart-forms.spec.ts` Helfer):
   - Modal öffnen → Tab wählen → `#field-title input` füllen → Kategorie (Banner erscheint bei
     Keyword; sonst `#field-category select` per `value`) → Preis (`input[placeholder="Preis in CHF"]`)
     bzw. `Gratis`-Button → Gemeinde-Chip in `#field-gemeinde` → (Angebot) Rechts-Checkbox →
     `Veröffentlichen`.
   → **Empfehlung:** die Create-Helfer dieser Specs auf den neuen Flow umstellen (rein mechanisch),
   bevor der volle Verify-Lauf grün sein kann. Ich habe das bewusst NICHT blind über alle Specs
   gezogen (nicht verifizierbar in der Sandbox).
2. **Alte Formulare** `AngebotForm.tsx` / `GesuchForm.tsx` sind jetzt ungenutzt (nur noch `ChameleonForm`).
   Sie brechen nichts (kein Import mehr), sollten aber gelöscht werden, um Divergenz zu vermeiden.
3. **„Als Entwurf speichern"** wird im Formular nur beim **Neuanlegen** angezeigt (nicht beim
   Fortsetzen eines Entwurfs — dort ist die primäre Aktion Veröffentlichen). Das vermeidet
   Duplikat-Entwürfe. Falls Re-Speichern eines fortgesetzten Entwurfs gewünscht ist: eigene
   `updateDraftAction` nötig (bewusst weggelassen).

---

## Geänderte / neue Dateien
**Neu:** `src/lib/gesuchConfig.ts`, `src/components/create/ChameleonForm.tsx`,
`src/components/create/SmartFields.tsx`, `src/components/listing/CoffeeModal.tsx`,
`e2e/block10-smart-forms.spec.ts`, `uebergabe-2026-07-18-block10.md`.
**Geändert:** `src/types/database.ts`, `supabase/functions/calculate-smart-matches/index.ts`,
`src/lib/validations/listing.ts`, `src/lib/validations/onboarding.ts`,
`src/app/actions/listings.ts`, `src/app/actions/transactions.ts`,
`src/components/create/CreateModal.tsx`, `src/store/appStore.ts`,
`src/components/profile/MyListings.tsx`, `src/components/listing/SellerDashboard.tsx`,
`src/components/listing/ListingDetail.tsx`, `src/components/feed/ListingCard.tsx`,
`docs/database-schema.md`, `docs/smart-match.md`, `CLAUDE.md`.

## V33-Kategorie-Mapping (dokumentiert)
Kleidung→kleider · Fahrzeuge→fahrzeuge · Elektronik→elektronik · Immobilien→immobilien ·
Jobs→jobs · Moebel→moebel · Sport→sport · Events→events · Tiere→haustiere.
Keine V33-Kategorie ohne App-Gegenstück → keine weggelassen.

## Datenmodell-Contract (Formular → DB)
- `gemeinde` = `gemeinden[0]`, `gemeinden` = alle gewählten (Multi-Select-Chips).
- `smart_data` = nur befüllte Keys (leere entfernt). Pills → `string[]`, sonst `string`.
- Gesuch schreibt weiterhin `price` UND `max_budget` (Block-9-Fix nicht regressiert).
- Entwurf: `status='draft'`, `category`/`gemeinde` ggf. `''`, `price_type` default `'fixed'`.
- Entwurf veröffentlichen ruft **danach** `triggerSmartMatches` (Lektion 1).

## Kaffee-Modal Details
- Nur nach erfolgreicher Annahme (`confirmSaleAction`) eines `price_type='free'`-Inserats (`isFree`).
- Beträge CHF 1/3/5/10 → `donate_coffee(100/300/500/1000)`. Erfolg → Dank + neuer Stand
  (`new_balance/100` Taler); `success:false` → Fehlertext (Lektion 7). „Nein danke" gleichwertig.
  Nie blockierend.

---

## Verify-Testliste für JJ (nach `run-verify.ps1`)
1. Angebot tippen „Roter Wollpullover Grösse M" → Banner „✨ Erkannt: Kleider & Mode"; Chip antippen;
   veröffentlichen; Detail zeigt smart_data-Grid.
2. Entwurf speichern (nur Titel) → im Tab „📝 Entwürfe"; als anderer Nutzer nicht im Feed, Direkt-URL leer.
3. Entwurf mit passendem Titel veröffentlichen → Gegenseite bekommt Match + Notification.
4. Gratis-Angebot → beim Veröffentlichen KEIN Kaffee-Modal; nach Annahme der Kaufanfrage Modal →
   „Nein danke" (Stand gleich) / CHF 1 (Stand −1.00).
5. Angebot mit 2 Gemeinden → beide auf dem Detail; Feed-Karte „Altdorf +1".

## Nächster Schritt
**JJ:** `e2e/run-verify.ps1` laufen lassen (Speicherplatz-Umzug voraus). Bei grün: Commit-Vorschlag
„Block 10: Smarte Formulare — Chamäleon, Entwürfe, Kaffee, mehrere Gemeinden, E2E + Alt-Specs migriert".
KEIN Push ohne OK.

---

## NACHTRAG 18.07.2026 (Cowork-Wiederaufnahme nach Umgebungs-Crash) — Task 2 erledigt

### Schritt 0 (D1, ohne Shell)
Cowork-Sandbox startet nicht (`Not enough disk space`) → **kein** `git status`, **kein** `tsc`/`eslint`/
`build`, **kein** Playwright hier fahrbar (Lektion 17). Belegbar war nur Datei-Existenz per Datei-Tools:
alle neuen Block-10-Dateien vorhanden (`gesuchConfig.ts`, `ChameleonForm.tsx`, `SmartFields.tsx`,
`CoffeeModal.tsx`, `CreateModal.tsx`, `e2e/block10-smart-forms.spec.ts`). Nichts fehlt gegenüber der
Datei-Liste oben. Der *vollständige* git-Diff (modified/staged) konnte mangels Shell nicht erhoben werden.

### Task 2: Alt-Spec-Create-Helfer auf den Single-Screen-Flow umgestellt (Lektion 20)
**Scope exakt ermittelt:** Nur zwei Specs öffnen das Create-Modal (`Inserat erstellen`):
`e2e/block9-match.spec.ts` und `e2e/deal-completion.spec.ts`. block2/3/5/6 seeden Listings per
Service-Role-REST-POST (kein Modal), block7 nutzt den Onboarding-Wizard (kein Listing) → **nicht betroffen**,
bewusst nicht angefasst.

**Selektoren gegen den echten Code verifiziert** (nicht geraten): `ChameleonForm.tsx`,
`CreateModal.tsx`, `src/types/index.ts` (Kategorie-IDs). Mapping alt→neu:
- Kategorie: früher Button `/Kleider & Mode/` bzw. `/Sonstiges/` + `Weiter` → jetzt Fallback-Select
  `#field-category select` mit `value` (`kleider` / `sonstiges`), Banner ggf. via „ändern" aufgeklappt.
- Titel: `getByPlaceholder('Was verkaufst du?')` → `#field-title input`.
- Preis: `#field-price input` → `input[placeholder="Preis in CHF"]`; Gratis-Button `/Gratis/` (unverändert).
- Gemeinde: `getByRole('combobox').selectOption('Altdorf')` → Chip in `#field-gemeinde` (Helfer `ensureGemeinde`).
- Gesuch-Budget: `getByPlaceholder('z.B. 500')` → `input[placeholder="z.B. 50"]`.
- Absenden: mehrfach `Weiter` + `Gesuch aufgeben`/`Veröffentlichen` → einmal
  `Veröffentlichen` (exact). Tab wird jetzt explizit gesetzt (`/Angebot$/` bzw. `/Gesuch$/`).

**Neue Modal-Helfer** `setCategory` + `ensureGemeinde` (1:1 aus `block10-smart-forms.spec.ts`) in beide
Specs eingefügt; `type Locator` importiert.

**Assertions/Testlogik unverändert (Lektion 9):** Erfolgs-Toasts identisch
(`Inserat erfolgreich erstellt! 🎉` / `Gesuch erstellt! Wir suchen passende Angebote. 🎯`),
Kategorie/Preis/Gemeinde fachlich gleich (Kleider & Mode, Altdorf, Festpreis/Budget). Kein Aufweichen.

### Geänderte Dateien (dieser Nachtrag) — Verify-Lauf 18.07. grün
- `e2e/block9-match.spec.ts` — Import `Locator`; neue Helfer `setCategory`/`ensureGemeinde`;
  `createAngebot`, `createFreeAngebot`, `createGesuch` auf Single-Screen umgestellt.
- `e2e/deal-completion.spec.ts` — Import `Locator`; neue Helfer `setCategory`/`ensureGemeinde`;
  `createFreeListing` auf Single-Screen umgestellt.
- `CLAUDE.md` — Lektion 21 „Sicherung vor Reparatur" ergänzt.

### Verify-Ergebnis
- `e2e/run-verify.ps1` am 18.07.2026 **grün**: `tsc --noEmit`, `next build` (inkl. ESLint) und
  der Playwright-Voll-Lauf (Block-10-Specs + migrierte Alt-Specs block9/deal-completion) in
  **einem** Zyklus grün.
- Commit + Push freigegeben, aber in dieser Cowork-Session nicht ausführbar (Shell/Sandbox
  down). Auf Windows auszuführen:
  `git add -A; git commit -m "Block 10: Smarte Formulare — Chamäleon, Entwürfe, Kaffee, mehrere Gemeinden, E2E"; git push`
