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

### 3. Listings verwalten — E2E: block3-manage.spec.ts (grün, Commit `c7f1352`)
- [x] Eigenes Listing bearbeiten (alle Felder inkl. Foto tauschen) — `c7f1352`
- [x] Löschen/Deaktivieren mit Bestätigungsdialog — `c7f1352`
- [x] Bearbeiten gesperrt sobald reserviert/verkauft (Meldung WARUM — Lektion 6) — `c7f1352`
- [ ] Favoriten: keine favorites-Tabelle → als eigener Block ausgelagert (nicht trivial, siehe docs/manage-listings.md)

### 4. Profil & Konto
- [x] Profil bearbeiten (Name/Gemeinde/Kategorien) + Zahlungsangaben (IBAN Mod-97 / CH-Telefon) mit Sichtbarkeits-Flags — `7dd55d9`
- [x] Taler-Transaktionshistorie sichtbar (wallet_transactions, Anzeige credits/100 mit Vorzeichen, Leerzustand) — `7dd55d9`
- [x] Konto-Löschung funktioniert: Service-Client `auth.admin.deleteUser`, blockiert bei offenen Deals (Grund sichtbar, Lektion 6), Logout+Redirect — `7dd55d9`

### 5. Taler-Kauf (Stripe) — E2E mit Stripe-Testmodus
- [x] Checkout Session (kein payment_method_types), Webhook mit constructEvent() — sk_test_; rk_ = Go-Live-Haertung offen — `91d0cc0`
- [x] Gutschrift atomar+idempotent via credit_taler-RPC, kein Doppelklick-Doppelkauf (E2E: 2. Webhook = keine Doppelgutschrift) — `91d0cc0`
- [ ] Guthaben-Prüfung VOR Verpflichtung, DB-Constraint nicht-negativ (Planungs-Chat)
- [x] Anzeige immer credits/100, Rundung konsistent (rappenToTaler, toFixed(2)) — `91d0cc0`
- [ ] Voraussetzung JJ: Stripe-Konto (Einzelfirma) aktiviert

### 6. Recht & Start
- [x] Impressum, Datenschutz (DSG 2023), AGB inkl. Taler-Klausel — Block 7 (statische Seiten `/impressum` `/datenschutz` `/agb` + globaler Footer + Signup-Zustimmung; E2E `block7-legal.spec.ts` GRUEN). ⚠️ Anwalts-Review vor Echtgeld weiterhin offen (JJ)
- [x] 5-Taler-Startguthaben Frontend-Texte — Block 7 (Onboarding-Abschluss-Screen 100→5 korrigiert; einzige nutzersichtbare Fundstelle; DB-Default/RPC = 5 laut Live-DB). „Pionier-Plätze" = eigenes Badge-Feature, unverändert korrekt
- [x] comments-Tabelle (Migration Planungs-Chat) + Kommentar-UI ohne PGRST205 — `ccdd59a`
  (Liste/Autor/Zeit, neueste zuerst; user_id null -> „Geloeschter Nutzer"; Login-Gate;
  Validierung 1-1000 + Zaehler; eigene loeschen mit Bestaetigung, kein Bearbeiten;
  Benachrichtigung via DB-Trigger; E2E `block5-comments.spec.ts` GRUEN)
  - [ ] (ausgelagert als **Block 9**) Kommentar-Zaehler auf Feed-Karten — braucht
    `comment_count`-Denormalisierung (Trigger-gepflegte Spalte auf `listings`),
    DB-Migration im Planungs-Chat; nicht trivial, daher eigener Block.

### 7. Deploy
- [ ] Vercel: Site-URL, Redirect-Allow-List, Env-Vars — Login/Signup auf echter Domain E2E-getestet
- [ ] Smoke-Test 5/5 auf Production

## Abnahme-Regel
Ein Kriterium gilt als erfüllt, wenn: (a) E2E oder automatisierter Test grün, (b) tsc+build 0 Errors, (c) kein bestehendes Kriterium dabei gebrochen wurde (Regression = Block nicht fertig). Claude Code hakt Kriterien in DIESER Datei ab (Checkbox → [x]) mit Commit-Hash daneben.
