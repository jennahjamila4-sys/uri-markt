# Uri-Markt — Übergabe für neuen Chat (Stand 02.07.2026, abends)

> Ziel dieser Datei: Eine neue Chat-Session ohne Missverständnisse starten.
> JJ ist nicht-technisch, liest keinen Code, testet nur Ergebnisse. Human-in-the-Loop.
> Grundregel: **Root-Cause statt Workaround. Live-DB = Wahrheit, nicht die Plan-Dateien. Kein Push ohne ausdrückliches OK.**

---

## 0. WAS DAS ENDZIEL IST
Voll funktionsfähige App (Frontend + Backend). JJ will testbare, funktionierende Ergebnisse — keine Code-Reviews, keine halben Fixes, nichts kaputtmachen was schon läuft.

---

## 1. DER AKTUELLE HAUPT-BUG (höchste Priorität)

**Symptom (von JJ live getestet, lokal via `npm run dev`):**
- Login funktioniert: nach Anmelden lädt es kurz und zeigt "Willkommen".
- ABER direkt danach verhält sich die App wie ausgeloggt:
  - Header oben rechts zeigt weiter **"Anmelden"** statt Profil-Icon/Dropdown (war "BUG 3")
  - Klick auf **"Profil"** unten → springt zum Feed zurück, öffnet nicht (war "BUG 4")
  - Klick auf **"+"** (Inserat erstellen) → zeigt "bitte anmelden" statt Formular (war "BUG 1")
  - Klick auf **"Kaufen"** → zeigt "bitte anmelden"
- Das sind NICHT vier Bugs, sondern **EIN Auth-Fehler mit vier Symptomen**: Der eingeloggte Zustand wird serverseitig nicht erkannt.

**WAS BEREITS PER LIVE-DB VERIFIZIERT WURDE (Supabase MCP, project `lhqsuelguwfdflapzdhk`) — nicht erneut prüfen, ist bestätigt:**
1. Es gibt **2 auth.users** und **2 passende profiles-Zeilen**. → Profile existieren.
2. Die **IDs sind korrekt gekoppelt** (`profiles.id = auth.users.id`, ids_match = true bei beiden).
   → Die Vermutung "profiles.id via gen_random_uuid() entkoppelt" ist **WIDERLEGT**.
3. RLS auf `profiles`: Policy `profiles_select_all` mit `USING (true)` → **jeder darf Profile lesen**.
   → Die Vermutung "RLS blockiert das eigene Profil" ist **WIDERLEGT**.

**DARAUS FOLGT DIE WAHRSCHEINLICHE URSACHE (noch im Code zu bestätigen):**
Die Daten sind sauber und lesbar — trotzdem sieht der Server die Session nicht.
→ **Serverseitiges Session-/Cookie-Problem.** Verdächtig ist der Next.js-15-Punkt:
`cookies()` muss `await`-et werden und `createServerClient` muss die `getAll/setAll`-Cookie-API
async nutzen. Laut früherem Projektstand war genau dieser "Auth async fix" mal als
*uncommitted* markiert — es ist unklar, ob er im aktuellen Code wirklich drin ist.

**WICHTIG:** Diese letzte Ursache ist eine begründete Hypothese, **nicht** bewiesen.
Die neue Session muss sie im Code bestätigen, BEVOR sie etwas ändert. Nicht raten.

---

## 2. WAS HEUTE SCHON ERLEDIGT & COMMITTET WURDE (lokal, KEIN Push)
Zwei unpushte Commits auf `main`:
- `c3d441d` — fix: `create_buy_intent` auf 3-Argument-Live-Signatur
  (RPC-Aufruf in `createBuyIntentAction` nutzt jetzt exakt die 3 Live-Argumente
  `p_listing_id, p_payment_method, p_buyer_contact`; kein `p_buyer_id`, keine
  Betrag/Provisions-Rechnung mehr im Client — kommt aus der SECURITY-DEFINER-Funktion).
- `48d9f2b` — docs: Projektstatus in CLAUDE.md protokolliert

**Verifiziert per Live-DB:**
- `create_buy_intent(p_listing_id uuid, p_payment_method text, p_buyer_contact text)` → jsonb, SECURITY DEFINER, existiert live und ist korrekt.
- `process_transaction_commission(p_transaction_id uuid, p_seller_id uuid)` → jsonb, SECURITY DEFINER.
- `send_notification(p_recipient_id uuid, p_title text, p_message text, p_type text, p_listing_id uuid)` → void.
- Provision rechnet korrekt: CHF 100 Verkauf → 10 Taler beim Verkäufer.

**Offener Technik-Schuldpunkt:** `src/types/database.ts` wurde HEUTE **von Hand** gepatcht
(alte 4-Arg-Definition von `create_buy_intent` → 3-Arg), weil `npx supabase gen types`
ohne Access-Token/MCP-Login nicht lief. Sobald ein Token/MCP in Claude Code verfügbar ist,
sollte `database.ts` einmal **sauber neu generiert** werden, damit es 1:1 zur Live-DB passt.

---

## 3. WEITERE BEOBACHTUNGEN VON HEUTE (nachrangig, NACH dem Auth-Fix)
- **Inserate doppelt im Feed:** Nach den heutigen Änderungen erscheint jedes Inserat 2×.
  Vermutlich Feed-Query/Nachlade- oder Dedupe-Problem. Muss geprüft werden.
- **BUG 5 (View-Zähler):** erledigt — zählt jetzt echte Views (kein Endlos-Hochzählen mehr).
- **BUG 2 (Gesuch im Feed):** erledigt & live bestätigt — Gesuch "Kinderkleider" (type='Gesuch',
  status='active', category 'kleider', Realp) erscheint korrekt im Gesuche-Tab.

---

## 4. GEWÜNSCHTES DESIGN-REDESIGN (späterer, BEWUSSTER Schritt — kein Bug!)
Onboarding-Reihenfolge soll geändert werden (nicht jetzt, erst wenn App stabil läuft):
- Screen "Was interessiert dich?" (viele Kategorien) kommt aktuell zu früh und ist zu granular.
- Gewünscht: **ZUERST** die Vorteile der App zeigen (FOMO, verkaufspsychologisch stark,
  für Firmen UND Privatpersonen sofort sichtbarer Nutzen).
- **DANACH** eine stark vereinfachte Auswahl mit nur wenigen Optionen, z. B.:
  "Ich will loswerden" · "Ich suche" · "Ich bin Planer".
Das ist eine bewusste UX-Änderung, kein Fehler. NICHT mit dem Auth-Fix vermischen.

---

## 5. ARBEITSREGELN (verbindlich)
- **Nichts kaputtmachen, was schon läuft.** Erst Ursache verstehen, dann fixen.
- **Root-Cause, keine Workarounds.** Kein "CSS-Verstecken", keine Client-seitigen Hacks.
- **Live-DB ist die Wahrheit**, nicht die Phase-Plan-Dateien (die sind teils veraltet).
- **DB-Prüfungen/-Änderungen laufen über die Supabase-MCP im CHAT** (project `lhqsuelguwfdflapzdhk`),
  nicht über Claude Code (der hat in der Session keinen DB-Zugang).
- **Human-in-the-Loop:** Jeder Schreib-Schritt einzeln bestätigen. Reads und `npx tsc --noEmit`
  dürfen durchlaufen.
- **KEIN `git push`** ohne ausdrückliches OK von JJ.
- Bei Terminal-Nachfrage "and don't ask again for: git *" → NICHT wählen (schützt vor ungewolltem Push).
- **Umgebung:** Windows PowerShell. Keine Pipe-/find-Kommandos (timeouten). Lange Instruktionen als .md speichern und lesen lassen.

---

## 6. STACK & PFADE
- Next.js 15 (App Router) · Supabase (EU Paris, project `lhqsuelguwfdflapzdhk`) · Stripe · Claude API · Vercel
- Repo: `jennahjamila4-sys/uri-markt` · lokal: `C:\Users\El Hamd\uri-markt`
- Kommunikation auf Deutsch.
- Dev-Server lokal: `npm run dev` (Port wird in der Ausgabe angezeigt, meist http://localhost:3000).

---

## 7. EXAKTE REIHENFOLGE FÜR DIE NEUE SESSION
1. **Auth-Session-Bug fixen** (Abschnitt 1) — Ursache im Code bestätigen, dann fixen, dann JJ testen lassen.
2. **Inserate-Doppelanzeige** (Abschnitt 3) prüfen und beheben.
3. **Kauf-Flow end-to-end** testen (Kaufen → reserviert → Verkäufer-Notification → bestätigen → 10 Taler ab).
4. Erst wenn alles läuft: **Push** (nur auf JJ-OK).
5. Danach Onboarding-Redesign (Abschnitt 4).
6. Vor Phase 3: `database.ts` sauber neu generieren (Abschnitt 2).
