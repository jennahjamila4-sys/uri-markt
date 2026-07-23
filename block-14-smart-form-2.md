# BLOCK 14 — SMART FORM 2.0 („In 60 Sekunden ein perfektes Inserat — ohne zu denken")
> Erstellt 23.07.2026 im Planungs-Chat. Alle Fakten gegen die Live-DB `lhqsuelguwfdflapzdhk` verifiziert (D1).
> Scope: NUR der Angebots-Erstell-Flow (ChameleonForm, Tab Angebot) + Zustands-System + Autosave + 48h-Fenster.
> Das Gesuch-Formular bleibt auf Block-10-Stand (übernimmt nur die neue Zustands-Chip-Liste, wo es sie schon nutzt).
> Design: docs/design/design-referenz.html bindend + Frontend-Design-Skill — exklusive, hochwertige Animationen, antigravity style, pulsierend, oder schimmernd-sei kreativ-schwebend-Futuristisch exklusiv einzigartig!
> (Card-Transitions, Erkennungs-Shimmer, Chip-Pop, Gold-Sweep). Keine Stock-Optik, nichts Generisches.
WENN DU TEXTE SCHREIBEN MUSST SCHREIB EMPHATISCH EINLADEND - ENTLASTEND und NUTZE ICONS ide herzlich dazu passen- mit liebe gestalten.
---

## 1. D1-BEFUND (Planungs-Chat, 23.07. — NICHT erneut verifizieren)

| Messung | Ergebnis |
|---|---|
| `listings.condition` | text, KEIN CHECK-Constraint. Live-Altwerte: new, like_new, good, acceptable, NULL |
| `listings.smart_data` | jsonb, vorhanden (Block 10) — trägt alle neuen dynamischen Chips |
| Entwürfe | status='draft', RLS nur Eigentümer (Block 10) — Autosave braucht kein Schema |
| 48h-System | reserved_until + 4 RPCs (create_buy_intent, process_transaction_commission, expire_stale_reservations, warn_expiring_reservations) |
| Kategorien (live) | dienstleistungen, elektronik, fahrzeuge, haustiere, jobs, kindersachen, kleider, moebel, sonstiges, sport — „Schuhe" ist KEINE Kategorie → Subtyp-Erkennung |
| Arabisch/RTL | Root-Cause in Block 13 behoben (PhotoUploadField). Sweep muss grün BLEIBEN |

## 2. VOM PLANUNGS-CHAT EINGESPIELT (vor deinem Start — NICHT erneut verifizieren)

**Migration M14-1** `block14_auto_release_opt_out`:
- `listings.auto_release boolean not null default true`
- `create_buy_intent`: setzt `reserved_until = now()+48h` NUR wenn `auto_release`, sonst NULL (status wird trotzdem 'reserved')
- `process_transaction_commission`: dito beim Bestätigen
- `expire_stale_reservations` + `warn_expiring_reservations`: überspringen Transaktionen, deren Listing `auto_release=false` hat
- D2-Check grün. **DB-Kontrakt für dich:** `auto_release=true` → alles wie bisher (Countdown, Vorwarnung, Auto-Freigabe). `auto_release=false` → `reserved_until IS NULL` bei status='reserved' → UI zeigt „⏳ Reserviert" OHNE Countdown (neuer Fall! Block-11-Karten/Detail entsprechend ergänzen, NICHT „Gleich wieder frei" anzeigen).

**Migration M14-2** (Zustands-Backfill Altdaten) läuft erst NACH deinem PR-Merge im Planungs-Chat. Deshalb: dein Anzeige-Mapping muss die 4 alten Werte (new/like_new/good/acceptable) als Fallback weiter korrekt labeln.

JJ schickt dir als 2. Nachricht die frisch generierte `database.ts` (inkl. `auto_release`) — 1:1 ersetzen, keine Handedits (Lektion 11).

## 3. PRODUKT-KONZEPT (verbindlich)

### 3.1 Zustands-System (Single Source: `src/lib/conditionConfig.ts`)
8 kanonische Grade (slug → Label):
1. `neu_mit_etikett` → „Neu mit Etikett"
2. `neu_ohne_etikett` → „Neu, ungetragen/unbenutzt"
3. `einmal_genutzt` → „Einmal getragen/genutzt"
4. `sehr_gut` → „Selten gebraucht — sehr guter Zustand"
5. `gut` → „Gebraucht — guter Zustand (normale Gebrauchsspuren)"
6. `gebrauchsspuren` → „Gebraucht — sichtbare Gebrauchsspuren"
7. `maengel` → „Mit kleinen Mängeln" → **Pflichtfeld** „Welche Mängel?" (fliesst in description)
8. `defekt` → „Defekt / Bastlerartikel" → **Pflichtfeld** Beschreibung

Zusatz-Chip (kein Grad, kombinierbar): `gereinigt` → „Frisch gewaschen/gereinigt" — nur bei kleider/kindersachen/Schuh-Subtyp; landet in smart_data.

**Anwendbarkeit pro Kategorie** (in conditionConfig, erweiterbar): Textil-Grade (neu_mit_etikett, einmal_genutzt) nur bei kleider/kindersachen/sport(+Schuh-Subtyp); `defekt` nur bei elektronik/moebel/fahrzeuge/sport; dienstleistungen/jobs zeigen KEINE Zustands-Card. Nie unpassende Optionen anzeigen.

**Fallback-Labels Altwerte:** new→„Neu", like_new→„Wie neu", good→„Guter Zustand", acceptable→„Gebrauchsspuren" (nur Anzeige, nie neu wählbar).

**Smart Default:** Titel-/Beschreibungs-Keywords („neu mit Etikett", „ungetragen", „kaum getragen", „wie neu", „defekt", „Bastler", „Fleck", „Kratzer"…) wählen die passende Card VOR (goldener Puls-Rahmen, „✨ Vorschlag — stimmt das?"), User bestätigt mit einem Tap oder wählt anders. Nie stumm übernehmen.

### 3.2 KI-Feld-Engine — die KI ERKENNT den Artikel und BESTIMMT die Felder (Kern des Blocks)
**Prinzip:** Keine starren Subtyp-Listen. Eine Server Action `analyzeListing` (CLAUDE_MODEL_FAST aus src/lib/ai.ts) erhält Fotos (bis 5, ein einziger Call) und/oder den Titel-Freitext und liefert striktes JSON:
- `feed_kategorie` — zwingend EINE der 10 kanonischen App-Kategorien (Feed-Tabs + Matching hängen daran; die KI wählt die passendste, nie neue erfinden)
- `artikel_typ` — Freitext, was es wirklich ist („Kinderschuhe", „Rennvelo", „Nintendo Switch"…)
- `titel_vorschlag`, `beschreibung_vorschlag`
- `felder[]` — die für DIESEN Artikel sinnvollen Eingaben, jedes Feld: `{key, label, typ, optionen?}` mit erlaubten Typen NUR aus fester Whitelist: `chips` (Optionsliste), `zahlen_skala` (min/max/schritt — z. B. Schuhgrösse 18–48), `toggle` (ja/nein — z. B. „Voll funktionsfähig?"), `text` (kurz). Beispiel Schuhe: zahlen_skala 18–48 statt S/M/L/XL — die KI weiss das, weil sie den Artikel versteht.
- `zustand_optionen` — Teilmenge der 8 kanonischen Zustands-Slugs (3.1), die zu diesem Artikel passt, + `zustand_vorschlag` (Smart Default) + `gereinigt_sinnvoll` (bool)

**Render-Engine:** Das Formular rendert `felder[]` generisch (Chip-Band, Zahlen-Band, Toggle, Textfeld) — es kennt keine Kategorien-Logik mehr. Antworten landen in smart_data unter dem von der KI gelieferten `key` (normalisiert: lowercase, keine Leerzeichen). Nur befüllte Keys schreiben.

**Validierung (Pflicht):** JSON-Schema-Check der KI-Antwort (Whitelist-Typen, feed_kategorie ∈ 10er-Liste, Zustands-Slugs ∈ 8er-Liste, max. 8 Felder, Options-Längen begrenzt). Ungültiges wird verworfen, nie ungeprüft gerendert.

**Fallback (nur wenn KI nicht antwortet/Fehler/offline):** die bestehende lokale Block-10-Keyword-Erkennung + Standard-Chips aus gesuchConfig. Der Flow blockiert NIE auf die KI; Antwort kommt asynchron rein („✨ Ich schaue mir deinen Artikel an…"-Shimmer, dann Felder-Morph mit Animation).

Bestehende smart_data-Keys (g-groesse etc.) bleiben gültig (Match-Kompatibilität, Function v5) — die KI wird im Prompt angewiesen, für Standardfälle dieselben Keys zu verwenden (g-groesse, g-marke, g-farbe, g-zustand, g-geschlecht), Neues darf sie frei benennen.

### 3.3 Der Flow — Card für Card (eine Sache pro Schritt, Antigravity-Prinzip)
Vollbild-Cards mit Slide/Fade-Transition, Fortschritts-Punkte oben, „Zurück" immer möglich, alles Optionale überspringbar („Später"-Link, nie Zwang):

1. **Card 1 — Fotos + Titel zuerst.** PhotoUploadField (Block 13, bis 5 Fotos) + Freitextfeld „Was gibst du weiter?".
   - **Mit Foto(s):** EIN `analyzeListing`-Call mit allen bisher hochgeladenen Fotos (max 5) + evtl. Titel; neues Foto danach → genau ein Folge-Call (debounced, nie parallel). Anzeige als Erkennungs-Banner mit Shimmer: „✨ Erkannt: Kinderschuhe, Gr. 32 — passt das?" → ein Tap übernimmt Titel/Kategorie/Beschreibung als VORSCHLAG (alles editierbar), Alternativ-Tap ändert die Kategorie. Fehler/Timeout: geloggt (kein Swallowing, Lektion 7), Flow läuft ohne KI weiter — nie blockierend.
   - **Ohne Foto:** `analyzeListing` nur mit Text (debounced ab ~10 Zeichen); bis die Antwort da ist, greift die lokale Sofort-Erkennung aus Block 10.
2. **Card 2 — Artikel-Details.** Die von der KI gelieferten `felder[]` (3.2), generisch gerendert; Match-Power-Anzeige (Block 10) bleibt und steigt mit jedem befüllten Feld.
3. **Card 3 — Zustand.** Nur die von der KI als passend gelieferten `zustand_optionen` (Fallback ohne KI: Anwendbarkeits-Map aus conditionConfig), `zustand_vorschlag` vorgewählt (goldener Puls, „✨ Vorschlag — stimmt das?"), maengel/defekt blendet Pflichtfeld ein (sichtbarer Fehler + Scroll, Lektion 6 — nie stumm blockieren).
4. **Card 4 — Preis + Gemeinden.** Fixpreis/Gratis-Umschalter, „Verhandelbar"-Chip, Gemeinden-Multichips vorbefüllt (alles Block 10, nur ins Card-Layout gehoben).
5. **Card 5 — Zusammenfassung + Veröffentlichen.** Kompakte Vorschau (Foto, Titel, Chips, Preis) — alles antippbar zum Springen.
6. **Nach Tap „Veröffentlichen" — 48h-Fenster (Modal, VOR dem Insert):** Titel „⚡ Gleich kann's losgehen!". Text (faktisch wahr, weckt intrinsische Motivation zum Vorbeischauen): „Sobald jemand dein Inserat kaufen möchte, startet ein 48-Stunden-Fenster: So lange ist es exklusiv für euch beide reserviert. Meldest du dich in dieser Zeit nicht, landet es automatisch wieder im Feed — und jemand anderes kann zugreifen. Schau also regelmässig vorbei: Vielleicht wartet schon gleich jemand auf genau dein Angebot! 💛" Toggle (Default AN): „48-Std.-Automatik". AUS-Zustand zeigt ehrlich: „Ohne Automatik bleibt eine Reservierung bestehen, bis du selbst entscheidest — dein Inserat kommt dann nicht automatisch zurück in den Feed." Button „Alles klar — veröffentlichen!" → Insert mit `auto_release` gemäss Toggle → danach triggerSmartMatches (Lektion 1). Der 💛-Hinweis aus Block 11 Teil 7 wird durch dieses Modal ERSETZT (kein Doppel).

### 3.4 Autosave („nie wieder etwas verlieren")
- **localStorage** (Key `uri-draft-<userId>`): jede Eingabe sofort gespiegelt (inkl. aktueller Card, Chips, Zustand; Foto-URLs nach Upload). Überlebt App-Abbruch/Tab-Kill.
- **DB-Draft** (bestehender status='draft'-Mechanismus): debounced Upsert (~4s nach letzter Änderung), sobald Titel ≥ 3 Zeichen. Kein neuer Button nötig — „Als Entwurf speichern" bleibt zusätzlich.
- **Recovery:** Beim Öffnen des Formulars: existiert localStorage-Snapshot, der neuer ist als der DB-Draft (oder ohne DB-Draft) → Banner „✨ Dein angefangenes Inserat wartet auf dich — weitermachen?" [Weitermachen / Neu starten]. Nie stumm verwerfen, nie stumm überschreiben.

### 3.5 UI-Zusatz aus M14-1 (Pflicht)
Karten/Detail (Block-11-Komponenten): status='reserved' UND reserved_until IS NULL → „⏳ Reserviert" ohne Countdown (neuer dritter Fall neben Countdown und „Gleich wieder frei").

### 3.6 Text-Prinzip (alle neuen Strings)
Positives Gefühl zuerst, Frage-Form, intrinsisch, IMMER faktisch wahr. Keine erfundenen Zahlen, kein Fake-Druck. Kein Arabisch/RTL — Sweep muss grün bleiben.

## 4. AUFGABEN CLAUDE CODE (Reihenfolge, D3: ein Fix pro Zyklus)

SCHRITT 0 (D1 Repo-Seite, Befund kurz dokumentieren): (a) database.ts-Pfad; (b) ChameleonForm-Struktur heute (Stufen, Erkennungs-Banner, Draft-Save-Stelle, triggerSmartMatches-Aufruf); (c) ALLE condition-Call-Sites (Anzeige, Filter, EditListingModal, Edge-Function-Referenzkopie) — Liste an Übergabe; (d) Wo rendert Block 11 den Reserviert-Sticker/Countdown; (e) src/lib/ai.ts: exakte Export-Namen; (f) existiert bereits ein Vision-Aufruf? (Erwartung: nein).

1. database.ts ersetzen (Datei von JJ, 2. Nachricht).
2. `src/lib/conditionConfig.ts` (3.1: die 8 kanonischen Grade, Fallback-Anwendbarkeits-Map, Smart-Default-Keywords für den Nicht-KI-Fall, Fallback-Labels Altwerte).
3. Server Action `analyzeListing` (3.2: CLAUDE_MODEL_FAST, Vision mit bis 5 Bildern + Text, striktes JSON-Schema inkl. Whitelist-Validierung, try/catch mit Log, nie blockierend) + generische Render-Engine für `felder[]` (chips / zahlen_skala / toggle / text). Bilder als base64 aus der bereits hochgeladenen Storage-URL oder direkt vom Client-File — kleinste saubere Lösung, keine neuen npm-Pakete ohne Rückfrage.
4. ChameleonForm (Tab Angebot) zum Card-Flow umbauen (3.3) — Block-10-Funktionalität (Erkennung, Match-Power, Gratis, Gemeinden, Entwürfe-Button) bleibt vollständig erhalten, nur neu angeordnet. Gesuch-Tab NICHT umbauen.
5. Zustands-Card + Pflicht-Mängelfeld + Smart Default (3.1/3.3 Punkt 3). EditListingModal: neue Zustandsliste + Fallback-Altwerte.
6. 48h-Modal mit auto_release-Toggle (3.3 Punkt 6); Block-11-Hinweis Teil 7 entfernen; UI-Fall reserved ohne Countdown (3.5).
7. Autosave + Recovery (3.4).
8. Design-Politur nach design-referenz.html + Frontend-Design-Skill: exklusive Transitions, Shimmer, Chip-Pop, Gold-Sweep — hochwertig, einzigartig; 60fps, prefers-reduced-motion respektieren.
9. E2E `e2e/block14-smart-form.spec.ts` (serial, E2E_USER_A/B, Preflight Lektion 14, Cleanup „E2E-B14"-Daten vor+nach):
   - T1 KI-Felder (deterministisch): analyzeListing per page.route mocken — Antwort „Schuhe" mit zahlen_skala 18–48 → numerisches Grössen-Band erscheint, KEIN XL-Chip im DOM; 38 wählen → veröffentlichen → Detail zeigt Grösse 38 aus smart_data.
   - T2 Zustand + Pflicht: „defekt" wählen → Veröffentlichen ohne Mängeltext zeigt sichtbaren Fehler; mit Text → durch; Detail zeigt Zustand.
   - T3 Smart Default (Mock): zustand_vorschlag='sehr_gut' → Card vorgewählt/markiert, ein Tap bestätigt.
   - T4 Ungültige KI-Antwort (Mock): unbekannter Feld-Typ + fremde Kategorie → wird verworfen, Fallback-Formular erscheint, kein Crash. (Echter KI-Call mit Foto = JJ-Klick-Test, ehrlich UNGETESTET markieren.)
   - T5 Autosave: Titel+Chips eingeben, Seite hart neu laden → Recovery-Banner → „Weitermachen" → alles wieder da.
   - T6 48h-Toggle: (a) Default AN veröffentlichen → B stellt Kaufanfrage → reserved_until gesetzt, Countdown sichtbar. (b) Toggle AUS → Kaufanfrage → status='reserved', reserved_until NULL (Service-Role-Check), Karte „Reserviert" ohne Countdown; Service-Role-Call expire_stale_reservations → Inserat BLEIBT reserved.
   - T7 Regression Altwerte: Listing mit condition='good' per Service-Role geseedet → Detail zeigt „Guter Zustand".
10. DOCS + ABSCHLUSS: database-schema.md (auto_release, RPC-Verhalten, neue condition-Werte + geplanter Backfill), neue Lektionen in CLAUDE.md, uebergabe-2026-07-XX-block14.md (BEWIESEN/UNGETESTET/ANGEFANGEN), tsc+ESLint+build 0 Errors in der Sandbox, Playwright = JJ lokal via run-verify.ps1. Auslieferung als PR. Bei ROT: Fix-Commits auf denselben Branch.

STOP-REGELN: Max 3 Root-Cause-Zyklen pro Bug → STOPP-Bericht. DB-Hypothesen → STOPP, Frage an Planungs-Chat. Keine neuen npm-Pakete ohne Rückfrage. Feed-/Deal-/Match-Flows dürfen nicht regressieren. Kein Push auf main.

## 5. ABSCHLUSS-CHECKLISTE BLOCK 14
```
[ ] M14-1 auto_release + 4 RPCs + D2 grün (Planungs-Chat, VOR Claude-Code-Start)
[ ] conditionConfig + subtypes-Erweiterung
[ ] Card-Flow Angebot (Foto+Titel zuerst, KI-Vorschlag, Zustand, 48h-Modal)
[ ] Autosave + Recovery
[ ] E2E T1–T7 grün lokal (run-verify.ps1) | PR gemergt | Deploy grün
[ ] M14-2 condition-Backfill (Planungs-Chat, NACH Deploy) + D2
[ ] JJ-Klick-Test echter Foto-KI-Call
```
