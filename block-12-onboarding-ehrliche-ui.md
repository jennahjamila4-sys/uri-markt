# Block 12 — Onboarding, FOMO-Texte & ehrliche UI
> Verbindlicher Blockplan. Quelle: mvp-restplan-bis-launch.md (Block 12) + JJ-Entscheide 20.07.2026.
> Auslieferung: **Claude Code on the web (Cloud) → Pull Request**, JJ merged per Klick. Kein push.ps1, kein Verify-Doppelklick.
> Prinzip: FOMO = emotionale, empathische Verkaufs-Schlüsselwörter — NIE erfundene Zahlen, NIE falscher Social-Proof, NIE Zeitversprechen ("in Minuten meldet sich jemand" wäre für eine neue App unwahr). "Immer faktisch wahr" (Schweizer Wettbewerbsrecht).
> Design: Für JEDE UI-Änderung den frontend-design Skill nutzen. Anmutung exklusiv/premium/"teuer", Antigravity-inspirierte Special-Effects — als reine Visual-Schicht (nie Logik ersetzen, Kontaktdaten nie nur per CSS verstecken).

---

## DB — ERLEDIGT (Planungs-Chat, D2-grün, 20.07.2026)

**Migration A `block12_comment_count_denormalization`:**
- `listings.comment_count` (integer, NOT NULL, default 0), Backfill korrekt (17x 0, 1x 1).
- Trigger `trg_sync_comment_count` auf `comments` (AFTER INSERT OR DELETE) -> Funktion `sync_listing_comment_count()` (SECURITY DEFINER, search_path fixiert, Untergrenze 0). Zaehlt bei jedem neuen UND geloeschten Kommentar korrekt.
- Keine neuen Grants noetig (Feed liest `comment_count` ueber bestehenden SELECT-Grant).

**Migration B `block12_favorites_table`:**
- Tabelle `public.favorites (id, user_id->profiles CASCADE, listing_id->listings CASCADE, created_at, UNIQUE(user_id,listing_id))`.
- RLS ON, 3 Policies nur eigene (`user_id = auth.uid()`): SELECT/INSERT/DELETE. Kein UPDATE.
- Grants: `authenticated` = SELECT,INSERT,DELETE - `anon` = nichts. Index `idx_favorites_listing`.

**Willkommensbonus (Live-DB belegt):** `handle_new_user()` setzt 500 Rappen = **5 Uri-Taler** je neuem Nutzer. Geschenk-Zeile im Onboarding ist damit faktisch wahr.

---

## AUFGABEN CLAUDE CODE (Cloud, Ergebnis als PR)

### 0. Pflicht-Vorlauf
- Repo-Ist messen: welche Dateien/Screens bilden das aktuelle Onboarding, wo liegen ListingCard/TikTokScroll, wo der Profil-Einstellungsbereich.
- `npx supabase gen types typescript --project-id lhqsuelguwfdflapzdhk` regenerieren; `favorites` und `listings.comment_count` MUESSEN im Generat stehen. Kein Handedit an database.ts (Lektion 11).
- Falls gen types im Cloud-Sandbox scheitert (SUPABASE_ACCESS_TOKEN/Env fehlt): NICHT handeditieren, sondern im PR-Text STOPP melden -> Planungs-Chat liefert die Typen per Supabase-MCP nach.

### 1. Onboarding umbauen — 2 Screens (frontend-design Skill!)
- Benachrichtigungs-Auswahl RAUS aus Onboarding -> in die Profil-Einstellungen verschieben (Feature bleibt erreichbar, nur verschoben).
- Screen "Was interessiert dich" (Kategorien-Interessen) ENTFERNEN.
- KEINE Events-/Firmen-/Vereine-Karte (Events existieren noch nicht).
- Kein Fake-Social-Proof, keine erfundenen Zahlen/Zeiten/Namen als ob real. Demo-Match nur mit sichtbarem Label "Beispiel".
- Persona wird durch den Karten-Tap auf Screen 1 gesetzt; steuert nur den Gratulations-Text auf Screen 2.
- Design premium/exklusiv, Antigravity-Effekte (s. Design-Direktion unten).

### 2. Kommentar-Zaehler im Feed sichtbar (DB fertig)
- ListingCard + TikTokScroll zeigen `comment_count` als dezentes Badge "Kommentar-Icon n". Bei 0 ausblenden. Wert aus `listings.comment_count` (im select('*') dabei). Keine eigene Count-Query.

### 3. Herz ehrlich machen (favorites)
- Server-Action `toggleFavoriteAction(listingId)`: Insert wenn nicht vorhanden, Delete wenn vorhanden. `user_id` NIE vom Client — server-seitig `auth.uid()`. Doppel-Tap idempotent (UNIQUE faengt ab).
- Herz-Zustand (gefuellt/leer) aus `favorites` laden (own-only via RLS). Herz-Pop-Animation behalten.
- Neuer Tab "Favoriten" (Profil/Meine Inserate) listet favorisierte Inserate mit korrektem Status-Sticker. Leer -> Empty-State (unten).

### 4. Taler-Karten-Texte + 5. Empty-States
- Ton wie unten. Zahlen faktisch. Keine Cash-out-Andeutung (Taler nur plattformintern).

### 6. E2E `e2e/block12-onboarding-ehrliche-ui.spec.ts`
- Kommentar-Zaehler: Kommentar anlegen -> +1; Kommentar loeschen -> -1 (beide Trigger-Zweige, Lektion 5).
- Herz persistent: User A favorisiert -> erscheint im Favoriten-Tab, haelt nach Reload; erneuter Tap -> weg.
- RLS-Leak-Beweis (kritisch): User B sieht A's Favoriten NICHT.
- Onboarding: 2 Screens; kein Benachrichtigungs-/Interessen-Screen; keine Events-Karte.
- Preflight (Lektion 14) + Cleanup eigener Listings/Favorites/Comments/Notifications vorher & nachher.

---

## ONBOARDING-TEXTE (final, verbindlich) — Smart Match ist Herzstueck

### Screen 1 — Hook + zwei Karten (Ken-Burns-Alpen-Hero)
Headline: "Was bei dir rumsteht, ist Gold wert." (Gold-Shine auf "Gold wert")
Sub: "Fuer dich - und fuer jemanden in Uri. Stell es einmal ein, und Smart Match meldet sich bei dir, sobald jemand Interesse hat."

Karte A (Tap -> Persona verkaufen): Titel "Loswerden & verdienen" / Text "Einmal einstellen - dann macht die App die Arbeit und sagt dir Bescheid, sobald jemand aus Uri dein Ding will."
Karte B (Tap -> Persona suchen): Titel "Etwas Bestimmtes suchen" / Text "Sag einmal, was du brauchst. Smart Match meldet sich, sobald es jemand aus deiner Naehe anbietet - du musst nie wieder suchen."
Dezenter Link: "Mich interessiert beides" (-> Persona beides). "Ueberspringen" -> Screen 2 ohne Persona.

### Screen 2 — So funktioniert Smart Match + Geschenk + Gratulation
Kicker: "So funktioniert's"
Headline: "Einmal einstellen. Uri-Markt sucht fuer dich weiter." ("Uri-Markt sucht..." in Gold)
Schritt 1: "Du stellst dein Angebot ein - ein Foto, ein Titel, fertig."
Schritt 2 (HERZSTUECK, gold hervorgehoben, Badge "Das Herzstueck"): "Smart Match arbeitet fuer dich: Sobald jemand aus deiner Naehe genau das sucht, meldet sich die App bei dir."
Schritt 3: "Ihr trefft euch vor Ort, du uebergibst - erledigt. Kein Versand, kein Papierkram."
Demo (Label "Beispiel"): "'Kinderwagen' -> Anfrage von jemandem aus deiner Gemeinde."

FOMO (verkaufspsychologisch = verpasste Chance, KEINE Zahlen): "Ohne die App verpasst du vielleicht genau den, der dein Ding gesucht hat. Mit Smart Match nie wieder."

Geschenk (kurz, vor CTA): "5 Uri-Taler geschenkt - dein Startguthaben, weil du neu dabei bist."

Gratulations-Peak:
- verkaufen / beides / uebersprungen: "Gratulation - du machst gerade den ersten Schritt. Stell noch heute dein erstes Inserat ein; Smart Match uebernimmt den Rest."
- suchen: "Gratulation - du machst gerade den ersten Schritt. Sag noch heute, was du suchst; Smart Match meldet sich, sobald es jemand aus deiner Naehe hat."
CTA: "Los geht's" -> Registrierung.

Referenz-Mockup: onboarding-mockup.html (2 Screens, Design-Referenz-Stil, Smart Match als Herzstueck). Claude Code baut Anmutung + Texte danach.


## TALER-KARTEN-TEXTE (Ton)
Section-Headline: "Uri-Taler — dein Beitrag, wenn's klappt."
Sub: "Inserieren ist kostenlos. Erst wenn du verkaufst, gehen 10% als Taler an die Plattform — so bleibt Uri-Markt werbefrei und fair."
Pro-Paket-Beispielzeile (Zahlen faktisch): "Genug fuer deine naechsten Deals — ohne dass du an Gebuehren denken musst."
Keine Auszahlbarkeits-Andeutung; Taler nur plattformintern.

## EMPTY-STATES (final)
- Feed leer: "Noch nichts hier — aber das aendert sich schnell. Stell dein erstes Inserat ein und mach den Anfang in deiner Gemeinde."
- Favoriten leer: "Noch keine Favoriten. Tippe auf ein Herz, um Dinge zu merken, die dir gefallen — so verlierst du nichts aus den Augen."
- Meine Inserate leer: "Du hast noch nichts eingestellt. In 2 Minuten ist dein erstes Inserat online."

---

## DESIGN-DIREKTION (frontend-design Skill, bindend fuer alle Screens)
- Basis = docs/design/design-referenz.html: Dark Mode, Gold #FFD700 auf Schwarz, Glassmorphism, Syne (Display) + DM Sans (Body), Hero = Uri-Alpen-Panorama mit langsamem Ken-Burns-Zoom, Uristier-Logo.
- Anmutung: exklusiv, premium, "teuer". Antigravity-inspiriert: schwebende/leichte Elemente, sanftes Parallax, gestaffeltes Reveal beim Laden, Gold-Border-Sweep auf Highlight-Karten, Hover-Lift, Herz-Pop.
- Reine Visual-Schicht: Effekte duerfen NIE Logik ersetzen; Kontaktdaten/Buttons nie nur per CSS verstecken.

---

## DONE-KRITERIEN
- Onboarding 2 Seiten mit den zwei Triggern, Du-Ansprache, Geschenk-Teaser.
- Benachrichtigungen im Profil (nicht mehr im Onboarding).
- Taler-Texte neu.
- Kommentar-Zaehler korrekt: E2E Kommentar -> +1 (und Loeschen -> -1).
- Herz speichert persistent, RLS-Leak-Beweis (User B).
- gen types regeneriert, kein Handedit.
- Alle Gates gruen ODER im PR klar als UNGETESTET gekennzeichnet (s. Startnachricht).

---

## STARTNACHRICHT (kopierfertig — als Text in neue Claude-Code-on-the-web-Session einfuegen)

Block 12 — Onboarding, FOMO-Texte & ehrliche UI. Auslieferung als Pull Request. Lies zuerst CLAUDE.md + die neueste uebergabe-*.md + mvp-restplan-bis-launch.md + block-12-onboarding-ehrliche-ui.md. Fehlt eine dieser Dateien: STOPP an JJ, nichts selbst anlegen.

DB ist fertig und D2-verifiziert (Planungs-Chat): listings.comment_count + Trigger trg_sync_comment_count (INSERT+DELETE), Tabelle favorites (RLS nur eigene, Grants authenticated=SELECT/INSERT/DELETE, anon=nichts). DB NICHT anfassen. Willkommensbonus real = 5 Uri-Taler (handle_new_user, 500 Rappen).

Schritt 0: (a) Repo-Ist messen (aktuelle Onboarding-Dateien/Screens, ListingCard/TikTokScroll, Profil-Einstellungen). (b) npx supabase gen types typescript --project-id lhqsuelguwfdflapzdhk regenerieren; favorites + listings.comment_count muessen im Generat stehen. Kein Handedit (Lektion 11). Falls gen types im Cloud-Sandbox scheitert (Token/Env fehlt) -> STOPP im PR-Text melden, Planungs-Chat liefert die Typen per MCP nach.

Design-Pflicht: fuer JEDE UI-Aenderung den frontend-design Skill nutzen. Anmutung exklusiv/premium, Antigravity-Special-Effects auf Basis docs/design/design-referenz.html (Gold auf Schwarz, Glassmorphism, Syne/DM Sans, Ken-Burns-Hero). Effekte sind reine Visual-Schicht — nie Logik ersetzen, Kontaktdaten nie nur per CSS verstecken.

Umsetzen (D3: ein Fix pro Zyklus, max 3, dann STOPP):
1. Onboarding auf 2 Screens (Texte EXAKT aus block-12-MD, Du-Ansprache, Smart Match ist Herzstueck): Screen 1 Ken-Burns-Hero + Hook + zwei antippbare Karten; Screen 2 = 3-Schritte-Smart-Match-Story (Schritt 2 gold hervorgehoben) + FOMO-Zeile (verpasste Chance, keine Zahlen) + Geschenk-Teaser (5 Uri-Taler) + persona-abhaengiger Gratulations-Peak + CTA "Los geht's". Referenz: onboarding-mockup.html. Benachrichtigungs-Auswahl in die Profil-Einstellungen verschieben. "Was interessiert dich"-Screen entfernen. KEINE Events-/Firmen-Karte. Kein Fake-Social-Proof, keine erfundenen Zahlen/Zeiten; Demo-Match nur mit Label "Beispiel".
2. Feed-Badge Kommentar-Zaehler aus listings.comment_count (bei 0 ausblenden). Keine eigene Count-Query.
3. Herz ehrlich: toggleFavoriteAction(listingId), user_id server-seitig aus auth.uid() (NIE vom Client), Insert/Delete idempotent. Herz-Zustand aus favorites laden. Neuer Tab "Favoriten" mit Status-Stickern. Herz-Pop behalten.
4. Taler-Karten-Texte + Empty-States exakt aus block-12-MD.
5. E2E e2e/block12-onboarding-ehrliche-ui.spec.ts: Kommentar->+1 und Loeschen->-1; Herz persistent (Reload); RLS-Leak-Beweis (User B sieht A's Favoriten nicht); Onboarding-Screens-Assertion. Preflight + Cleanup vorher/nachher.

Gates & Auslieferung (Cloud): npx tsc --noEmit + next build (ESLint) muessen 0 Errors haben; Playwright headless ausfuehren. Ob E2E im Cloud-Sandbox laeuft, ist NEU und ungetestet — falls Secrets/Env (E2E_USER_A/B, Supabase-Keys) fehlen und E2E nicht laufen kann: NICHT "getestet" behaupten (Lektion 8), sondern im PR-Text pro Gate klar angeben was lief (tsc/build/E2E) und was NICHT + warum. Ergebnis als Pull Request oeffnen mit: geaenderte Dateien, Root-Cause-Bezug, Gate-Status, Klick-Testliste, offene Punkte (BEWIESEN/UNGETESTET). JJ merged per Klick. Kein direkter Push. Uebergabe-Datei aktualisieren + neue Lektionen in CLAUDE.md.
