# Uebergabe 16.07.2026 — Block 9 (Match-System: Trigger + UI)

> Ersetzt aeltere Uebergabe-Dateien. Naechste Session: zuerst CLAUDE.md, dann diese Datei.

## BEWIESEN

- **Schritt-0-Befund (D1):** (a) `functions.invoke` existierte nirgends — stattdessen rief
  `createGesuchAction` einen lokalen Regel-Matcher `src/lib/smartMatch.ts` auf (direkter
  `upsert` auf `smart_matches`, der mangels INSERT-Grant still scheiterte). Angebot-Erstellung
  triggerte gar nichts. (b) Notification-UI existierte (Glocke + Panel + Realtime).
  (c) Match-Anzeige nur global im Profil, nicht auf dem Gesuch-Detail.
- **Trigger:** `triggerSmartMatches()` in `src/app/actions/listings.ts` ruft die Edge
  Function `calculate-smart-matches` nach dem Veroeffentlichen von Gesuch UND Angebot auf
  (User-JWT-Server-Client, fire-and-forget: Fehler nur `console.error`, Veroeffentlichung
  schlaegt nie fehl). `src/lib/smartMatch.ts` geloescht (Root-Cause-Ersatz, kein Workaround).
- **Querverbindung (Lektion 1):** `createGesuchAction` schrieb das Budget nur in `price`;
  die Edge Function liest `max_budget` → Insert setzt jetzt beide.
- **Match-UI:** `src/components/listing/GesuchMatches.tsx` — „🎯 Deine Matches" im
  Gesuch-Detail, nur fuer den Owner (Render-Guard + RLS). Score-Badge Gold („X% Match"),
  Klick oeffnet Angebot, „Ausblenden" optimistisch mit sichtbarem Rollback bei Fehler
  (Lektion 6), Ladefehler wird gemeldet statt als „keine Matches" getarnt (Lektion 7).
  Leerzustand gemaess Auftrag.
- **Notifications:** Panel kennt jetzt Typ `match` (🎯); Klick auf Eintrag setzt
  `is_read=true` (DB + Store) und navigiert zum Listing. Bugfix: `setNotifications`
  setzte `unreadCount` nie → Badge blieb nach Reload faelschlich 0; jetzt = Anzahl
  ungelesener beim Initial-Load.
- **Referenzkopie:** `supabase/functions/calculate-smart-matches/index.ts` — byte-identisch
  zur deployten v2 (diff-geprueft). NICHT deployed, DB nicht angefasst.
- **Preflight (Lektion 14):** `e2e/preflight.ts` probt zusaetzlich den echten Login beider
  E2E-Konten (Auth-Token-Request) und stoppt mit Behebungsanweisung.
- **Docs:** `docs/smart-match.md` neu (Scoring-Formel, beide Richtungen, Dedupe-Regel,
  Schwellen 40/50/75); `docs/database-schema.md` um Grant-Stand `smart_matches`
  (authenticated: SELECT + UPDATE own-only, kein INSERT/DELETE) ergaenzt.

## UNGETESTET

- **`npx tsc --noEmit` und `npx eslint`:** in dieser Cowork-Session NICHT
  ausfuehrbar (Sandbox: 45s-Prozesslimit, kein persistenter Prozess — siehe neue
  Lektion 17 in CLAUDE.md). `npm run build` in JJs Verify prueft Types + ESLint
  mit. **Darum wurde NICHT committet** (Gate „tsc+eslint gruen vor Commit" nicht
  belegbar): JJ laesst Verify laufen; committen erst nach GRUEN.

- **E2E `e2e/block9-match.spec.ts`** (4 Tests, serial, Cleanup aller `E2E-B9`-Daten
  inkl. smart_matches/notifications/transactions vor UND nach dem Lauf):
  1. Gesuch findet bestehendes Angebot → Match-Karte + match-Notification bei B
  2. Neues Angebot findet bestehendes Gesuch → neue Notification + Match bei B
  3. Ausblenden → Karte weg, bleibt nach Reload weg
  4. Kaufanfrage → tx_pending in As Glocke
  Der Lauf braucht `npm run build` + Playwright auf JJs Maschine (Verify) — in dieser
  Session nicht ausfuehrbar. **Kein „selbst getestet"-Status, bis der Lauf gruen ist
  (Lektion 8).**

## ANGEFANGEN

- nichts.

## NAECHSTER SCHRITT

1. JJ: `e2e/run-verify.ps1` (Build prueft Types+ESLint, dann Playwright inkl.
   block9-match.spec.ts).
2. Nach GRUEN: Commit (Message-Vorschlag: `Block 9: Match-System — Edge-Function-Trigger
   beidseitig, Gesuch-Detail-Matches, Notification-Fixes, E2E`). KEIN Push ohne JJ-OK.
