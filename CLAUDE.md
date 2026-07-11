# CLAUDE.md — Zentrale Steuerungsdatei Uri-Markt
> ⚠️ PFLICHT: Diese Datei bei JEDEM Start einer neuen Sitzung zuerst lesen.
> Danach die referenzierten Dateien lesen die zur aktuellen Aufgabe relevant sind.

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
