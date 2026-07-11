# MVP-MASTERPLAN Uri-Markt — verbindlich bis Launch

**Zweck:** Diese Datei definiert FERTIG. Jede Claude-Code-Session liest sie zusammen mit CLAUDE.md und der aktuellen Übergabe. Ein Block gilt erst als abgeschlossen, wenn seine Abnahmekriterien erfüllt UND per Playwright-E2E bewiesen sind (Lektion 8). JJ testet nur noch als Endkontrolle — nicht als Fehlersucher.

## Arbeitsprinzip (nicht verhandelbar)
1. **Lücken selbst finden:** Vor jedem Block prüft Claude Code aktiv: Welche Konsumenten hat dieses Feature? (Lektion 1). Welche Zustände kann es geben und rendert das UI JEDEN davon? Was passiert bei Fehler/Doppelklick/F5/abgelaufener Session? Gefundene Lücken werden IM Block geschlossen, nie notiert-und-umgangen.
2. **Beweis statt Behauptung:** Jeder Flow-Block endet mit grünem headless E2E-Lauf. Erst dann „selbst getestet, funktioniert" + Testliste an JJ.
3. **DB-Fragen an den Planungs-Chat**, nie vermuten. Migrationen NUR dort.
4. **Session-Hygiene:** Nach jedem Block: Übergabe aktualisieren, committen (kein Push ohne JJ), Session beenden.

## MVP = FERTIG, wenn ALLE Kriterien unten grün sind

### 1. Verkaufsflow (Kern) — E2E: deal-completion.spec.ts (grün, Commit `197dd86`)
- [ ] Inserieren mit Foto (PNG+JPG, Fehler sichtbar wenn Upload scheitert) — E2E erstellt Inserat OHNE Foto; Foto-Upload noch NICHT E2E-abgedeckt
- [ ] Entdecken: Feed zeigt Angebote/Gesuche korrekt, keine Duplikate, Status-Sticker (RESERVIERT/VERKAUFT) überall — Feed-Anzeige im E2E genutzt, Status-Sticker aber nicht assertiert
- [x] Kaufabsicht mit Zahlungsweg-Auswahl (Bar/TWINT/IBAN je nach Verkäufer-Angaben) — `197dd86`
- [x] Verkäufer bestätigt → Provision atomar via RPC, Reservierung aktiv — `197dd86` (E2E mit Gratis-Listing → Provision 0; RPC-Pfad bewiesen, 10%-Höhe auf bezahltem Betrag noch offen)
- [x] Kontaktdaten beidseitig sichtbar NUR bei status=confirmed, gemäss Sichtbarkeits-Flags — `197dd86`
- [x] Beidseitiger Abschluss → Kontakt weg, Status überall korrekt — `197dd86` (XP-Höhe 50/10 nicht separat assertiert)
- [x] Bewertung: genau 1× pro Nutzer+Transaktion (zweiter Versuch DB-seitig abgelehnt) — `197dd86`
- [ ] 48h-Reservierungs-Auto-Expiry → Listing wieder aktiv, Deal storniert (DB-seitig, Planungs-Chat) — nicht in diesem E2E

### 2. Bewertungen öffentlich
- [x] Profil zeigt Durchschnitt + Anzahl + Einzelbewertungen — `5e36835`
- [x] Listing-Detail zeigt Verkäufer-Bewertung — `5e36835`
- [x] Keine Bewertung → sauberer Leerzustand (kein Fehler, keine erfundenen Zahlen) — `5e36835`

### 3. Listings verwalten
- [ ] Eigenes Listing bearbeiten (alle Felder inkl. Foto tauschen)
- [ ] Löschen/Deaktivieren mit Bestätigungsdialog
- [ ] Bearbeiten gesperrt sobald reserviert/verkauft (Meldung WARUM — Lektion 6)

### 4. Profil & Konto
- [ ] Profil bearbeiten, Zahlungsangaben (IBAN/TWINT) mit fachlich korrekter Validierung + Sichtbarkeits-Flags
- [ ] Taler-Transaktionshistorie sichtbar
- [ ] Konto-Löschung funktioniert (Schweizer Rechtspflicht)

### 5. Taler-Kauf (Stripe) — E2E mit Stripe-Testmodus
- [ ] Checkout Session (rk_-Key, kein payment_method_types), Webhook mit constructEvent()
- [ ] Gutschrift atomar+idempotent via credit_taler-RPC (Planungs-Chat legt an), kein Doppelklick-Doppelkauf
- [ ] Guthaben-Prüfung VOR Verpflichtung, DB-Constraint nicht-negativ (Planungs-Chat)
- [ ] Anzeige immer credits/100, Rundung konsistent
- [ ] Voraussetzung JJ: Stripe-Konto (Einzelfirma) aktiviert

### 6. Recht & Start
- [ ] Impressum, Datenschutz (DSG 2023), AGB inkl. Taler-Klausel (Anwalts-Review vor Echtgeld — JJ)
- [ ] 5-Taler-Startguthaben: ALLE Anker (DB-Default, Onboarding-RPC, Frontend-/Marketing-Texte inkl. Pioneer) im selben Block
- [ ] comments-Tabelle (Migration Planungs-Chat) + Kommentar-UI ohne PGRST205

### 7. Deploy
- [ ] Vercel: Site-URL, Redirect-Allow-List, Env-Vars — Login/Signup auf echter Domain E2E-getestet
- [ ] Smoke-Test 5/5 auf Production

## Abnahme-Regel
Ein Kriterium gilt als erfüllt, wenn: (a) E2E oder automatisierter Test grün, (b) tsc+build 0 Errors, (c) kein bestehendes Kriterium dabei gebrochen wurde (Regression = Block nicht fertig). Claude Code hakt Kriterien in DIESER Datei ab (Checkbox → [x]) mit Commit-Hash daneben.
