# Smart Match System
> Status: 🔄 In Arbeit (Basis fertig, KI-Upgrade Phase 3)
> Zuletzt aktualisiert: 28.06.2026
> Abhängigkeiten: feed, ai-features, create-listing, profile

## Übersicht
Regelbasiertes Matching zwischen Gesuchen und Angeboten. Wird nach dem Erstellen
eines Gesuchs (`createGesuchAction`) automatisch berechnet. KI-gestütztes
Matching folgt in Phase 3 (`docs/ai-features.md`).

## Scoring (Basis, ohne KI)
| Kriterium | Punkte |
|---|---|
| Kategorie passt (Pflicht-Filter) | 40 |
| Angebotspreis ≤ Max-Budget des Gesuchs | +30 |
| Gleiche Gemeinde | +30 |

Nur Treffer mit Score ≥ 60 werden in `smart_matches` gespeichert
(`upsert`, `onConflict: 'gesuch_id,matched_listing_id'`).

## Dateien
- `src/lib/smartMatch.ts` – `calculateSmartMatches(gesuchId)`
- `src/app/actions/listings.ts` – `createGesuchAction` (ruft Matching auf),
  `dismissMatchAction`
- `src/components/profile/SmartMatchList.tsx` – Anzeige im Profil
- `src/components/create/GesuchForm.tsx` – 3-Step Gesuch-Formular

## Datenbank
- Tabelle `smart_matches` (gesuch_id, matched_listing_id, user_id, score,
  dismissed, dismissed_at)
- Max-Budget eines Gesuchs liegt im Feld `listings.price`.

## Sicherheit
- RLS auf `smart_matches` über `user_id` (eigene Matches sicht-/verwerfbar).

## Bekannte Einschränkungen / TODOs
- [ ] Semantisches/KI-Matching (Embeddings, Claude) – Phase 3
- [ ] Benachrichtigung bei neuem Match (`smart_match`-Notification)
- [ ] Neuberechnung bestehender Gesuche, wenn ein passendes Angebot erscheint
