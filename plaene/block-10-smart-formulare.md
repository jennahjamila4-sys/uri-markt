# BLOCK 10 — SMARTE FORMULARE + ENTWÜRFE („Nie denken müssen, was einzutragen ist")
> Erstellt 17.07.2026 im Planungs-Chat. Alle Fakten gegen die Live-DB `lhqsuelguwfdflapzdhk` verifiziert (D1).
> Deckt ab: APP_TEST 2, 4, 4.1, 4.2. Restplan-Block 10. Ein Block = ein Feature, grüne E2E, kein Push ohne JJ-OK.

---

## 1. D1-BEFUND (bewiesen 17.07.2026)

| Messung | Ergebnis |
|---|---|
| `smart_data` / `gemeinden` auf listings | fehlten → Migration 10-1 (ERLEDIGT) |
| CHECK-Constraint auf `listings.status` | keiner — `draft` erlaubt; Live-Werte: active/reserved/sold |
| Policy „Listings: public select" | war `qual: true` → Draft-Leak-Risiko → ersetzt (ERLEDIGT) |
| Grants | `anon` hatte INSERT/UPDATE/DELETE auf listings; anon+authenticated hatten volle Schreibrechte auf wallet_transactions → gehärtet (ERLEDIGT) |
| NOT NULL auf listings | title, category, gemeinde, type, price_type, status, user_id |
| Live-Kategorien (Daten) | dienstleistungen, elektronik, fahrzeuge, haustiere, jobs, kindersachen, kleider, moebel, sport |
| price_type Live-Werte | fixed, free, auction |
| profiles | hat `gemeinde` (Vorbefüllung) und `credits` (Kaffee) |
| wallet_transactions | kein CHECK auf type → 'coffee' erlaubt; amount bigint (Rappen) |
| Edge Function | war v4 (Scoring nur Titel+Beschreibung, nur alte gemeinde-Spalte) → v5 deployed (ERLEDIGT) |

## 2. TEIL A — VOM PLANUNGS-CHAT BEREITS ERLEDIGT (17.07., NICHT erneut verifizieren)

1. **Migration 10-1** eingespielt: `listings.smart_data jsonb`; `listings.gemeinden text[] not null default '{}'` (bestehende 15 Inserate: gemeinden = [gemeinde] übernommen); Policy „Listings: public select" ersetzt durch `status <> 'draft' OR user_id = auth.uid()` (Entwürfe API-seitig nur für Eigentümer); Grant-Härtung: listings anon = nur SELECT; wallet_transactions anon = nichts, authenticated = nur SELECT. **D2-Check grün** (alle Grants exakt minimal, Policy verifiziert).
2. **Migration 10-2** eingespielt: RPC `donate_coffee(p_amount_rappen bigint)` — SECURITY DEFINER, search_path fixiert, EXECUTE nur authenticated/service_role. Atomarer Abzug (ein UPDATE mit Guthaben-Bedingung, kein Read-then-Write), erlaubte Beträge 100/300/500/1000 Rappen, Wallet-Log Typ 'coffee', jsonb-Antwort `{success, new_balance}` bzw. `{success:false, error}` mit freundlicher Meldung bei zu wenig Guthaben.
3. **Edge Function v5 deployed** (ACTIVE, verify_jwt an): smart_data fliesst in KI-Prompt UND Fallback-Heuristik; Gemeinde-Bonus = Überlappung der `gemeinden`-Listen (Fallback alte Spalte). Bundling grün = Syntax bewiesen. **Logik UNGETESTET** — Beweis ist E2E-Test 3 dieses Blocks.
4. **Types frisch generiert** (offizielle Generierung, Lektion 11) — Datei `database.ts` liegt bei; enthält smart_data, gemeinden, donate_coffee. Ersetzt die Datei mit den Hand-Edits aus Phase 2 vollständig.

## 3. PRODUKT-KONZEPT (JJ-Entscheide 17.07., verbindlich)

**Progressive Entlastung, 3 Stufen (Gesuch UND Angebot):**
- **Stufe 1 (Pflicht):** ein Freitextfeld („Was verkaufst du?" / „Was suchst du?"). Lokale Keyword-Erkennung beim Tippen → Banner „✨ Erkannt: [Kategorie]" (antippbar zum Ändern), sonst Fallback-Select. KI-Fallback (CLAUDE_MODEL_FAST via src/lib/ai.ts, Server Action) NUR wenn nach 15+ Zeichen kein lokaler Treffer UND keine manuelle Wahl — debounced, nie blockierend. Gemeinden vorbefüllt aus profiles.gemeinde. Preis-Modell-Umschalter (erweiterbare Komponente): **Fixpreis (Default) | 🎁 Gratis**. KEIN „Preis auf Anfrage". Auktion kommt als späterer Block — KEIN toter Auktions-Button (keine Fake-UI).
- **Stufe 2 (Match-Booster):** kategorie-spezifische Felder als antippbare Chips/Pills (nie leere Textfelder wo vermeidbar). Daneben ehrliche **„Match-Power"-Anzeige** (qualitativ, steigt mit ausgefüllten Chips — ehrlich, weil smart_data real in den Score fliesst) + Nutzen-Text („So finden dich Käufer schneller"). Chip „Verhandelbar" immer verfügbar.
- **Stufe 3 („Mehr Details", eingeklappt):** Beschreibung, Foto, Versand/Abholung etc. **Foto OPTIONAL** mit ehrlichem qualitativem Nudge („Mit Foto verkaufst du deutlich schneller") — keine erfundenen Zahlen (Wettbewerbsrecht).

**Mehrere Gemeinden:** Multi-Select-Chips. Schreiben: `gemeinde` = erste Auswahl (Kompatibilität), `gemeinden` = alle. Anzeige Detail: alle als Chips; Karte kompakt „Altdorf +2".

**Gratis + Kaffee (Zeitpunkt-Entscheid JJ 17.07.):** Das Kaffee-Modal erscheint NICHT beim Veröffentlichen, sondern im Provisions-Moment: wenn der Verkäufer die Kaufanfrage zu einem price_type='free'-Inserat ANNIMMT (dieselbe Stelle, an der bei bezahlten Deals `process_transaction_commission` die 10% abzieht — live verifiziert: bei Gratis zieht die RPC sauber 0 ab und bestätigt normal, kein Umbau nötig). Nach erfolgreicher Annahme EINMAL pro Transaktion: Titel „🎉 Vergeben!", Body „Dein Geschenk macht gerade jemanden aus Uri glücklich. Wenn dich das freut: Magst du Uri-Markt einen Kaffee spendieren? ☕" Buttons CHF 1/3/5/10 → RPC `donate_coffee` (100/300/500/1000 Rappen) + gleichwertiger Button „Nein danke". Text-Prinzip für ALLE Block-10-Texte (Nudges, Match-Power, Leerzustände): positives Gefühl zuerst, Frage-Form, intrinsische Motivation — und immer faktisch wahr. Nie blockierend, Veröffentlichung ist zu dem Zeitpunkt schon durch. RPC-Fehler ehrlich anzeigen (Lektion 7), Erfolg: kurzer Dank + neuer Taler-Stand (credits/100).

**Entwürfe:** „Als Entwurf speichern" — einzige Anforderung: Titel ≥ 3 Zeichen. NOT-NULL-Spalten ohne Nutzereingabe werden beim Entwurf als Leerstring gespeichert (category ''/gemeinde '' erfüllen NOT NULL); price_type Default 'fixed'; status='draft'. Veröffentlichen validiert vollständig (Titel ≥3, Kategorie gesetzt, ≥1 Gemeinde, Preis-Modell) mit sichtbaren Fehlern + Scroll zum ersten Fehler (Lektion 6). Entwürfe erscheinen nie im Feed (RLS beweist es API-seitig). Tab „📝 Entwürfe" in Meine Inserate: Fortsetzen (Formular vorbefüllt inkl. smart_data), Veröffentlichen, Löschen. **Veröffentlichen eines Entwurfs ruft `triggerSmartMatches` auf (Lektion 1 — neuer Codepfad!).**

**gesuchConfig:** categoryConfig 1:1 aus `docs/referenz/Uri_V33.html` nach `src/lib/gesuchConfig.ts` (9 Kategorien, Keyword-Listen, Feldtypen pills/toggle/slider/select/date/text/number). V33-Kategorien werden auf die kanonische App-Kategorieliste gemappt (Kleidung→kleider, Tiere→haustiere usw. — Schritt 0 verifiziert die App-Liste). V33-Kategorien ohne App-Gegenstück (voraussichtlich Immobilien, Events): NICHT als neue Feed-Kategorie erfinden — weglassen und in der Übergabe notieren. **Nicht starr:** ALLE App-Kategorien bleiben wählbar; Kategorien ohne Chip-Config nutzen das normale Formular (nichts blockiert). gesuchConfig.ts ist erweiterbar — neue Kategorie/neue Chips später = ein Eintrag, kein Umbau.

## 4. DATEIEN — WAS / WOHIN / WANN (JJ)

| Datei | WAS | WOHIN (exakt) | WANN |
|---|---|---|---|
| `block-10-smart-formulare.md` | dieser Plan | 1) Claude-Projekt hochladen 2) `C:\Users\El Hamd\uri-markt\docs\planung\block-10-smart-formulare.md` | jetzt |
| `Uri_V33.html` (deine Datei) | V33-Referenz für categoryConfig | `C:\Users\El Hamd\uri-markt\docs\referenz\Uri_V33.html` (Ordner neu anlegen; .html ausserhalb src wird vom Build ignoriert) | VOR Claude-Code-Start |
| `database.ts` | frisch generierte Types | NICHT selbst platzieren — als **2. Nachricht** an Claude Code anhängen | nach Startnachricht |
| `calculate-smart-matches-v5.ts` | Referenzkopie Function v5 | NICHT selbst platzieren — als **3. Nachricht** an Claude Code anhängen | nach database.ts |

Dann: Claude Code Desktop → neue Session → Startnachricht (Abschnitt 5) als Text einfügen (nie als Datei).

## 5. STARTNACHRICHT AN CLAUDE CODE (komplett kopieren, als Text einfügen)

```
BLOCK 10 — SMARTE FORMULARE + ENTWÜRFE. Lies zuerst CLAUDE.md, dann die neueste Übergabe (uebergabe-2026-07-16-block9.md bzw. neuer), dann docs/planung/block-10-smart-formulare.md (Abschnitte 2+3 = Kontext & Produkt-Konzept, verbindlich). Alle Lektionen gelten, insbesondere 1 (Querverbindungen), 2 (Validierung fachlich begründet), 6 (nichts stumm blockieren), 7 (kein Error-Swallowing), 8 (Playwright-E2E Pflicht), 9 (Workaround-Sperre), 13 (Token-Ökonomie), 14 (Preflight), 17 (kein tsc/eslint in Sandbox — JJ-Verify prüft), 18 (Deno-Code nur unter supabase/functions/ + tsconfig-exclude). Selflearning aktiv: jede ROT-Ursache sofort als Lektion in CLAUDE.md.

KONTEXT (vom Planungs-Chat live bewiesen, NICHT erneut verifizieren):
- Migration 10-1 ist drin: listings.smart_data (jsonb), listings.gemeinden (text[], not null, default '{}', Bestand befüllt). RLS-Policy neu: Entwürfe (status='draft') sind API-seitig NUR für den Eigentümer sichtbar. Grants gehärtet (listings anon nur SELECT; wallet_transactions authenticated nur SELECT — Schreiben nur via RPC).
- RPC donate_coffee(p_amount_rappen) existiert: atomar, erlaubt 100/300/500/1000, gibt jsonb {success, new_balance} oder {success:false, error} zurück. Nur authenticated.
- Edge Function calculate-smart-matches v5 ist deployed: nutzt jetzt smart_data + gemeinden-Überlappung im Scoring. Aufruf unverändert über den bestehenden triggerSmartMatches aus Block 9. Du deployst NICHTS und fasst die DB nicht an.
- JJ schickt dir nach dieser Nachricht ZWEI Dateien: (1) database.ts = frisch generierte Types — ersetze den Inhalt der bestehenden database.ts im Repo 1:1 (Datei per Suche nach "export type Database" lokalisieren), keine Handedits (Lektion 11). (2) calculate-smart-matches-v5.ts — ersetze supabase/functions/calculate-smart-matches/index.ts 1:1 (nur Referenzkopie).
- V33-Referenz liegt unter docs/referenz/Uri_V33.html.

DEIN SCHRITT 0 (D1 Repo-Seite, Befund kurz dokumentieren):
a) Pfad der bestehenden database.ts; b) Wo entstehen Angebot/Gesuch heute (Formular-Komponenten + Server Actions, inkl. triggerSmartMatches-Stelle aus Block 9); c) Struktur von „Meine Inserate" (Tabs?); d) kanonische Kategorie-Liste der App (Konstante/Enum im Code) — für das V33-Mapping; e) existiert ein Gemeinde-Filter im Feed?; f) docs/referenz/Uri_V33.html vorhanden + categoryConfig darin gefunden? Falls (f) fehlt: STOPP, Meldung an JJ.

AUFGABEN (Reihenfolge, D3 ein Fix pro Zyklus):
1. database.ts ersetzen (Datei von JJ), calculate-smart-matches/index.ts ersetzen (Datei von JJ).
2. src/lib/gesuchConfig.ts: categoryConfig 1:1 aus Uri_V33.html extrahieren (9 Kategorien, Keywords, Felder mit Typen pills/toggle/slider/select/date/text/number). Kategorien auf die App-Liste aus deinem Befund (d) mappen (z.B. Kleidung→kleider, Tiere→haustiere); V33-Kategorien ohne App-Gegenstück weglassen + in Übergabe notieren — KEINE neuen Feed-Kategorien erfinden. Lokale Erkennungsfunktion: Keyword-Matching beim Tippen, case-insensitiv, kein API-Call.
3. Chamäleon-Formular für Angebot UND Gesuch gemäss Produkt-Konzept (Plan-MD Abschnitt 3, verbindlich): Stufe 1 Freitext + Erkennung-Banner (antippbar) + Fallback-Select + KI-Fallback (Server Action mit CLAUDE_MODEL_FAST aus src/lib/ai.ts, nur nach 15+ Zeichen ohne lokalen Treffer, debounced, Fehler still geloggt und nie blockierend); Preis-Modell-Umschalter Fixpreis|Gratis als erweiterbare Komponente (Auktion später, jetzt NICHT anzeigen); Gemeinden-Multi-Select-Chips vorbefüllt aus profiles.gemeinde (schreibt gemeinde=erste + gemeinden=alle); Stufe 2 Chips aus gesuchConfig → smart_data (nur befüllte Werte, keine leeren Keys) + ehrliche Match-Power-Anzeige; Stufe 3 eingeklappt inkl. optionalem Foto mit Nudge-Text. Design gemäss docs/design/design-referenz.html. Gesuch schreibt weiterhin price UND max_budget (Block-9-Fix nicht regressieren).
4. Entwürfe: „Als Entwurf speichern" (nur Titel ≥3; category/gemeinde ggf. '' — status='draft'); Tab „📝 Entwürfe" in Meine Inserate mit Fortsetzen (Formular vollständig vorbefüllt inkl. smart_data)/Veröffentlichen/Löschen. Veröffentlichen: vollständige Validierung mit sichtbaren Fehlern + Scroll zum ersten Fehler (Lektion 6), setzt status='active' und ruft DANACH triggerSmartMatches auf (Lektion 1!).
5. Kaffee-Modal: im Provisions-Moment — nachdem der Verkäufer eine Kaufanfrage zu einem price_type='free'-Inserat erfolgreich ANGENOMMEN hat (bestehender Annehmen-Flow mit process_transaction_commission; bei Gratis zieht die RPC 0 ab, live bewiesen — nichts umbauen). EINMAL pro Transaktion, NACH der Erfolgs-Antwort der Annahme (Text im Plan-MD Abschnitt 3): CHF 1/3/5/10 → supabase.rpc('donate_coffee', {p_amount_rappen: 100|300|500|1000}), gleichwertiger „Nein danke"-Button. RPC-Antwort ehrlich anzeigen: Erfolg → Dank + neuer Stand (new_balance/100 als Taler); success:false → error-Text anzeigen (Lektion 7). Nie blockierend — die Annahme ist zu dem Zeitpunkt schon durch. Beim Veröffentlichen eines Gratis-Inserats erscheint KEIN Modal.
6. Detail-Ansicht: smart_data als 2-Spalten-Grid (nur wenn vorhanden, Angebot UND Gesuch); alle Gemeinden als Chips; Feed-Karte kompakt „X +n".
7. E2E e2e/block10-smart-forms.spec.ts (serial; Accounts E2E_USER_A/B; Preflight nach Lektion 14 prüft zusätzlich: Taler-Guthaben von A >= 100 Rappen für Test 4; Cleanup ALLER „E2E-B10"-Daten inkl. smart_matches/notifications vor UND nach dem Lauf):
   - Test 1 (Chamäleon): A tippt „E2E-B10 Roter Wollpullover Grösse M" → Kategorie-Banner erscheint (kleider); Chip antippen; veröffentlichen; Detail zeigt smart_data-Grid mit dem Chip-Wert.
   - Test 2 (Draft-Sicherheit): A speichert Entwurf (nur Titel „E2E-B10 Entwurf") → sichtbar in As Entwürfe-Tab; als B: nicht im Feed, Direkt-URL zeigt keinen Inhalt (RLS-Beweis).
   - Test 3 (Entwurf→Veröffentlichen→Match; beweist Lektion 1 UND Function v5): B hat aktives Gesuch „E2E-B10 Suche roten Wollpullover" (kleider, Budget 50, gleiche Gemeinde); A veröffentlicht den passenden Entwurf → B erhält match-Notification + Match-Karte auf dem Gesuch-Detail (Polling/Reload bis 30s).
   - Test 4 (Gratis+Kaffee im Deal-Flow): A erstellt Gratis-Angebot „E2E-B10 Gratis 1" → beim Veröffentlichen KEIN Modal. B stellt Kaufanfrage; A nimmt an → Kaffee-Modal erscheint; „Nein danke" → Modal zu, Taler-Stand von A unverändert. Zweiter Durchlauf mit „E2E-B10 Gratis 2": A nimmt an → CHF 1 spenden → Taler-Stand von A exakt −1.00.
   - Test 5 (Mehrere Gemeinden): Angebot mit 2 Gemeinden → beide auf dem Detail sichtbar.
8. DOCS + ABSCHLUSS: docs/database-schema.md (neue Spalten, neue Select-Policy, donate_coffee, Grant-Stand listings/wallet_transactions), docs/smart-match.md (v5: smart_data + Gemeinden-Überlappung), neue Lektionen in CLAUDE.md, uebergabe-2026-07-XX-block10.md (BEWIESEN/UNGETESTET/ANGEFANGEN). Kein Commit vor JJs grünem Verify (Lektion 17). Danach STOPP: „bereit für Verify" + Testliste an JJ. Nach GRÜN: Commit (Vorschlag: „Block 10: Smarte Formulare — Chamäleon, Entwürfe, Kaffee, mehrere Gemeinden, E2E"). KEIN Push ohne JJ-OK.

STOP-REGELN: Max 3 Root-Cause-Zyklen pro Bug, dann STOPP-Bericht. DB-Hypothesen → STOPP, Fragen an den Planungs-Chat. Keine neuen npm-Pakete ohne Rückfrage. Feed-/Deal-Flows dürfen nicht regressieren.
```

## 6. ABSCHLUSS-CHECKLISTE BLOCK 10

```
[x] Migration 10-1 + D2 grün (17.07., Planungs-Chat)
[x] Migration 10-2 donate_coffee + Rechte-Check grün (17.07., Planungs-Chat)
[x] Edge Function v5 deployed (Logik-Beweis = E2E Test 3)
[x] Types offiziell generiert (Hand-Edits bereinigt)
[ ] database.ts + Referenzkopie im Repo ersetzt
[ ] gesuchConfig.ts 1:1 aus V33, Mapping dokumentiert
[ ] Chamäleon-Formular Angebot+Gesuch (Kategorie ändert Felder)
[ ] Entwurf speichern/fortsetzen/veröffentlichen; Veröffentlichen triggert Matches
[ ] Kaffee-Modal bei Gratis (Spende + Nein-danke-Pfad)
[ ] Mehrere Gemeinden in Formular/Detail/Karte
[ ] E2E Tests 1–5 grün headless; Verify (Build+ESLint+Playwright) GRÜN
[ ] Docs + Übergabe + Lektionen; Commit → JJ-OK → Push → deploy-vercel.ps1 → 2-Min-Live-Check
```

## 7. OFFENE PUNKTE / RISIKEN
- Function-v5-Logik ist bis E2E Test 3 UNGETESTET (ehrlich markiert). Regression würde dort sofort sichtbar.
- V33-Kategorien Immobilien/Events evtl. ohne App-Gegenstück → bewusst weglassen, Nachzug mit Event-Phase.
- Nach Block 10 ist `database-schema.md` UND `database.ts` synchron zu halten (Aufgabe 8 deckt das).
