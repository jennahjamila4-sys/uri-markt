# BLOCK 9 — MATCH-SYSTEM LIVE („Verkaufen & Finden ohne Suchen")
> Erstellt 16.07.2026 im Planungs-Chat. Alle Fakten gegen die Live-DB `lhqsuelguwfdflapzdhk` verifiziert (D1).
> Deckt ab: APP_TEST Punkt 5 (Match-System) + Punkt 7 (Reserviert-Benachrichtigung sichtbar).
> Ein Block = ein Feature, grüne E2E, kein Push ohne JJ-OK.

---

## 1. D1-BEFUND (bewiesen am 16.07.2026, Live-Verifikation)

| Messung | Ergebnis | Konsequenz |
|---|---|---|
| Edge Functions deployed | **KEINE** (leere Liste) | `calculate-smart-matches` existiert nicht → Match-Berechnung läuft nie. **Root Cause #1.** |
| `smart_matches` Zeilen | 0 | Konsistent mit #1. Tabelle + Unique-Constraint `(gesuch_id, matched_listing_id)` existieren, Spalten: `id, gesuch_id, matched_listing_id, user_id, score, dismissed, created_at`. |
| Notifications vom Typ `match` | 0 (nur `tx_pending=9, tx_confirmed=7, tx_completed=2, tx_expired=6`) | Nie ein Match benachrichtigt. |
| Verkäufer-Notification bei Kaufanfrage | **existiert bereits** (`tx_pending` via `create_buy_intent`) | APP_TEST 7 ist DB-seitig erledigt. Lücke liegt (falls vorhanden) in der **Sichtbarkeit** in der App → Teil dieses Blocks. |
| 48h-Auto-Expiry | **läuft bereits**: RPC `expire_stale_reservations` + pg_cron `expire-stale-reservations` alle 30 Min, erzeugt `tx_expired` | Masterplan-Punkt „48h-Auto-Expiry" = DONE (DB-seitig). Nicht Teil von Block 9. |
| `profiles_private` | **existiert bereits** (`iban, twint_phone, phone, address, show_*`-Flags, RLS own-only, korrekte Grants) | Käuferdaten-Prefill (APP_TEST 6) braucht KEINE Migration → Block 11 wird reiner Frontend-Block. |
| `notifications` Schema | `id, recipient_id, type, is_read, title, message, listing_id, created_at` — **keine CHECK-Constraints** | Typ `match` ist erlaubt. `is_read` vorhanden → Glocken-Badge machbar. |
| `send_notification` Signatur | `(p_recipient_id uuid, p_title text, p_message text, p_type text, p_listing_id uuid)` | Verifiziert. |
| `listings` Match-Spalten | `title, description, price, category, gemeinde, max_budget` vorhanden; `type`-Werte: `Angebot, Gesuch`; Status-Werte: `active, reserved, sold` | Edge Function kann rein regelbasiert scoren. |
| Testdaten | 6 aktive Angebote, 3 aktive Gesuche | E2E hat Substrat. |
| ⚠️ Sicherheitsfund (D2) | `anon` hat INSERT/UPDATE/DELETE/SELECT-Grants auf `smart_matches`; `authenticated` hat DELETE+INSERT ohne Bedarf | RLS blockt aktuell (Policies own-only), aber verstösst gegen Minimal-Privileg-Prinzip → **Migration 9-1** unten. |
| `credits >= 0` Constraint | **existiert bereits** (`profiles_credits_non_negative`) | Masterplan-Punkt „Nicht-negativ-Constraint" = DONE. |

**Root Cause Match-System (vollständig):** Die Berechnungs-Engine wurde nie deployed, es gibt vermutlich keinen Aufruf im App-Code und keine Match-Anzeige-UI. Repo-Seite verifiziert Claude Code in seinem Schritt 0 (siehe Startnachricht).

---

## 2. SCOPE BLOCK 9

**Drin:**
1. Edge Function `calculate-smart-matches` — **beide Richtungen** (neues Gesuch findet Angebote UND neues Angebot benachrichtigt passende Gesuch-Besitzer). Regelbasiertes Scoring, KI-Score optional zuschaltbar (fällt ohne API-Key sauber auf Regeln zurück, KI-Fehler senkt nie den Score).
2. Migration 9-1: Grant-Härtung `smart_matches` (REVOKE Überschuss).
3. App-Trigger: nach erfolgreichem Veröffentlichen von Gesuch UND Angebot wird die Function aufgerufen (fire-and-forget, Fehler geloggt, Veröffentlichung nie blockiert).
4. Match-UI: Sektion „🎯 Deine Matches" auf dem eigenen Gesuch-Detail (Score-Badge, Klick → Angebot, „Ausblenden" via `dismissed`).
5. Notification-Sichtbarkeit: Glocke + Badge (ungelesene) + Liste, Klick → Listing + `is_read=true`. Falls schon vorhanden: nur verifizieren + E2E-Assertion. Deckt Match- UND `tx_pending`-Notifications ab (APP_TEST 7).
6. E2E beide Richtungen + Ausblenden + Reserviert-Notification.

**Bewusst NICHT drin (spätere Blöcke):** Smart-Formulare/`smart_data` (Block 10), Käuferdaten-Prefill (Block 11), Onboarding/FOMO-Texte + Kommentar-Zähler (Block 12), „🔄 Wieder erhältlich"-Sticker, Favoriten, Auktionen, Push-Notifications (Browser-Push — In-App-Glocke reicht für MVP-Match).

**Scoring-Formel v2 (verbindlich — deployt am 16.07.2026, JJ-Entscheid: weiche Matches, semantisch, verkaufspsychologisch):**
- Semantik-Kern 0–100: KI (Haiku, versteht Synonyme/Sprachen: Handy=Phone=Smartphone=Natel; Secret `ANTHROPIC_API_KEY` ist gesetzt); Fallback ohne KI: Token-Heuristik. KI-Fehler senkt den Score nie unter die Heuristik.
- Score = round(Semantik × 0.7) + Budget-Bonus + Gemeinde-Bonus, Cap 100
- Budget abgestuft: Preis ≤ Budget +20 · Preis ≤ 2× Budget +10 (verhandelbar — die Leute wollen loswerden) · darüber +0 · Budget oder Preis fehlt +10 (neutral)
- Gleiche Gemeinde +10
- Speichern ab 40. **Notification ab 50, zwei Stufen, nur beim ERSTEN Auftreten des Paars** (Dedupe): ab 75 → „🎯 Perfekter Match gefunden!" (dringlich, „bevor es weg ist"); 50–74 → „✨ Das könnte dir gefallen … (X% Match)". Prozent steht immer in der Nachricht.
- Beispiel (JJ): Gesuch „Handy 50.–" / Angebot „Phone 150.–" → Semantik ~85 → Score ~60 → weiche Notification.

---

## 3. ABLAUF — WER MACHT WAS, IN DIESER REIHENFOLGE

### TEIL A — Planungs-Chat (JJ gibt jeden Schritt einzeln frei)
1. **A1 Migration 9-1** einspielen (SQL unten, Abschnitt 4) → danach D2-Grant-Check. Keine Schema-Änderung → keine Types-Regeneration nötig.
2. **A2 Edge Function deployen** via Supabase-MCP (Code unten, Abschnitt 5). `verify_jwt = true`.
3. **A3 Funktionstest** direkt aus dem Planungs-Chat: bestehendes aktives Gesuch als `listing_id` — Beweis: `smart_matches`-Zeilen > 0. Erst wenn das GRÜN ist, startet Claude Code.

### TEIL B — JJ (einmalig, 2 Minuten)
1. Bei jedem MCP-Dialog in TEIL A: **„Zulassen" klicken** (A1/A2 sind Schreibzugriffe — ich kündige jeden einzeln an).
2. **Entscheidung KI-Score:** Hast du einen Anthropic-API-Key für das Projekt? 
   - **Ja** → Supabase Dashboard → Projekt → *Edge Functions* → *Secrets* → `ANTHROPIC_API_KEY` eintragen. Matching nutzt dann KI.
   - **Nein / später** → nichts tun. Matching läuft regelbasiert und funktioniert vollständig. KI kann jederzeit nachgerüstet werden (nur Secret setzen, kein Deploy nötig).
3. Claude Code Desktop öffnen → **neue Session** → Startnachricht (Abschnitt 6) als Text einfügen (nie als Datei-Anhang).
4. Wenn Claude Code „selbst getestet, funktioniert" meldet: Desktop-Verknüpfung **„Uri-Markt Verify"** doppelklicken → GRÜN/ROT an Claude Code zurückmelden.
5. Bei GRÜN: Push freigeben (**push.ps1**), danach diese Session-Kette beenden.

### TEIL C — Claude Code (komplette Anweisung = Abschnitt 6, kopierfertig)

---

## 4. MIGRATION 9-1 (Planungs-Chat, mit JJ-OK)

```sql
-- Block 9-1: Least Privilege auf smart_matches.
-- Befund D2 16.07.2026: anon hatte SELECT/INSERT/UPDATE/DELETE, authenticated INSERT/DELETE ohne Bedarf.
-- Matches entstehen ausschliesslich über die Edge Function (Service-Role).
-- User brauchen nur: SELECT (eigene Matches lesen) + UPDATE (dismissed setzen). Policies own-only existieren.
revoke all on public.smart_matches from anon;
revoke insert, delete on public.smart_matches from authenticated;
```
Danach D2-Check: `role_table_grants` für `smart_matches` muss exakt `authenticated: SELECT, UPDATE` zeigen.

---

## 5. EDGE FUNCTION `calculate-smart-matches` — v2 DEPLOYED (16.07.2026)

Der Planungs-Chat hat die Function deployed und live bewiesen am 16.07.2026 (ACTIVE, `verify_jwt` an; A3-Test: KI-Semantik erkannte Handy≈Phone, Score 73, weiche Notification korrekt erzeugt). Die Antwort enthält ein `ai`-Diagnosefeld (ok / no_key / http_XXX) für Betrieb und Debugging. Der verbindliche Code liegt in der Datei **`calculate-smart-matches-deployed.ts`** (gleiche Ablage wie dieses MD). Claude Code übernimmt ihn UNVERÄNDERT als Referenzkopie nach `supabase/functions/calculate-smart-matches/index.ts` (Aufgabe 4 der Startnachricht — JJ schickt die Datei als zweite Nachricht).

Verhalten: Input `{ listing_id }`. Aktives **Gesuch** → matcht gegen aktive Angebote gleicher Kategorie; aktives **Angebot** → matcht gegen aktive Gesuche gleicher Kategorie (Notification immer an den Gesuch-Besitzer). Max 20 Kandidaten, Upsert auf `(gesuch_id, matched_listing_id)`, Scoring-Formel v2 aus Abschnitt 2, Notification-Dedupe pro Paar.

---

## 6. STARTNACHRICHT AN CLAUDE CODE (komplett kopieren, als Text einfügen — NIE als Datei)

```
BLOCK 9 — MATCH-SYSTEM (UI-Seite + Trigger). Lies zuerst CLAUDE.md, dann uebergabe-2026-07-16.md, dann docs/database-schema.md. Alle Lektionen gelten, insbesondere 7 (kein Error-Swallowing), 8 (Playwright-E2E Pflicht), 9 (Workaround-Sperre), 13 (Token-Ökonomie), 14 (Preflight-Pflicht). Selflearning aktiv: jede ROT-Ursache wird sofort als neue Lektion in CLAUDE.md dokumentiert, ohne Aufforderung.

KONTEXT (vom Planungs-Chat live bewiesen, NICHT erneut verifizieren):
- Edge Function `calculate-smart-matches` (v2) ist deployed und funktioniert (Input `{ listing_id }`, matcht beide Richtungen: Gesuch→Angebote und Angebot→Gesuche; KI-Semantik-Scoring aktiv; Notification Typ 'match' an den Gesuch-Besitzer ab Score 50 in zwei Stufen — ab 75 „Perfekter Match", 50–74 „Das könnte dir gefallen (X% Match)" — nur beim ersten Auftreten eines Paars). Du legst NUR die Referenzkopie ins Repo: `supabase/functions/calculate-smart-matches/index.ts` (Code unten in diesem Auftrag). Du deployst NICHTS nach Supabase und fasst die DB nicht an.
- Tabelle `smart_matches`: id, gesuch_id, matched_listing_id, user_id (= Gesuch-Besitzer), score, dismissed, created_at. Deine Rechte als authenticated: SELECT + UPDATE (own-only via RLS). Kein INSERT/DELETE.
- Tabelle `notifications`: id, recipient_id, type, is_read, title, message, listing_id, created_at. RPC `create_buy_intent` erzeugt bereits `tx_pending`-Notifications an den Verkäufer.

DEIN SCHRITT 0 (D1, Repo-Seite messen, Ergebnis kurz dokumentieren bevor du fixst):
a) Wird nach dem Veröffentlichen von Gesuch/Angebot irgendwo `calculate-smart-matches` aufgerufen? (grep functions.invoke)
b) Existiert eine Notification-UI (Glocke/Badge/Liste)? 
c) Existiert eine Match-Anzeige?
Erwartung laut Live-DB-Befund: a) nein, c) nein. b) offen — dein Befund entscheidet über Aufgabe 3.

AUFGABEN (in dieser Reihenfolge, ein Fix pro Zyklus, D3):

1. TRIGGER: Nach jedem erfolgreichen Veröffentlichen eines Gesuchs UND eines Angebots (Server-Seite, dort wo das Listing mit status='active' entsteht) die Edge Function aufrufen: supabase.functions.invoke('calculate-smart-matches', { body: { listing_id } }) mit dem Server-Client des eingeloggten Users (JWT wird benötigt, verify_jwt ist aktiv). Fire-and-forget: ein Fehler wird per console.error geloggt, die Veröffentlichung schlägt dadurch NIEMALS fehl und der Fehler wird NIEMALS als anderer Zustand uminterpretiert (Lektion 7).

2. MATCH-UI: Auf der Detail-Seite des EIGENEN Gesuchs (nur Owner sieht sie) Sektion „🎯 Deine Matches": Query smart_matches (eq user_id = eigener User, eq gesuch_id, dismissed=false, order score desc, join/Zweitquery auf listings für title, price, gemeinde, Bild). Pro Match: Karte mit Score-Badge (z.B. „92% Match" in Gold), Klick öffnet das Angebot, Button „Ausblenden" → UPDATE dismissed=true (optimistisch, bei Fehler sichtbare Meldung, Lektion 6). Leerer Zustand: „Noch keine Matches — wir benachrichtigen dich, sobald etwas passt." Design gemäss docs/design/design-referenz.html (Dark, Gold, Glassmorphism). Keine SELECT *.

3. NOTIFICATION-SICHTBARKEIT: Falls dein Schritt-0-Befund (b) = keine UI: Glocke im Header mit Badge (Anzahl is_read=false), Klick öffnet Liste (title, message, Zeit relativ), Klick auf Eintrag → is_read=true + Navigation zum listing_id-Detail. Realtime oder Polling alle 60s — entscheide nach bestehendem Muster im Repo. Falls UI existiert: nur sicherstellen, dass Typen 'match' und 'tx_pending' korrekt angezeigt und verlinkt werden.

4. REFERENZKOPIE der Edge Function nach supabase/functions/calculate-smart-matches/index.ts legen (Code kommt als nächste Nachricht von JJ, unverändert übernehmen). ZWINGEND: supabase/functions/** in tsconfig.json unter exclude eintragen, sonst scheitert next build an den Deno-jsr-Imports. Falls eine Datei calculate-smart-matches-deployed.ts im Repo-Root liegt: löschen (sie gehört nur nach supabase/functions/).

5. E2E (e2e/block9-match.spec.ts, Accounts E2E_USER_A/B aus .env.local, Preflight nach Lektion 14 prüft deren Existenz + Login):
   - Test 1 (Gesuch findet Angebot): A erstellt Angebot „Roter Wollpullover Grösse M" (Kategorie Kleidung, Preis 20, eine Gemeinde). B erstellt Gesuch „Suche roten Wollpullover Grösse M" (gleiche Kategorie, max_budget 50, gleiche Gemeinde). Dann: B öffnet sein Gesuch-Detail → Match-Karte mit dem Angebot sichtbar (Edge Function ist asynchron: Polling/Reload mit Timeout bis 30s). B öffnet die Glocke → 'match'-Notification sichtbar.
   - Test 2 (Angebot findet Gesuch): B hat ein aktives Gesuch. A erstellt danach ein passendes Angebot. → B erhält neue 'match'-Notification, Match erscheint auf Bs Gesuch-Detail.
   - Test 3 (Ausblenden): B klickt Ausblenden → Karte weg, bleibt nach Reload weg.
   - Test 4 (Reserviert-Sichtbarkeit): B stellt Kaufanfrage auf ein Angebot von A → A sieht in der Glocke die tx_pending-Notification.
   - Aufräumen: Test-Listings am Ende deaktivieren/löschen, damit der Feed sauber bleibt.

6. DOCS + ABSCHLUSS: docs/smart-match.md aktualisieren (Scoring-Formel, beide Richtungen, Dedupe-Regel), database-schema.md um den Grant-Stand smart_matches ergänzen (authenticated: SELECT, UPDATE). uebergabe-2026-07-16-block9.md schreiben (BEWIESEN / UNGETESTET / ANGEFANGEN). npx tsc --noEmit und npx eslint sauber, dann Commit (kein Push!). Danach STOPP: melde „selbst getestet, funktioniert" + Test-Liste an JJ. JJ führt Verify aus. Erst nach JJs GRÜN und explizitem Push-OK wird gepusht. Danach Session beenden — nächste Session liest nur CLAUDE.md + neueste Übergabe.

STOP-REGELN: Max 3 Root-Cause-Zyklen pro Bug, dann STOPP-Bericht an JJ für den Planungs-Chat. Bei DB-Hypothesen: STOPP, DB-Fragen gehen an den Planungs-Chat. Keine neuen npm-Pakete ohne Rückfrage.
```

**Direkt nach der Startnachricht schickst du Claude Code als zweite Nachricht den Edge-Function-Code aus Abschnitt 5 (für Aufgabe 4).**

---

## 7. ABSCHLUSS-CHECKLISTE BLOCK 9

```
[ ] Migration 9-1 eingespielt + D2: smart_matches-Grants = authenticated SELECT,UPDATE — sonst nichts
[ ] Edge Function deployed; Planungs-Chat-Test: Aufruf mit aktivem Gesuch → smart_matches-Zeilen > 0
[ ] Trigger bei Gesuch- UND Angebot-Veröffentlichung im App-Code (Fehler geloggt, nie blockierend)
[ ] Match-Sektion auf eigenem Gesuch-Detail: Score, Klick zum Angebot, Ausblenden persistent
[ ] Glocke: Badge zählt ungelesene; match- und tx_pending-Einträge verlinken korrekt; is_read wird gesetzt
[ ] Notification-Dedupe bewiesen: gleiches Paar zweimal berechnet → genau 1 Notification
[ ] E2E Tests 1–4 grün (headless), tsc + build + eslint 0 Errors, keine Regression
[ ] docs/smart-match.md + database-schema.md + Übergabe aktualisiert
[ ] JJ: Verify GRÜN → Push-OK → Push → Sessions beendet
```

## 8. SELFLEARNING & SESSION-HYGIENE (bindend)

**Dokumentierte ROT-Fälle Block 9 (Claude Code trägt beide als Lektionen in CLAUDE.md ein):**
- Lektion: Secrets für Edge Functions leben AUSSCHLIESSLICH in Supabase → Edge Functions → Secrets. Keys in `.env.local` oder Vercel sind für Edge Functions unsichtbar (Symptom: `ai:no_key`). Exakter Name, keine Anführungszeichen/Leerzeichen.
- Lektion: Deno-Edge-Function-Code darf NIE lose im Repo liegen (Repo-Root o.ä.) — `next build` type-checkt alle .ts-Dateien und scheitert an `jsr:`-Imports. Einziger Ort: `supabase/functions/<name>/index.ts`, zusätzlich in tsconfig.json unter `exclude` ("supabase/functions/**") eintragen.
- Lektion: Externe API-Aufrufe in Edge Functions brauchen ein Diagnosefeld in der Response (hier `ai`), damit Fehlerursachen ohne Log-Zugriff sofort sichtbar sind — Request-Logs zeigen keine console-Ausgaben zuverlässig.

- Jeder ROT-Fall (Planungs-Chat ODER Claude Code) wird sofort mit Root Cause als Lektion in CLAUDE.md dokumentiert — proaktiv, ohne dass JJ es verlangt.
- Claude Code: nach grünem Block Übergabe schreiben → Commit → JJs Verify → Push nach OK → Session beenden.
- Planungs-Chat: Nach Push von Block 9 ist der tokensparende Zeitpunkt für einen **neuen Planungs-Chat** (Block-10-Planung: Smart-Formulare V33 + Entwürfe). Einfach neuen Chat im selben Projekt starten und diese MD-Datei + die neue Übergabe hochladen.
