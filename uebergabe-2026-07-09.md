# Uri-Markt — Übergabe 09.07.2026 (VERBINDLICHER FAHRPLAN BIS LAUNCH)

> **Diese Datei ersetzt `uebergabe-2026-07-08.md` vollständig.** Deren offener Block 2
> ist hier enthalten (durch Audit vom 09.07. bestätigt und präzisiert).
>
> Kontext: JJ ist nicht-technisch, testet nur Ergebnisse im Browser.
> Root-Cause statt Workaround. Live-DB = Wahrheit. Regeln D1–D5 (CLAUDE.md).
>
> ⚠️ **Dauerregeln (jede Session, nicht verhandelbar):**
> 1. **Nie Secrets im Output** (keine Tokens/Keys/`.env`-Werte).
> 2. **Nie JJs Testergebnisse selbst schreiben** — ein Test gilt erst als bestanden, wenn JJ es meldet.
> 3. **Kein `git push` ohne ausdrückliches JJ-OK.** Commits bleiben lokal.
> 4. **Claude Code fasst die Datenbank NIE direkt an.** Alle Migrationen/SQL laufen über die
>    Supabase-MCP im Planungs-Chat. Fehlt Claude Code eine Tabelle/Spalte/RPC: STOPP,
>    an JJ melden „Planungs-Chat muss zuerst DB-Schritt X machen".

---

## ARBEITSMODUS: AUTONOME BLÖCKE (gilt ab sofort)

Claude Code arbeitet **einen kompletten Block autonom durch** — ohne Zwischenfragen,
ohne Teilergebnisse. Ein Block ist erst fertig, wenn:

1. Alle Punkte des Blocks umgesetzt sind (Ist-Zustand vorher selbst gemessen, D1).
2. `npx tsc --noEmit` → 0 Errors UND `npm run build` → 0 Errors, 0 Warnings.
3. Selbst-Check gegen die Abschlusskriterien des Blocks (stehen bei jedem Block unten).
4. 5-Punkte-Smoke-Test-Relevanz geprüft (Login sichtbar, „+"-Form öffnet, Profil öffnet,
   F5 hält Session, Kaufform öffnet — nichts davon darf brechen).
5. **Lokaler Commit** mit Block-Nummer im Commit-Text. KEIN Push.
6. Danach: **kurze Testliste für JJ (max. 5 Punkte, Browser-Klicks, kein Fachjargon).**

Erst wenn JJ „Block X getestet, alles gut" meldet, beginnt der nächste Block.
Findet Claude Code während eines Blocks eine NEUE Lücke: notieren in
`befunde-offen.md` im Projektroot, NICHT sofort fixen (kein Scope-Creep).

**JJ-Bedienung von Claude Code:** Datei-Edits → `2` („allow all edits this session").
Shell-Befehle → `1`, AUSSER der Befehl enthält `git push`, `Remove-Item` ausserhalb
des Repos oder DB-Zugriffe → dann Screenshot an den Planungs-Chat.

---

## STAND 09.07.2026 (alles gemessen, nichts vermutet)

**Funktioniert (JJ-getestet):** Auth komplett inkl. F5, Feed mit Infinite Scroll,
Inserat erstellen mit Foto (Ende-zu-Ende), Reserviert-Sticker, Deal-Flow komplett
(Kauf → Bestätigung → Provision abgezogen), Verkäufer- + Käufer-Dashboard,
„Abgeschlossen" bleibt sichtbar, Bewertungs-Modal bleibt offen, Debug-Reste entfernt,
alles lokal committet.

**Guthaben-Sicherheit (heute im RPC-Code verifiziert):** Die Bestätigung prüft das
Verkäufer-Guthaben und blockiert bei zu wenig Talern — Minus-Guthaben ist über den
normalen Weg unmöglich. Restlücken (Doppelklick-Race, fehlendes DB-Constraint,
Rundung) werden in Block 9 geschlossen.

**DB-Audit-Befunde (Live-DB, 09.07.):**
- `profiles_private` existiert NICHT (muss vor Block 3 angelegt werden — Planungs-Chat)
- Kein 48h-Auto-Ablauf: keine Ablauf-Spalte, kein pg_cron (Block 4)
- `comments`-Tabelle fehlt → PGRST205 (Block 8)
- `reviews` DB-seitig ok (öffentlich lesbar, Trigger pflegt avg_rating)
- Grants sauber (D2-Check bestanden), alle 8 Deal-RPCs vorhanden, SECURITY DEFINER

**Frontend-Audit-Befunde (Read-Only, 09.07.):**
- Grid lädt `sold` mit → verkaufte Inserate doppelt (Grid + Verpasst-Streifen) → Block 2
- Inserat bearbeiten: existiert nicht (nur Erstellen + Löschen) → Block 5
- Bewertungen: nur Aggregat sichtbar, keine Review-Liste → Block 6
- Favoriten: Herz ist reine Optik — keine Tabelle, keine Speicherung, keine Ansicht → Block 7
- Gesuch = Sackgasse: Verkäufer kann nicht antworten; CommentSection ohne Tabelle → Block 8
- Live-Viewer-Zähler + Pionier-Zähler zeigen ERFUNDENE Zahlen → Rechtsrisiko (UWG),
  Fix in Block 9/10 (an echte Daten koppeln)
- Dauerspinner Deal-Karte: `ContactSection.tsx` async ohne try/catch + `seller_contact`
  nie befüllt (kein Zahlungen-Tab) → Block 3

---

## FAHRPLAN (verbindliche Reihenfolge)

### ✅ BLOCK 1 — erledigt (Bugfixes + Foto + Cleanup, Stand oben)

### BLOCK 2 — Status-Ordnung Feed (Claude Code)
Soll-Verhalten pro Status an jedem Ort:
- `active`: normale Karte (Feed, TikTok-Modus), kaufbar, Profil „Aktiv"
- `reserved`: Karte mit ⏳-Sticker im Feed, NICHT kaufbar, Profil „Reserviert"
- `sold`: NICHT im normalen Grid, NICHT im TikTok-Modus. NUR im „Kürzlich
  verpasst"-Streifen (entsättigt + VERKAUFT-Stempel, Design-Referenz), max. 10 neueste.
  Profil des Verkäufers: „Abgeschlossen".
Messpunkte: `src/app/page.tsx` (Server-Query), `FeedPage.tsx` (2 Client-Queries),
`FomoZone.tsx`, `TikTokScroll.tsx`, `ListingCard.tsx`.
**Abschlusskriterien:** Verkauftes Inserat erscheint exakt 1× (Verpasst-Streifen),
Grid-Query lädt `sold` gar nicht erst (kein CSS-Verstecken), nichts anderes bricht.

### BLOCK 3 — Zahlungen-Tab + Kontaktauswahl + Spinner-Fix
**Zuerst Planungs-Chat (DB):** Tabelle `profiles_private` (IBAN, TWINT, Telefon,
Adresse; RLS: NUR Eigentümer liest/schreibt, kein anon-SELECT) + `get_transaction_contact`
anpassen: liefert nur die vom Verkäufer FREIGEGEBENEN Felder, nur bei `status='confirmed'`,
nur an Beteiligte. D2-Check danach.
**Dann Claude Code:** Zahlungen-Tab im Profil (Felder speichern + Checkboxen „Was sieht
der Käufer?"), `ContactSection.tsx` mit try/catch + sauberem Leer-Zustand
(„Verkäufer hat noch keine Kontaktdaten hinterlegt") statt Endlos-Spinner.
**Abschlusskriterien:** Daten speichern + wieder laden funktioniert; Käufer sieht nach
Bestätigung exakt die freigegebenen Felder; ohne Daten kein Spinner, sondern Hinweis;
Fremde sehen NIE Kontaktdaten.

### BLOCK 4 — Reservierung 48h mit Auto-Ablauf
**Zuerst Planungs-Chat (DB):** `expires_at` auf transactions (Default now()+48h bei
Reservierung), pg_cron aktivieren + Job: abgelaufene `pending`-Reservierungen atomar
zurücksetzen (Transaktion `expired`, Inserat wieder `active`, beide Parteien
benachrichtigen). D2-Check.
**Dann Claude Code:** Countdown „Reserviert noch 47h 12min" auf Karte + im Deal,
abgelaufene Deals korrekt anzeigen.
**Abschlusskriterien:** Test-Reservierung mit kurzem Ablauf fällt automatisch zurück,
Inserat wieder kaufbar, Benachrichtigungen kommen an.

### BLOCK 5 — Inserat bearbeiten (Claude Code)
Edit für eigene Inserate (Titel, Beschreibung, Preis, Kategorie, Zustand, Bilder,
Gemeinde). Nur Eigentümer, nur solange nicht `sold`. Update-Action serverseitig
(user_id nie vom Client).
**Abschlusskriterien:** Änderung sofort im Feed sichtbar; fremde Inserate nicht
editierbar; `sold` nicht editierbar.

### BLOCK 6 — Bewertungen öffentlich (Claude Code)
Review-Liste (Sterne + Text + Datum + Bewerter) auf `/profile/[username]`.
Daten aus `reviews` (DB ist fertig).
**Abschlusskriterien:** Abgegebene Bewertung erscheint öffentlich; Aggregat stimmt
mit Liste überein.

### BLOCK 7 — Favoriten funktionsfähig
**Zuerst Planungs-Chat (DB):** Tabelle `favorites` (user_id, listing_id, unique,
RLS: nur eigene). D2-Check.
**Dann Claude Code:** Herz speichert/entfernt echt, Favoriten-Ansicht im Profil,
Herz-Zustand überlebt Reload.
**Abschlusskriterien:** Favorisieren → F5 → noch favorisiert; Ansicht zeigt alle;
Entfernen funktioniert.

### BLOCK 8 — Gesuch-Flow + Kommentare
**Zuerst Planungs-Chat (DB):** Tabelle `comments` (listing_id, user_id, text, RLS:
public select, insert nur eingeloggt, delete nur eigene). Behebt PGRST205. D2-Check.
**Dann Claude Code:** CommentSection anbinden — auf Gesuchen können Verkäufer
öffentlich antworten (Sackgasse beseitigt); Gesuch-Ersteller wird benachrichtigt.
**Abschlusskriterien:** Kommentar auf Gesuch → sichtbar + Benachrichtigung beim
Ersteller; Löschen nur eigener Kommentare.

### BLOCK 9 — MONETARISIERUNG (der Geld-Block, zusammenhängend)
**Konzept „Keine Schuld ohne Deckung":** Bargeld läuft persönlich (App fasst es nie an).
Provision 10% in Talern beim Bestätigen. Guthaben wird geprüft, BEVOR Schuld entsteht.
Einnahme = Taler-Verkauf via Stripe.
**Planungs-Chat (DB, in dieser Reihenfolge):**
1. DB-Constraint `credits >= 0` (Sicherheitsnetz — Minus physisch unmöglich)
2. `process_transaction_commission`: Prüfung+Abbuchung atomar (Race-fix, eine
   Rundungsregel in Rappen überall)
3. `create_buy_intent`: bei Reservierung Verkäufer-Guthaben prüfen → wenn zu wenig:
   Reservierung läuft trotzdem, aber sofortige Benachrichtigung „Dir fehlen X Taler"
4. `credit_taler`-RPC (atomare Gutschrift, idempotent per Stripe-Session-ID)
5. Startguthaben 100 → 5 Taler (DB-Default + Onboarding-RPC) — **JJ-Entscheidung bestätigt**
**Claude Code:** Stripe Checkout für Taler-Pakete (Restricted Key, Checkout Sessions,
Webhook mit constructEvent() → `credit_taler`), Kauf-Button im Wallet, bei
„Nicht genug Taler" direkter Kauf-Flow mit exaktem Fehlbetrag (Deal bleibt offen),
alle Texte auf 5 Start-Taler, Live-Viewer- + Pionier-Zähler an ECHTE Daten koppeln
(UWG-Risiko beseitigen).
**Abschlusskriterien:** Kompletter Kreislauf im Stripe-Testmodus: reservieren →
Warnung → Taler kaufen → Guthaben steigt → bestätigen → Provision weg → Webhook
idempotent (doppeltes Event bucht nicht doppelt); Minus-Guthaben unmöglich.
**JJ parallel:** Stripe-Konto (Einzelfirma) einrichten — dauert 1–2 Tage Freischaltung.

### BLOCK 10 — Recht (vor Launch, nicht verhandelbar)
Impressum, Datenschutzerklärung (DSG/DSGVO), AGB inkl. Taler-Regeln (Guthaben nur
für Plattformgebühren, kein E-Geld, nicht auszahlbar/übertragbar, 1 Taler = CHF 1),
Konto-Löschen als ECHTE Löschung/Anonymisierung (Auth-User + Personendaten;
DB-Teil via Planungs-Chat).
**Abschlusskriterien:** Alle Seiten erreichbar (Footer-Links), Konto-Löschung
nachweisbar vollständig.

### BLOCK 11 — Launch
Bug G (Mail-Link localhost → Supabase site_url + Redirect-Allow-List + Vercel
`NEXT_PUBLIC_APP_URL`), Vercel-Deploy (Preset „Next.js", alle Env-Variablen),
frische Supabase-Types (`npx supabase gen types typescript --project-id
lhqsuelguwfdflapzdhk`), letzter Grep auf Debug-Reste, kompletter Klick-Durchlauf
im Inkognito-Fenster auf der echten Domain, Stripe auf Live-Modus.
**Abschlusskriterien:** Registrierung mit echtem Mail-Link auf der Live-Domain
funktioniert Ende-zu-Ende; kompletter Kaufkreislauf live.

**NICHT MVP (nach Launch, additiv per phasen-ergaenzung-v33.md):** Events/Tickets/QR,
KI-Features, Auktionen, Coffee, Schnäppchen-Jagd, Push, Boosts.

---

## SO STARTET JJ MORGEN (exakt)

**1. Planungs-Chat (dieser Projekt-Chat), erste Nachricht:**
> „Neue Session. Lies uebergabe-2026-07-09.md. Block 2 läuft bei Claude Code.
> Bereite die DB-Schritte für Block 3 vor (profiles_private) und zeige mir das
> SQL zur Freigabe."

**2. Claude Code (PowerShell im Projektordner), erste Nachricht:**
> „Neue Session. Lies zuerst: CLAUDE.md, DEVELOPMENT_GUIDELINES.md,
> docs/database-schema.md, docs/design/design-referenz.html und
> uebergabe-2026-07-09.md im Projektroot. Arbeite dann BLOCK 2 aus der
> Übergabe-Datei komplett autonom durch nach dem Arbeitsmodus in der Datei:
> erst messen, dann fixen, tsc + build grün, Selbst-Check gegen die
> Abschlusskriterien, lokaler Commit, KEIN Push. Stelle keine Zwischenfragen,
> ausser eine Dauerregel wäre verletzt. Am Ende: Testliste für mich,
> max. 5 Browser-Klick-Punkte."

**3. JJ testet die 5 Punkte im Browser → meldet Ergebnis in BEIDEN Chats →
nächster Block.** Bei jedem Screenshot-Fall (git push / Remove-Item / DB):
Screenshot in den Planungs-Chat, dort wird entschieden.
