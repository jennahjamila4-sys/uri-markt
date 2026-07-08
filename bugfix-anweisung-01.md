# Arbeitsauftrag — Bug-Session 01
> Fortsetzung von `uebergabe-stand-02.md`. Diese Datei komplett lesen, dann abarbeiten.

---

## ARBEITSWEISE (gilt für diese ganze Session)

- **Pro Bug: Ursache selbst finden → direkt fixen → `tsc` + `build` grün → nächster Bug.** NICHT auf Code-Freigabe warten. JJ liest keinen Code. JJ testet Ergebnisse.
- **Root-Cause-Fix, KEIN Workaround.** Symptom verstecken ist verboten. Wenn ein schneller Fix nur das Symptom kaschieren würde, behebst du den echten Grund.
- **Backend/Frontend-Mismatch, den du beim Fixen entdeckst, sofort mitfixen.** Du kennst das Ziel: ein funktionierender Marktplatz, Feld für Feld konsistent zwischen DB, Server Action und UI. Offensichtliche UI-Lücken schliesst du wie ein UI-Experte / Tech-Founder gleich mit.
- **Wahrheit = laufender Code + echtes Supabase-Schema (MCP, `project_id` = `lhqsuelguwfdflapzdhk`).** NICHT die Phase-Plan-Dateien. Bei allem was mit Spalten/Enum-Werten zu tun hat (`type`, `views`, `credits`, `commission`) IMMER gegen das echte DB-Schema prüfen, nicht raten.
- **PowerShell:** eigene Read/Glob/Grep-Tools, keine Pipes.
- **Git:** nach jedem Bug ein sauberer, eng gefasster Commit (`fix: ...`). **KEIN Push ohne explizites OK von JJ.**
- **Echte Produkt-Gabelung**, die du NICHT aus Doku/Design ableiten kannst: sinnvollste Variante wählen, umsetzen, im Schlussbericht als „Entscheidung getroffen — bitte testen / widersprechen" markieren. Nicht blockieren.

## BERICHT AN JJ (pro Bug, Alltagssprache, kein Code)
1. **War kaputt:** 1 Satz Ursache.
2. **Geändert:** 1–2 Sätze.
3. **So testest du:** konkrete Klick-Schritte.

---

## SCHRITT 0 — Start
1. Lesen: `CLAUDE.md`, `DEVELOPMENT_GUIDELINES.md`, `docs/database-schema.md`, `docs/design/design-referenz.html`.
2. `git status` — sind die gestrigen Auth-/Onboarding-Fixes committet und ist der Baum sauber? Falls uncommittet: erst als eigenen Commit sichern.
3. `npx tsc --noEmit` + `npm run build` — Ausgangszustand grün? Falls nicht: erst grün machen.

---

## BUG 1 — Neues Inserat erscheint erst nach Logout
**Ziel:** Neu erstelltes Inserat ist sofort im Feed sichtbar, ohne Reload/Logout.

**Wahrscheinliche Ursache:** Der Feed (Server Component `src/app/page.tsx`) liefert `initialListings`; `FeedPage` (Client) hält sie im State und synct nie neu. `createListingAction` ruft zwar `revalidatePath('/')`, aber der Client fordert die Serverdaten nach dem Erstellen nicht neu an → erst nach Logout/Login lädt der Server neu.

**Prüfen:** (a) Läuft das Erstellen wirklich über die Server Action `createListingAction` (kein Client-Insert)? (b) Ruft der Success-Handler (`CreateModal`/`AngebotForm`/`GesuchForm`) ein echtes Neuladen aus (`router.refresh()`)? (c) Hält `FeedPage` `initialListings` in `useState` ohne Re-Sync?

**Fix (Root-Cause):** Nach erfolgreichem Erstellen echtes Neuladen der Serverdaten auslösen (`router.refresh()` im Success-Handler) UND `revalidatePath('/')` in der Action belassen. Die Quelle bleibt der Server — NICHT als Ersatz das neue Inserat manuell vorne in den State schieben. (Optimistic UI zusätzlich ist erlaubt, aber nicht statt des Refresh.)

**Test:** Eingeloggt ein Angebot erstellen → sofort oben im Feed, ohne Reload.

---

## BUG 2 — Gesuch nicht im Feed sichtbar (nur Angebote)
**Ziel:** Neu erstelltes Gesuch erscheint im Gesuche-Tab; Angebote im Angebote-Tab.

**Wahrscheinliche Ursache:** `type`-Wert-Mismatch. Die Gesuch-Erstellung schreibt einen anderen String in `listings.type` als der Gesuche-Tab filtert (z. B. `Gesuch` vs. `gesuch` vs. `Gesuche`), ODER `ListingCard` rendert nur Angebot-Felder (Preis) und blendet Gesuche faktisch aus.

**Prüfen (gegen echtes DB-Schema via MCP):** (a) Welche exakten Werte erlaubt/enthält `listings.type`? (b) Welchen exakten String schreibt die Gesuch-Erstellung? (c) Auf welchen String filtert der Gesuche-Tab? (d) Rendert `ListingCard` ein Gesuch sauber (kein Preis → stattdessen Budget/„Gesuch"-Label, kein Absturz)?

**Fix (Root-Cause):** Eine einzige Quelle der Wahrheit für die `type`-Werte (die `ListingType`-Konstanten aus `src/types`) — dieselben Werte beim Schreiben UND beim Filtern. DB, Erstellen und Feed-Filter angleichen. `ListingCard` so erweitern, dass Gesuche korrekt dargestellt werden.
> Gleicher Verdacht beim dritten Tab (Vorankündigung/Event): Enum-Wert im Typ ist evtl. `Event`, die UI nutzt evtl. `Vorankündigung`. Beim Prüfen mitkontrollieren und mit angleichen.

**Test:** Gesuch erstellen → erscheint im Gesuche-Tab, korrekt dargestellt.

---

## BUG 3 — Profil-Icon (oben rechts) löst Logout aus
**Ziel:** Klick auf das Profil-Icon öffnet ein Dropdown-Menü, nicht Logout.

**Ursache:** `onClick` des Profil-Icons ist auf `signOut()` verdrahtet.

**Fix (UI-Lücke schliessen):** Glass-Dropdown im Header bauen. Einträge: „Mein Profil" (→ `/profile`), „Abmelden" (→ `signOut`). Wallet/Einstellungen NUR verlinken, wenn die Routen wirklich existieren (Wallet ist erst Phase 3 — sonst weglassen, nicht erfinden). Schliesst bei Outside-Click, tastatur-zugänglich.

**Test:** Icon klicken → Menü öffnet. „Abmelden" meldet ab, „Mein Profil" öffnet das Profil.

---

## BUG 4 — „Profil" in der Bottom-Nav tut nichts
**Ziel:** „Profil" unten öffnet `/profile`.

**Ursache:** Nav-Eintrag ohne funktionierende Navigation (Button ohne Link/Route oder falsche Route).

**Fix:** Auf `/profile` verdrahten (Next `Link`/`router.push`). Aktiver State via `usePathname`. Konsistent mit BUG 3 — beide Wege führen auf `/profile`.

**Test:** Unten „Profil" tippen → Profilseite öffnet.

---

## BUG 5 — View-Zähler läuft endlos hoch („1144 views")
**Ziel (dokumentiertes Design — durch Testen bestätigen):**
- Angebote zeigen „X schaut gerade" als bewusst gesetzten, deterministisch berechneten FOMO-Effekt — **nicht** persistiert, **keine** realen Views, steigt nicht endlos.
- Der echte `views`-Zähler (Gesuche/Events und die reale Zählung) wird pro Ansicht genau **einmal** erhöht.

**Wahrscheinliche Ursache von „1144 und steigt weiter":** Der echte `views`-Zähler wird beim Detail-Öffnen mehrfach/wiederholt erhöht (`useEffect` ohne Guard/falsche deps, feuert bei jedem Render), ODER der seeded „schaut gerade"-Wert wird fälschlich als `views` angezeigt/gespeichert.

**Prüfen:** (a) Ist „1144" der echte `views`-Wert (DB, via MCP) oder der seeded Watcher? (b) Wo und wie wird `views` erhöht?

**Fix (Root-Cause):** View-Erhöhung genau **einmal pro Detail-Öffnung** (Guard gegen Doppel-/Dauerfeuer), kein Aufaddieren bei jedem Render. Seeded „schaut gerade" sauber vom echten `views` trennen und als reiner Anzeige-Effekt kennzeichnen.
> **Entscheidung markieren:** „einmal pro Öffnung (Client-Guard)" ist der direkte Fix. Eine echte Pro-Nutzer-Entdopplung (eigene Views-Tracking-Tabelle) ist mehr Aufwand — nur bauen, wenn JJ das ausdrücklich will; sonst als Notiz vermerken.

**Test:** Ein Inserat mehrmals öffnen/schliessen → `views` steigt pro Öffnung um max. 1, nicht endlos. „Schaut gerade" bleibt plausibel.

---

## BUG 6 — „+10% Provision in Talern bei Kauf" ist falsch
**Ziel:** Käufer zahlt **nur** den ausgeschriebenen Preis. Die 10% Provision (in Talern) zieht die App dem **Verkäufer** ab. Kein Aufschlag für den Käufer.

Beide Baustellen fixen:

**(a) Text:** Jede käuferseitige Anzeige mit „+10% Provision in Talern bei Kauf" o. ä. ist falsch → korrigieren/entfernen. Käufer-Sicht: nur der Preis, ggf. Hinweis „für dich provisionsfrei". Verkäufer-Sicht (`SellerDashboard`/Bestätigen): klar „Beim Verkauf werden dir 10% als Provision in Talern abgezogen: CHF X = Y Taler."

**(b) Echte Berechnung prüfen (gegen Schema + RPC via MCP):**
- `createBuyIntent`: `amount` = `listing.price` (was der Käufer zahlt). `commission` = 10% als **separate** Grösse (Verkäufer-Kosten), NICHT auf `amount` addiert.
- `process_transaction_commission` (RPC): zieht die Provision aus `profiles.credits` des **Verkäufers** ab. **Einheiten prüfen:** `credits` ist `bigint` in Rappen. 10% von CHF 100 = CHF 10 = 10 Taler = 1000 Rappen. Die Einheit des `commission`-Felds (CHF-Dezimal vs. Rappen) und der RPC-Abzug müssen konsistent sein — sonst wird zu wenig/zu viel abgezogen.
- Sicherstellen: **nirgends** wird dem Käufer etwas aufgeschlagen.

**Test:** Als Käufer Kaufabsicht → angezeigter Betrag = Listenpreis, kein +10%. Als Verkäufer bestätigen → Taler-Saldo sinkt um genau 10% des Preises (in Taler).

---

## ABSCHLUSS
- Nach allen Bugs: `tsc` + `build` grün.
- Schlussbericht pro Bug (kaputt / geändert / so testen) + alle getroffenen Entscheidungen (BUG 5 Dedup-Frage, evtl. Vorankündigung/Event-Naming).
- Commits pro Bug lokal. **KEIN Push.**
