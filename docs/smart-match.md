# Smart Match System
> Status: ✅ Fertig (Edge Function v2, KI-Semantik aktiv)
> Zuletzt aktualisiert: 16.07.2026 (Block 9)
> Abhängigkeiten: feed, ai-features, create-listing, profile, notifications

## Übersicht
Matching läuft vollständig in der Supabase Edge Function
`calculate-smart-matches` (deployed, Referenzkopie:
`supabase/functions/calculate-smart-matches/index.ts` — nur Referenz, Deploy
läuft über den Planungs-Chat). Sie wird nach jedem erfolgreichen Veröffentlichen
eines **Gesuchs UND eines Angebots** serverseitig aufgerufen
(`supabase.functions.invoke('calculate-smart-matches', { body: { listing_id } })`
in `createGesuchAction` / `createListingAction`). Der Aufruf ist
fire-and-forget: Fehler werden geloggt, die Veröffentlichung schlägt dadurch
nie fehl. Der alte lokale Regel-Matcher `src/lib/smartMatch.ts` ist entfernt.

## Beide Richtungen
- **Gesuch veröffentlicht** → matcht gegen aktive Angebote gleicher Kategorie
  (fremde Nutzer, max. 20 Kandidaten).
- **Angebot veröffentlicht** → matcht gegen aktive Gesuche gleicher Kategorie.
  Der Match gehört immer dem **Gesuch-Besitzer** (`smart_matches.user_id`).

## Scoring-Formel (Edge Function)
`score = round(semantic × 0.7) + Budget-Bonus + Gemeinde-Bonus` (max 100)

| Komponente | Wert |
|---|---|
| Semantik (KI, `CLAUDE_MODEL_FAST`, 0–100; Synonyme/Sprachen) | × 0.7 |
| Semantik-Fallback ohne KI: Token-Overlap (Wörter ≥ 4 Zeichen) | 50 + min(shared×8, 30), sonst 35 |
| Preis ≤ max_budget | +20 |
| Preis ≤ 2 × max_budget | +10 |
| Budget oder Preis unbekannt | +10 |
| Gleiche Gemeinde | +10 |

Schwellen: gespeichert ab **40** (`STORE_MIN`), Notification ab **50**
(`NOTIFY_MIN`), „Perfekter Match" ab **75** (`STRONG_MIN`).

## Dedupe-Regel
`upsert` mit `onConflict: 'gesuch_id,matched_listing_id'`. Die Notification
(Typ **`match`**, via RPC `send_notification`, `listing_id` = Angebot) wird nur
beim **ersten Auftreten** eines Paars gesendet (Vorab-Check auf bestehende
Zeile); ein erneuter Lauf aktualisiert nur den Score.

Wichtig: `createGesuchAction` schreibt das Budget in `price` **und**
`max_budget` — die Edge Function liest `max_budget`.

## Dateien
- `supabase/functions/calculate-smart-matches/index.ts` – Referenzkopie der deployten v2
- `src/app/actions/listings.ts` – `triggerSmartMatches` (Invoke in beiden
  Create-Actions), `dismissMatchAction`
- `src/components/listing/GesuchMatches.tsx` – „🎯 Deine Matches" auf dem
  Detail des eigenen Gesuchs (Score-Badge, Ausblenden, Leerzustand)
- `src/components/profile/SmartMatchList.tsx` – Anzeige im Profil
- `src/components/create/GesuchForm.tsx` – 3-Step Gesuch-Formular

## Datenbank
- Tabelle `smart_matches` (id, gesuch_id, matched_listing_id, user_id, score,
  dismissed, created_at). Grants authenticated: **SELECT + UPDATE (own-only via
  RLS)**, kein INSERT/DELETE — schreiben tut nur die Edge Function
  (Service-Role).

## Sicherheit
- RLS auf `smart_matches` über `user_id`; UI rendert die Match-Sektion nur für
  den Gesuch-Besitzer (Render-Guard + RLS).
- Edge Function hat `verify_jwt` aktiv → Invoke braucht den User-JWT
  (Server-Client des eingeloggten Users).

## E2E
`e2e/block9-match.spec.ts`: Gesuch→Angebot, Angebot→Gesuch,
Ausblenden-Persistenz, tx_pending-Sichtbarkeit; Cleanup entfernt alle
`E2E-B9`-Testdaten (smart_matches, notifications, transactions, listings).
