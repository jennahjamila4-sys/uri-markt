# Uri-Markt — Übergabe 03.07.2026 (Auth-Bug: Wurzel gefunden & DB-Fix eingespielt)

> Kontext: JJ ist nicht-technisch, testet nur Ergebnisse. Root-Cause statt Workaround.
> Live-DB = Wahrheit. Kein Push ohne ausdrückliches OK.

---

## 1. WAS BEHOBEN WURDE (eingespielt, aber NOCH UNGETESTET)

**Wurzel des „nach Login wieder ausgeloggt"-Bugs — endgültig bewiesen:**
Der Tabelle `public.profiles` fehlten die **Tabellen-GRANTs** für die Rollen `anon` und
`authenticated`. Nur `service_role` hatte Rechte. Jede Profil-Abfrage eines eingeloggten
Users endete darum in **`42501 permission denied for table profiles`**.

- Das ist **kein** RLS-Problem (RLS auf `profiles` ist aktiv und korrekt: Policies
  `profiles_select_all [SELECT]` und `profiles_update_own [UPDATE]`).
- Es ist **kein** Cookie-/Session-Problem: Live-Messung hat bewiesen, dass Browser UND
  Server nach dem Login denselben User sehen (ID `b28becb3-…-856ac5995c37`).
- Es ist die Ebene UNTER RLS: ohne GRANT wird die Query abgewiesen, bevor RLS greift.
- `listings` hatte die Grants (darum lief der Feed) — `profiles` nicht.

**Eingespielter Fix (via Supabase Management API, project `lhqsuelguwfdflapzdhk`):**
```sql
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT UPDATE ON public.profiles TO authenticated;
```
**Verifiziert nach dem Einspielen:** `anon` → `SELECT`, `authenticated` → `SELECT, UPDATE`.
Additiv, nichts entzogen, RLS bleibt scharf (begrenzt UPDATE weiter auf die eigene Zeile).
Kein INSERT/DELETE-Grant (keine solchen Policies; Signup läuft über SECURITY-DEFINER-Trigger).

⚠️ **STATUS: eingespielt, aber von JJ noch NICHT in der App getestet.**

---

## 2. TEST-SCHRITTE FÜR MORGEN (zuerst!)

Dev-Server starten (`npm run dev`), dann:

**A) Debug-Panel-Check (beweist die DB-Ebene):**
1. `http://localhost:3000/?debug=1` öffnen und einloggen.
2. Warten bis „Messung #" hochzählt (misst live nach dem Login).
3. Erwartet:
   - **Zeile 3** `Profil-Abfrage (16 Spalten): Profil OK: Zeile geladen`  (vorher: `PROFIL-FEHLER: 42501 …`)
   - **Zeile 4** `Store user: <dein Username>`  (vorher: `NULL`)

**B) Die 5 Klick-Tests (das eigentliche Verhalten):**
1. **Header oben rechts** → Profil-Icon/Menü statt „Anmelden".
2. **„+" (Inserat erstellen)** → Angebot-Formular öffnet sich (nicht „bitte anmelden").
3. **„+" → Gesuch** → Gesuch-Formular öffnet sich ebenfalls.
4. **„Profil" unten** → Dashboard öffnet sich (kein schwarzer Screen, kein Rücksprung zum Feed).
5. **„Kaufen" auf einem Inserat** → funktioniert (nicht „bitte anmelden").

Wenn A + B grün sind: Bug bestätigt behoben → weiter mit Punkt 3 (Aufräumen).
Falls etwas hakt: es ist dann NICHT mehr die DB-Berechtigung (die ist bewiesen ok) —
gezielt an der betroffenen Stelle weiter diagnostizieren.

---

## 3. AUFRÄUMLISTE (Diagnose-Instrumente entfernen — erst NACH erfolgreichem Test)

Diese temporären Sachen wurden für die Diagnose angelegt und müssen weg:

1. **`src/app/api/whoami/route.ts`** — komplette Datei löschen.
2. **`src/components/layout/AuthDebugPanel.tsx`** — komplette Datei löschen.
3. **`src/components/layout/AppChrome.tsx`** — die zwei Zeilen entfernen:
   - `import { AuthDebugPanel } from '@/components/layout/AuthDebugPanel'`
   - `<AuthDebugPanel />` (im Return, nach `<OnboardingFlow />`)
4. **`src/hooks/useAuth.ts`** — alle mit `// TEMP-DIAGNOSE` markierten `console.error`
   wieder entfernen (3 Stellen) und die dafür eingeführten `error`-Destrukturierungen
   auf den Originalzustand zurückbauen (vorher wurde nur `{ data }` genutzt).
5. **`.git/q.json`** — temporäre SQL-Query-Datei löschen (wurde ggf. schon entfernt).

---

## 4. NACH DEM AUFRÄUMEN

1. `npx tsc --noEmit`
2. `npm run build`
3. Committen (aussagekräftige Message, z.B. „fix: profiles-GRANTs für anon/authenticated
   (42501 behoben) + Diagnose-Instrumente entfernt").
4. **KEIN `git push`** ohne ausdrückliches OK von JJ.

---

## 5. AKTUELLER WORKING-TREE-STAND (uncommitted)

- `src/middleware.ts` (neu) + gelöschtes Root-`middleware.ts` sind bereits committet
  (`7955157`, KEIN Push) — Middleware lief vorher nie, weil sie im Root statt in `src/` lag.
  War ein nötiger, aber nicht der ausreichende Fix.
- Uncommitted im Working Tree: die Diagnose-Instrumente aus Punkt 3
  (`whoami/route.ts`, `AuthDebugPanel.tsx`, AppChrome-Zeilen, `useAuth.ts` TEMP-Logs).
- Der DB-GRANT-Fix ist NICHT im Code — er lebt in der Live-DB. Für Reproduzierbarkeit
  ggf. später als Migration in `supabase/migrations/` nachziehen.
