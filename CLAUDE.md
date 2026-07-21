# CLAUDE.md — Zentrale Steuerungsdatei Uri-Markt
> ⚠️ PFLICHT: Diese Datei bei JEDEM Start einer neuen Sitzung zuerst lesen.
> Danach die referenzierten Dateien lesen die zur aktuellen Aufgabe relevant sind.

---

## 🖥️ Arbeitsumgebung & Auslieferung (Stand 19.07.2026)

* Implementierung läuft über Claude Code on the web (Cloud). Kein lokales Claude Code, keine PowerShell-Scripts mehr (kein verify.ps1, kein push.ps1).
* Quelle der Wahrheit ist ausschliesslich das GitHub-Repo. Claude Code sieht nur das Repo — nicht die lokale Maschine, nicht das Gedächtnis des Planungs-Chats. Alles Nötige muss committet sein.
* Auslieferung als Pull Request. Jede Aufgabe endet mit einem PR + Änderungs-Zusammenfassung. Nichts landet auf `main`, bevor JJ prüft und mergt.
* Selbsttest-Pflicht bleibt absolut (Lektion 5/8/9): Vor dem PR müssen `npx tsc --noEmit` und `next build` 0 Fehler haben und die Playwright-E2E grün sein. JJ prüft nur das Endergebnis.
* Kann der Cloud-Sandbox Build oder E2E nicht ausführen (fehlende Secrets/Env oder Netz-Sperre): STOPP + Meldung an JJ mit der genauen fehlenden Voraussetzung. Tests werden nie stumm übersprungen oder umgangen (No-Workaround).
* Datenbank unverändert: Alle Migrationen nur über den Planungs-Chat via Supabase-MCP. Claude Code fasst die DB nie direkt an.

---

## 🎯 Was ist dieses Projekt?

**Uri-Markt** – Hyperlokaler, werbefreier, gamifizierter Marktplatz für den Kanton Uri (Schweiz).
- Slogan: *„Regional – Genau was es brucht!"*
- Betreiber: Einzelperson, Solo
- Stack: Next.js 14 · Supabase · Stripe · Claude API · Vercel

---

## 📁 Pflichtlektüre vor dem Arbeiten

### Immer lesen:
| Datei | Inhalt |
|---|---|
| `DEVELOPMENT_GUIDELINES.md` | Code-Stil, Konventionen, Architekturentscheidungen, Sicherheitsregeln |

### Vor dem Arbeiten an einem Feature lesen:
| Feature | Datei |
|---|---|
| Feed, Listings, TikTok-Scroll | `docs/feed.md` |
| Auth, Onboarding | `docs/auth-onboarding.md` |
| Inserat erstellen (Angebot/Gesuch/Event) | `docs/create-listing.md` |
| Deal-Flow (Kaufen/Verkaufen/Kontakt) | `docs/deal-flow.md` |
| Gamification (XP, Level, Badges) | `docs/gamification.md` |
| Uri-Taler Wallet | `docs/wallet.md` |
| Event-Tickets & QR-System | `docs/events-tickets.md` |
| Smart Match System | `docs/smart-match.md` |
| KI-Features (Text-Booster, Matching) | `docs/ai-features.md` |
| Notifications (Push, E-Mail, In-App) | `docs/notifications.md` |
| Profil & öffentliches Profil | `docs/profile.md` |
| Stripe-Integration | `docs/stripe.md` |
| Admin-Panel | `docs/admin.md` |
| DSGVO & Datenschutz | `docs/dsgvo.md` |

### Datenbank & Architektur:
| Datei | Inhalt |
|---|---|
| `docs/database-schema.md` | Vollständiges DB-Schema, RLS-Policies, RPC-Funktionen |
| `docs/architecture.md` | Systemarchitektur, Patterns, Entscheidungen |

---

## 🔑 Kritische Regeln (Zusammenfassung)

> Details in `DEVELOPMENT_GUIDELINES.md`

1. **`user_id` NIEMALS vom Client** – immer `supabase.auth.getUser()` serverseitig
2. **Taler NIEMALS direkt in DB** – immer via RPC `process_transaction_commission`
3. **Kontaktdaten NIEMALS via CSS verstecken** – Freischaltung nur via RLS
4. **Stripe Webhooks IMMER signieren** – `stripe.webhooks.constructEvent()`
5. **Vor jedem neuen Feature** – Feature-Doku in `/docs` lesen oder anlegen

---

## 🔬 Debugging-Regeln (VERBINDLICH)

> Hintergrund: Auth-Bug 02.07.2026 (`42501 permission denied` auf `profiles`) —
> drei Theorien wurden gefixt bevor gemessen wurde. Die Live-Messung fand die
> Ursache in Minuten. Diese Regeln verhindern die Wiederholung.

### Regel D1: Messen vor Fixen
Bei jedem Bug ZUERST die exakte Fehlermeldung beschaffen (Fehlercode,
Log-Zeile, Debug-Ausgabe). KEIN Fix auf Basis von „wahrscheinlich" oder
„vermutlich". Wenn keine Fehlermeldung sichtbar ist: temporäre Diagnose
einbauen (console.error, Debug-Panel, whoami-Route), messen, dann fixen.
Temporäre Diagnose nach bestandenem Test wieder entfernen.

### Regel D2: Grant/RLS-Check nach jedem DB-Schritt
Nach JEDER Migration, jedem SQL-Lauf und jedem DB-Schema-Schritt sofort
prüfen (Lesabfrage, Sekunden):

```sql
SELECT table_name, grantee, string_agg(privilege_type, ', ') AS privs
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND grantee IN ('anon', 'authenticated')
GROUP BY table_name, grantee
ORDER BY table_name, grantee;
```

Erwartung: JEDE App-Tabelle hat mindestens SELECT für anon und
authenticated (gemäss RLS-Konzept). Fehlt etwas → STOPP, JJ melden,
Ursache klären BEVOR weitergearbeitet wird.

### Regel D3: Ein Fix — ein Test — dann weiter
Niemals mehrere Fixes stapeln. Nach jedem einzelnen Fix: JJ testet im
Browser, meldet Ergebnis, erst dann der nächste Schritt. So ist immer klar,
welcher Schritt was verändert hat.

### Regel D4: Smoke-Test vor jedem Commit
Vor jedem Commit diese 5 Klick-Tests von JJ bestätigen lassen:
1. Login → Header oben rechts zeigt Profil-Icon (nicht „Anmelden")
2. „+" → Inserat-Formular öffnet sich
3. „Profil" (Bottom-Nav) → Dashboard öffnet sich (kein Rücksprung zum Feed)
4. F5 / Seite neu laden → eingeloggt bleiben
5. „Kaufen" auf fremdem Inserat → Kauf-Formular öffnet sich

### Regel D5: Ursache dokumentieren, nicht nur den Fix
Jeder Bugfix-Commit bzw. jede Übergabe-Datei enthält: (a) Symptom,
(b) bewiesene Ursache, (c) Fix, (d) offene Folgefragen.

### ⚠️ Offener Punkt aus 02.07.2026 (noch zu klären)
Es ist NICHT geklärt, welcher DB-Schritt am 02.07.2026 die GRANTs für
anon/authenticated auf `profiles` entfernt hat. Bevor weitere Migrationen
laufen: die an diesem Tag ausgeführten SQL-Schritte durchgehen und den
Verursacher identifizieren — sonst kann derselbe Schritt die GRANTs
erneut entfernen. (Kandidaten: alles, was an diesem Tag via SQL-Editor
oder Migration auf profiles/Policies angewendet wurde.)

---

## Lektionen (Selflearning — bei Session-Start lesen, laufend ergänzen)

> Regel: Sobald ein Fehler, eine Lücke oder ein übersehener Zusammenhang auftaucht,
> SOFORT hier eine kurze Lektion anhängen (2 Zeilen: Was war die Lücke → Regel zur
> Früherkennung) — BEVOR weitergearbeitet wird. Zu Session-Beginn diesen Abschnitt
> lesen und jeden neuen Block aktiv dagegen prüfen.

1. **Querverbindungen mitziehen.** Lücke: Neue Daten (z.B. IBAN im Zahlungen-Tab)
   ohne die Konsumenten (Zahlungsweg im Kauf-Flow) angebunden. → Vor Block-Abschluss
   fragen „Wer nutzt diese Daten noch?" und alle Konsumenten im selben Block ziehen.
2. **Validierung fachlich begründen.** Lücke: willkürliche Mindestlänge (buyer_contact
   min 5 blockierte „JJ"). → Regeln aus der Fachlichkeit ableiten (Schweizer IBAN
   Mod-97, Schweizer Telefonformat), nie geratene Zahlen/Längen.
3. **Dev nach Build frisch starten.** Lücke: build + dev teilten `.next` → „Cannot find
   module './548.js'". → Nach `npm run build` Dev stoppen, `.next` löschen, dev neu starten.
4. **DB-Hypothesen nie raten.** Lücke: Bucket-MIME-/CHECK-Constraint vermutet statt
   gemessen. → DB/Storage-Annahmen immer vom Planungs-Chat an der Live-DB prüfen lassen.
5. **SELBSTTEST-PFLICHT vor jeder Testliste.** Lücke: Validierung an JJ gemeldet, ohne
   sie je mit echten Gültig-/Ungültig-Werten selbst zu prüfen. → Jede Funktion vor der
   Testliste selbst mit echten Gültig- UND Ungültig-Fällen testen (Validierungen:
   automatisierte Tests mit bekannt gültigen Referenzwerten, z.B. IBAN
   CH9300762011623852957) und „selbst getestet, funktioniert" melden. Fehlermeldungen
   müssen sagen, WAS genau falsch ist (z.B. Länge vs. Prüfziffer).
6. **Blockierte Aktion nie stumm.** Lücke: Inserat-Veröffentlichen scheiterte an leerer
   Gemeinde, ohne dem Nutzer zu sagen warum. → Jede blockierte Aktion muss SOFORT sichtbar
   sagen, WAS fehlt und WO: Pflichtfelder beim Absenden rot markieren, zum ersten
   Fehlerfeld scrollen, Button-Klick nie stumm verpuffen lassen (Uri-Markt-Ton). Gilt für
   ALLE Formulare — bei neuen/geänderten Formularen aktiv dagegen prüfen (siehe Lektion 1).
7. **Fehler ≠ leeres Ergebnis ≠ nicht eingeloggt.** Lücke: `useAuth`/`AuthModal` machen bei
   JEDEM ausbleibenden Profil `setUser(null)` — egal ob echter Query-Fehler (z.B. 42501/RLS),
   0 Zeilen (`.single()` → PGRST116) oder wirklich keine Session. Dadurch wirkt eine
   eingeloggte Session client-seitig wie „ausgeloggt" und der Login „tut nichts". → Diese
   drei Zustände IMMER getrennt behandeln und getrennt loggen: (a) keine Session → Login
   anbieten; (b) Session vorhanden, aber Query-Fehler → Fehler zeigen, NICHT ausloggen;
   (c) Session vorhanden, 0 Zeilen → gezielt behandeln (fehlendes Profil/Onboarding).
   `{ data, error, status }` immer zusammen auswerten, nie nur `data`.
8. **Beweis statt Behauptung.** Ein Flow-Feature gilt erst als fertig, wenn ein
   headless-E2E (Playwright) es grün durchläuft — nicht wenn es „sollte
   funktionieren". Erst grüner Lauf, dann „selbst getestet" + Testliste an JJ.
9. **Workaround-Sperre bei Tests.** Wenn ein Test einen echten Bug aufdeckt (z.B.
   Session-Verlust nach Navigation), darf der Test NIEMALS so umgebaut werden, dass
   er den Bug umgeht (Session-Seeding, Mocks, künstliche Zustände). Der Test bleibt
   wie der echte Nutzer ihn erlebt; erst wird der Bug root-cause-gefixt, dann läuft
   der UNVERÄNDERTE Test. Jeder Umbau des Tests statt des Codes = Workaround =
   verboten. → Bei rotem Test IMMER fragen „ist das ein echter Produktbug?" bevor
   der Test angefasst wird; nur Selektoren/Timing-Robustheit am Test anpassen, nie
   die gemessene Realität verfälschen.
10. **Kein `await supabase.*` im `onAuthStateChange`-Callback + genau EIN
   Browser-Client.** Lücke (11.07.2026, bewiesen per E2E+Messung): Der Nutzer wirkte
   nach jeder Voll-Navigation ausgeloggt (Header „Anmelden"), obwohl Cookie + Server-
   Session gültig waren (`/profile` lieferte 200). Ursache: `useAuth` rief im
   `onAuthStateChange`-Callback direkt `await supabase.from('profiles')…` auf.
   supabase-js hält während des Callbacks den Auth-Lock (`navigator.locks`); der
   PostgREST-Call braucht intern `getSession()` → denselben Lock → **Deadlock**, die
   Query löste nie auf. → Regel: onAuthStateChange-Callback synchron halten; jede
   awaited supabase-Arbeit mit `setTimeout(…,0)` aus dem Callback herausschieben.
   Zusätzlich `createClient()` (Browser) als **Singleton** cachen — mehrere
   GoTrue-Instanzen rotieren parallel denselben Refresh-Token (Race). Merksatz:
   „Session weg nach Navigation" ist fast nie die Middleware — erst Server-Sicht
   (`/profile`-Redirect?) vs. Client-Sicht trennen, dann messen.
11. **`src/types/database.ts` ist AUSSCHLIESSLICH Generat — niemals von Hand
   editieren**, auch nicht als „schnelle Korrektur" einer Signatur/Spalte. Hand-Edits
   = Drift = verboten (führt genau zu den nullable-/Signatur-Fehlern aus Block 0).
   Aktualisieren NUR via `npx supabase gen types typescript --project-id <ref> --schema
   public > src/types/database.ts` (SUPABASE_ACCESS_TOKEN steht in `.env.local`).
   Läuft `gen types` mangels Access-Token/CLI NICHT, ist das ein **STOPP-Punkt**: in
   der Übergabe dokumentieren und JJ melden — der Planungs-Chat verifiziert die
   Live-Signatur per MCP. Nie raten, nie von Hand nachziehen.
12. **`tsc` grün ist KEIN Build-Beweis.** Lücke (11.07.2026, Block 4): `next build`
   führt ESLint mit (u.a. `react/no-unescaped-entities`) — ein rohes `"` oder `'`
   in JSX-*Text* bricht den Build, obwohl `tsc --noEmit` grün ist. → Vor JEDER
   Verify-Anforderung neuen JSX-Text mit Sonderzeichen (Anführungszeichen,
   Apostrophe) auf Escaping prüfen: `npx eslint <geänderte Dateien>` muss grün
   sein. ESLint-Regeln werden NIE deaktiviert, um einen Build grün zu bekommen —
   stattdessen escapen (`&quot;`/`&#39;`), deutsche Anführungszeichen („ …“)
   verwenden oder den Text als JS-String `{'…'}` schreiben.

13. **Token-Sparsamkeit ist aktive Pflicht.** Lücke: lange Sessions, Wiederholungen
   und das Nacherzählen bereits bewiesener Stände verbrennen Budget ohne Mehrwert.
   → Kompakt arbeiten: nichts wiederholen, PROVEN-Stände nie neu verifizieren, keine
   Code-Erklärungen an JJ (nur Ergebnisse/Ursachen), ein Fix pro Zyklus. Nach JEDEM
   grünen Block Session sofort beenden (Übergabe schreiben, committen, stoppen) statt
   weiterzulaufen.

14. **Preflight-Pflicht fuer E2E.** Lücke (12.07.2026, Block 6): Leere/fehlende
   Env-Variablen (z.B. STRIPE_WEBHOOK_SECRET) würden erst mitten im E2E-Lauf rot —
   teuer und unklar. → Jeder E2E-Lauf startet mit einem Preflight (Playwright
   `globalSetup` = `e2e/preflight.ts`), der ALLE benötigten Variablen (Supabase
   URL/Anon/Service, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, E2E_USER_A/B) prüft und
   SOFORT mit „FEHLT: X — so beheben: Y" stoppt. JJ wird nie gebeten, .env.local
   manuell zu prüfen.

15. **Fehlerklassen statt Einzelfälle behandeln.** Wenn ein Skript oder Fix einen
   Fehlerfall abfängt (z. B. `index.lock` löschen), muss die gesamte Fehlerklasse
   behandelt werden (alle Git-Lock-Dateien: `HEAD.lock`, `index.lock`,
   `refs/**/*.lock`), nicht nur die eine beobachtete Ausprägung. Vorher immer die
   Ursache prüfen statt blind aufräumen (läuft der Prozess noch?). Skripte, die einen
   Zustand voraussetzen (kein Lock, kein laufender Prozess, Datei existiert), müssen
   diesen Zustand am Anfang prüfen und bei Verletzung mit ROT + Ursache +
   Behebungsanweisung stoppen — nie mitten im Ablauf mit einem git-fatal sterben.
   Gilt für alle PS-Skripte, Migrationen und Fixes. Zusätzlich: Jedes PS-Skript hat
   `try/finally` mit `Read-Host` im finally + `Start-Transcript` in eine Log-Datei —
   ein Skript, das sich bei Fehler sofort schliesst, ist selbst ein Bug.
   **Ergänzung (16.07.2026, Deploy-Zyklus 2):** CLI-Befehle in Skripten IMMER mit
   Non-Interactive-Flags aufrufen (`--yes`, `--force` o.ä., gegen die CLI-Doku
   verifiziert, nie geraten) und benötigte Werte per stdin/Argument mitgeben —
   jeder mögliche Prompt hängt unsichtbar, sobald stdout/stderr gecaptured wird.
   Vor Script-Abgabe JEDEN Befehl einzeln fragen: „Kann der hier eine Eingabe
   erwarten?" (auch Bestätigungen, Overwrite-Fragen, Erstlauf-Setups).

16. **Ist-Zustand vor Annahme.** Lücke (16.07.2026, Deploy ROT): `vercel link --yes`
   wollte das Projekt neu anlegen (409 „already exists") — das Vercel-Projekt
   existierte längst, war git-connected und deployte automatisch bei jedem Push.
   → Vor jedem Script/Plan gegen externe Systeme (Vercel, Stripe, GitHub, Supabase)
   den Live-Zustand prüfen: existierende Projekte, Webhooks, Verbindungen,
   Auto-Deploys. Live-Realität schlägt jede Übergabe-Doku. Externe Ressourcen nie
   implizit erstellen — nur explizit mit Bestehendem verlinken; schlägt das fehl:
   ROT mit klarer Meldung, kein Create-Fallback. Jeder ROT-Fall wird sofort und
   unaufgefordert als neue Lektion hier dokumentiert.

17. **Cowork-Sandbox kann keine Build-/Test-Gates ausfuehren.** Lücke (16.07.2026,
   Block 9): In der Cowork-Session (Sandbox-Shell, 45s-Limit pro Aufruf,
   Hintergrundprozesse sterben mit dem Aufruf) sind `tsc --noEmit`, `next build`,
   `eslint` und Playwright NICHT lauffaehig; `pgrep`-Polling matcht zudem den
   eigenen Aufruf → „RUNNING"-Phantome (20 Min. auf einen laengst toten Prozess
   gewartet). → In Cowork-Sessions Gates gar nicht erst lokal versuchen: Code
   fertigstellen, in der Uebergabe als UNGETESTET markieren, Gates laufen bei JJ
   via `e2e/run-verify.ps1` (Build prueft Types+ESLint, dann Playwright).
   Prozess-Messungen nie ueber pgrep-Substring, sondern ueber Ergebnis-Dateien.

18. **Vollzugsmeldung erst nach Nachweis JEDES Teilschritts.** Lücke (16.07.2026,
   Block 9 ROT): „Referenzkopie abgelegt" als ✅ gemeldet, aber der zwingend dazu-
   gehoerende tsconfig-exclude (`supabase/functions/**`) fehlte → `next build`
   type-checkte den Deno-/jsr:-Import und brach. → Vor jedem ✅ die Teilschritte
   des Auftrags einzeln abhaken (Checkliste gegen den Auftragstext); eine Datei
   „nur ablegen" ist erst fertig, wenn ihre Auswirkungen auf Build/Gates bedacht
   und neutralisiert sind (Lektion 1: Wer konsumiert das noch? — auch der Compiler
   ist ein Konsument).

19. **Off-Canvas-UI muss unsichtbar UND inert sein.** Lücke (17.07.2026, Block 9
   E2E ROT): Das geschlossene NotificationPanel blieb nur per `translate-x-full`
   verschoben im DOM — fuer Playwright „visible", fuer Tastatur fokussierbar, und
   `getByText().first()` traf dessen Texte statt der Feed-Karte („element is
   outside of the viewport", 20s Retry). → Jedes geschlossene Off-Canvas-Element
   bekommt zusaetzlich `invisible pointer-events-none` + `aria-hidden` (A11y-
   Pflicht, kein Workaround). In Tests: Playwright-„visible" heisst NICHT „im
   Viewport"; Texte, die auch in Toasts/Panels vorkommen (z.B. Titel in
   Notification-Messages), nie per seitenweitem `getByText` klicken, sondern
   role-basiert (heading/button). D1 gilt auch fuer Test-Rot: erst
   error-context.md lesen — die Hypothese (Animation) war falsch, das Log nannte
   die echte Ursache woertlich.

20. **UI-Redesign zieht ALLE Test-Helfer nach (Lektion 1 auf Test-Ebene).**
   Lücke (18.07.2026, Block 10): Das Chamäleon-Formular ersetzt den bisherigen
   Mehr-Schritt-Wizard (kein `Weiter`, andere Platzhalter, Single-Screen). Damit
   brechen ALLE E2E-Specs, die über das Create-Modal ein Inserat/Gesuch anlegen
   (block9, deal-completion, block6-taler, ggf. block2/3/5) — sie steuern die
   alten Selektoren. → Bei jedem Formular-/Flow-Redesign sofort fragen „welche
   Tests fahren diesen Flow?" und deren Helfer im selben Block mitziehen. Erfolgs-
   Toast-Strings bewusst stabil halten (hier: „Inserat erfolgreich erstellt! 🎉"
   / „Gesuch erstellt! …") reduziert den Bruch auf die Navigation, ersetzt die
   Helfer-Anpassung aber nicht. Neuer Schreib-Codepfad (Entwurf → Veröffentlichen)
   muss DIESELBEN Seiteneffekte auslösen wie der bestehende (`triggerSmartMatches`),
   sonst matcht ein veröffentlichter Entwurf nie.

21. **Sicherung vor Reparatur.** Lücke (18.07.2026, Umgebungs-Crash): Cowork war
   weg, das Repo blieb zwar intakt, aber uncommittete Block-10-Arbeit hing
   ungesichert am seidenen Faden. → Kein destruktives Script (rm/reset/clean,
   Ordner-Löschung, `git reset --hard`, `git clean`) läuft, solange uncommittete
   Arbeit im Baum liegt — erst sichern (Commit/Stash/Backup), dann reparieren.
   Jedes destruktive Script bekommt einen Pfad-Guard, der beweist, dass es im
   richtigen Repo (`uri-markt`) und nirgends sonst wirkt (Abbruch mit ROT, wenn
   der erwartete Pfad/Marker fehlt). Nach jedem Crash oder Umgebungs-Neustart
   zuerst ein D1-Check des Repo-Stands (`git status`, Datei-Existenz der
   Übergabe-Liste) — nichts anfassen, bevor der Ist-Stand bewiesen ist.

22. **Grant-Härtung trifft auch Server-Actions; Status-Wechsel nur via RPC.**
   Lücke (19.07.2026, Block 11): `rejectTransactionAction` machte ein direktes
   `UPDATE transactions` als Rolle `authenticated` — nach der Grant-Härtung
   (authenticated: nur INSERT+SELECT) → 42501. „Direkter Client-Write" meint die
   **authenticated-Rolle**, nicht nur den Browser: Server-Actions nutzen dieselbe
   Rolle und brechen genauso. → JEDER transactions-Statuswechsel läuft über eine
   SECURITY-DEFINER-RPC (`reject_buy_intent` ergänzt). Ausserdem: zeilenweiser
   Grep verfehlt `.update()`/`.delete()` in der Folgezeile — immer multiline bzw.
   `-A2` prüfen, sonst wird ein Write übersehen (genau das passierte in Schritt 0).

23. **Zeitabhängige Live-Anzeige erst nach Mount (Hydration).** Lücke-Prävention
   (Block 11, verwandt mit Lektion 19): Ein Countdown aus `Date.now()` rendert auf
   Server und Client verschieden → Hydration-Mismatch. → `useMinuteTick` gibt
   `null` bis zum Mount zurück; Komponenten zeigen bis dahin einen stabilen
   Platzhalter („⏳ Reserviert"), erst nach dem Mount die tickende Zeit. Countdown
   IMMER aus der einen DB-Wahrheit (`listings.reserved_until`), nie aus
   `confirmed_at` nachrechnen.

24. **Neues Element im bestehenden Modal bricht generische Selektoren.** Lücke
   (Block 11, konkret zu Lektion 20): Die zweite Checkbox im Kaufmodal (💾 merken)
   machte `getByRole('checkbox')` mehrdeutig → alle Buy-Specs (block9, block10,
   deal-completion) wären an Strict-Mode gescheitert. → Bei jeder Modal-Erweiterung
   die betroffenen Specs im selben Block mitziehen und für interaktive Elemente
   stabile `data-testid` vergeben statt rollen-generisch zu greifen. **Nachtrag
   (Verify-Rot 19.07.):** Auch ein neuer BUTTON kollidiert so — „📝 Entwürfe (n)"
   auf /profile matchte denselben `getByRole('button',{name:/Entwürfe/})` wie der
   MyListings-Tab → Strict-Mode. Fix: Tabs bekamen `data-testid`
   (`mylistings-tab-<key>`), Specs zielen darauf. Assertions unverändert (kein
   Aufweichen).

25. **Async-Prefill darf getippte Eingabe nie überschreiben.** Lücke (Verify-Rot
   19.07., deal-completion:179 — echter Produktbug, kein Testproblem): Das
   Kaufformular lud die Kontaktdaten per Server-Roundtrip und rief danach
   `setBuyerContact(stored)` — löste der Roundtrip NACH dem Tippen auf, war die
   Eingabe des Nutzers weg. → Prefill füllt NUR ein leeres Feld
   (`setBuyerContact(prev => prev.trim() ? prev : stored)`); nie ein bereits
   befülltes überschreiben. Gilt für jeden async-Prefill auf einem editierbaren Feld.

26. **Ohne grünen Verify-Lauf kein „fertig".** Solange `e2e/run-verify.ps1` nicht
   komplett grün ist (Build = tsc + ESLint, dann Playwright), bleibt der Status
   **UNGETESTET/ANGEFANGEN** — nie „erledigt" melden (Lektion 8/9). Ein roter Test
   ist zuerst als möglicher echter Produktbug zu behandeln (D1: Trace/error-context
   lesen, Ursache messen), nicht als Testproblem; erst der bewiesen unschädliche
   Selektor-/Timing-Fall wird am Test angepasst, und auch dann ohne eine Assertion
   aufzuweichen.

27. **Cloud-Sandbox kann Code-Gates DOCH fahren — Prerender/E2E getrennt bewerten.**
   Lücke/Korrektur (21.07.2026, Block 12): Anders als in Cowork (Lektion 17) laufen in
   Claude-Code-on-the-web `npm ci` → `tsc --noEmit`, ESLint und der `next build`-
   Kompilier-/Typecheck-Schritt sehr wohl. Zwei Stolpersteine: (a) `npx tsc` zieht eine
   kaputte globale **TS 6.0.2** (meldet `baseUrl`-Deprecation als Error) → IMMER
   `./node_modules/.bin/tsc` (Projekt-TS) nutzen; (b) `next build` bricht am
   **Prerender/Export von „/"** ab, weil dort echte `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`
   fehlen (`@supabase/ssr: URL and API key are required`) — das ist ein **Env-, kein
   Code-Fehler**. Beweis, dass der Code prerender-sicher ist (kein Regress), ohne
   `.env.local` anzulegen: einmalig mit **Dummy-NEXT_PUBLIC-Keys** bauen → läuft komplett
   grün. → Im PR pro Gate trennen: „tsc/ESLint/Compile grün" vs. „Prerender/Playwright
   env-abhängig, UNGETESTET". Niemals `.env.local` mit erfundenen Secrets anlegen, um ein
   Gate grün zu zwingen (Lektion 8/9).

28. **`gen types` per Supabase-MCP ist der legitime Generator-Pfad, wenn CLI/Token
   fehlen.** Lücke-Prävention (Block 12): Ohne `SUPABASE_ACCESS_TOKEN`/`.env.local` im
   Sandbox ist die CLI-`gen types` nicht lauffähig — statt STOPP genügt in dieser Session
   die Supabase-MCP `generate_typescript_types` (identischer Generator, project-ref
   `lhqsuelguwfdflapzdhk`). Das ist **kein Handedit** (Lektion 11) und exakt das, was der
   Planungs-Chat sonst nachliefert. Nach dem Schreiben Diff prüfen (nur die erwarteten
   Spalten/Tabellen dürfen dazukommen).

---

## ⚙️ Tech Stack (FINAL – nicht ändern ohne Rückfrage)

```
Frontend:    Next.js 14 (App Router) + TypeScript
Styling:     Tailwind CSS + shadcn/ui
State:       Zustand
Forms:       React Hook Form + Zod
Backend:     Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
Payments:    Stripe
AI:          Claude API (claude-sonnet-4-6 · zentral in src/lib/ai.ts)
E-Mail:      Resend
Hosting:     Vercel (mit GitHub CI/CD)
```

---

## 🌍 Lokalisierung

- Sprache: Deutsch (Schweizer Stil: „Hoi", „Merci", „brucht")
- Währung: CHF (immer 2 Dezimalstellen: `CHF 12.50`)
- Zeitzone: `Europe/Zurich`
- Datumsformat: `dd.MM.yyyy` (z.B. `27.05.2026`)

---

## 📦 Umgebungsvariablen (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # NUR SERVER – nie im Frontend!

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=                  # NUR SERVER
STRIPE_WEBHOOK_SECRET=              # NUR SERVER

# Claude AI
ANTHROPIC_API_KEY=                  # NUR SERVER

# Resend
RESEND_API_KEY=                     # NUR SERVER

# App
NEXT_PUBLIC_APP_URL=https://uri-markt.vercel.app
```

---

## 📋 Aktueller Projektstatus

> Diese Sektion nach jeder abgeschlossenen Phase aktualisieren.

| Phase | Status | Beschreibung |
|---|---|---|
| Phase 1 – Fundament | ✅ Abgeschlossen | Setup, Auth, Feed-Basis, Inserat erstellen |
| Phase 2 – Kern-Features | ✅ Abgeschlossen | Deal-Flow, Gamification, FOMO, Gesuche, Profil, Notifications |
| Phase 3 – KI + Events + Wallet | ⏳ Ausstehend | Claude AI, Tickets, QR, Notifications |
| Phase 4 – Stripe + Launch | ⏳ Ausstehend | Echte Zahlungen, DSGVO, PWA, Admin |

**Legende:** ✅ Abgeschlossen · 🔄 In Arbeit · ⏳ Ausstehend · ❌ Blockiert

### Design / Aufgaben-Log

- **Aufgabe A** (30.06.2026, Commit `77976e2`): 7 Korrekturen, u.a. Taler in Rappen, zentrale KI-Modellkonstante. ✅
- **Aufgabe B** (30.06.2026): Marktplatz-/Feed-Screen exakt nach `docs/design/design-referenz.html` gebaut – Hero mit echtem Bergpanorama + Ken-Burns-Zoom, Gold-Stier-Logo, Typ-Tabs, FOMO-Streifen, animierte Inserate-Karten (Badges, Herz, Hover-Lift, Live-Zähler, Gold-Sweep), Event-Karte (Countdown, Fortschrittsbalken, Scarcity), BottomNav. Effekte = reine Optik über der Logik. Details: `docs/feed.md`. ✅ (noch nicht gepusht)
- **Bug-Session 01** (02.07.2026): 6 Bugs abgearbeitet (Auftrag `bugfix-anweisung-01.md`). BUG 1 Feed-Refresh nach Erstellen (Store `feedVersion` + `router.refresh()`). BUG 2 Gesuch-Feed – Typwerte/Filter/Render bereits konsistent, wird durch BUG-1-Fix sofort sichtbar (gegen Live-DB verifiziert). BUG 3 Header-Profil-Dropdown (`ProfileMenu`, inkl. wieder vorhandenem Abmelden). BUG 4 Bottom-Nav Profil war bereits korrekt verlinkt. BUG 5 View-Zähler-Endlosschleife behoben (Ref-Guard, real 9636 → +1/Öffnung). BUG 6 Käufer-Text „provisionsfrei" + `create_buy_intent` als **SECURITY-DEFINER-Migration** (`supabase/migrations/20260702121132_create_buy_intent.sql`) – Einheiten gegen Live-RPC verifiziert. ⚠️ Migration noch nicht eingespielt (kein Supabase-MCP in Session). Commits lokal, KEIN Push.
- **Bug-Session 03** (02.07.2026): Auth-Session-Bug (Login wirkt sofort wieder ausgeloggt) — Root Cause gefunden und behoben: `middleware.ts` lag im Projekt-Root, aber die App nutzt `src/` → Next.js hat die Middleware **stillschweigend ignoriert** (lief in keinem Request, Session wurde serverseitig nie refresht). Fix: nach `src/middleware.ts` verschoben und dabei von der veralteten `get/set/remove`-Cookie-API auf `getAll`/`setAll` umgebaut (Pflicht ab `@supabase/ssr` 0.9). `src/lib/supabase/server.ts` war bereits korrekt (`await cookies()`, `getAll`/`setAll`, alle Aufrufer mit `await`) — dort keine Änderung. Beweis: Build listet jetzt `ƒ Middleware` (vorher fehlte der Eintrag). `tsc` + `build` grün. Commit lokal, KEIN Push.
- **Autopilot 11.07.2026** (Block 0 Commit `028ea30`): DB-Types neu generiert (Drift weg),
  nullable-FK-Guards, Notifications-Schema-Konsumenten nachgezogen (Lektion 1), AUTH-DIAG raus.
  **Block 1**: kompletter beidseitiger Deal-Flow als Playwright-E2E (`e2e/deal-completion.spec.ts`)
  headless GRÜN. Dabei echten Produktbug root-cause-gefixt: Session-Verlust nach Navigation =
  Auth-Lock-Deadlock durch `await supabase.*` im onAuthStateChange-Callback + mehrere
  Browser-Client-Instanzen (Fix: setTimeout-Deferral + Singleton-Client). Siehe Lektion 10 +
  `uebergabe-2026-07-11.md`. E2E-Accounts via Admin-API angelegt (email_confirm). KEIN Push.
- **Bug-Session 02** (02.07.2026, Commit `c3d441d`): `create_buy_intent`-Migration ist laut JJ live eingespielt. BUG 2 erneut geprüft – Kauf-Flow und Gesuch-Feed durchgehend konsistent (Typwerte `Angebot`/`Gesuch`/`Event` identisch in `src/types`, Feed-Filter, Erstellung; `ListingCard` rendert Gesuche sauber). Drift beseitigt: `createBuyIntentAction` ruft die RPC jetzt **getypt** mit exakt den 3 Live-Argumenten auf (`p_listing_id`, `p_payment_method`, `p_buyer_contact`) – kein `p_buyer_id`, kein `as any`, keine Betrag/Provisions-Rechnung im Client; bei `success === false` wird `data.error` geworfen. Veraltete 4-Argument-Definition in `src/types/database.ts` von Hand auf die 3-Argument-Version korrigiert (⚠️ `gen types` ohne Access-Token/MCP nicht möglich – bei nächster Gelegenheit sauber neu generieren). `tsc` + `build` grün. Commit lokal, KEIN Push.

- **Block 12** (21.07.2026): Onboarding, FOMO-Texte & ehrliche UI — Onboarding auf
  **2 Screens** (Ken-Burns-Hero + zwei Persona-Karten; Smart-Match-Story mit „⚡ Das
  Herzstück", Geschenk-Teaser 5 Uri-Taler, persona-abhängige Gratulation, CTA „Los
  geht's" → Registrierung); Benachrichtigungs-Auswahl in die Profil-Einstellungen
  verschoben (`NotificationSettings`), Interessen-/Confetti-Screens + Fake-Pionier-Count
  entfernt. Feed-Kommentar-Badge aus `listings.comment_count` (bei 0 aus, keine eigene
  Query). Herz **ehrlich** (`favorites`): `toggleFavoriteAction` (user_id aus `auth.uid()`,
  idempotent), Herz-Zustand aus DB geladen, neuer „❤️ Favoriten"-Tab mit Status-Stickern.
  Taler-Karten-Texte + Empty-States exakt aus block-12-MD. E2E
  `e2e/block12-onboarding-ehrliche-ui.spec.ts` (Kommentar ±1 beide Trigger-Zweige, Herz
  persistent, **RLS-Leak-Beweis**, Onboarding-Screens). DB nur gelesen; Types via
  Supabase-MCP regeneriert (kein Handedit, Lektion 28). **Gate-Status:** tsc + ESLint +
  next-build-Code-Gates GRÜN (voller Build grün mit Dummy-Env bewiesen); **Playwright
  UNGETESTET** (kein `.env.local`/E2E-Konten im Sandbox → JJ via run-verify.ps1,
  Lektion 26/27). Auslieferung als **PR**. Details: `uebergabe-2026-07-21-block12.md`.
- **Block 11** (19.07.2026): Reibungsloser Deal — Prefill im Kaufformular
  (`profiles_private`, partieller Upsert), 48h-Countdown live sichtbar für alle
  (`reserved_until` + hydration-sicherer `useMinuteTick`, `src/lib/reservation.ts`)
  inkl. Feed-Realtime auf `listings`-UPDATEs, „🔄 Wieder erhältlich"-Sticker
  (`relisted_at`), Deal-Countdown in Seller/Buyer-Dashboard, 48h-Hinweis beim
  Erstellen, Entwürfe-Schnellzugriff auf `/profile`, Glocke-Typen `tx_expiring`/
  `tx_expired`. STOPP-Befund (f): Ablehnen-Flow war gebrochen (direktes
  authenticated-`UPDATE transactions` → 42501) → auf SECURITY-DEFINER-RPC
  `reject_buy_intent` umgestellt (Lektion 22). E2E `e2e/block11-deal.spec.ts`
  (8 Tests) + Buy-Modal-Selektoren aller Alt-Specs nachgezogen (Lektion 24). DB
  nur gelesen (Migrationen von JJ eingespielt). Verify-Rot → 2 Root-Cause-Fixes
  (Prefill überschrieb Eingabe = echter Bug, Lektion 25; Entwürfe-Button/Tab
  Selektor-Kollision, Lektion 24-Nachtrag). **Verify grün** (run-verify.ps1: tsc +
  ESLint + Playwright). Altformulare gelöscht. Commit `8636368` auf `main`, **KEIN
  Push**. Details: `uebergabe-2026-07-19.md`.
- **Block 9** (16.07.2026): Match-System — Edge-Function-Trigger `calculate-smart-matches`
  beidseitig (Gesuch+Angebot, fire-and-forget) statt lokalem Regel-Matcher (geloescht);
  `max_budget` im Gesuch-Insert nachgezogen; „🎯 Deine Matches" auf dem eigenen
  Gesuch-Detail; Notification-Panel: Typ `match`, Klick=is_read, Badge-Fix beim
  Initial-Load; Referenzkopie `supabase/functions/calculate-smart-matches/index.ts`
  (+ tsconfig-exclude nach ROT, Lektion 18); E2E `e2e/block9-match.spec.ts` (4 Tests
  + Cleanup) + Preflight-Login-Probe. Gates laufen bei JJ (Lektion 17). Details:
  `uebergabe-2026-07-16-block9.md`. KEIN Push.

---

## 🔄 Workflow für Claude Code

```
1. CLAUDE.md lesen (diese Datei)
2. DEVELOPMENT_GUIDELINES.md lesen
3. Relevante /docs/*.md Dateien lesen
4. Aufgabe umsetzen
5. /docs/*.md aktualisieren wenn Feature geändert/hinzugefügt
6. CLAUDE.md Projektstatus aktualisieren
```
