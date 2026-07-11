# Listings verwalten (Bearbeiten / Deaktivieren / Löschen)
> Status: 🔄 In Arbeit (Block 3 — implementiert, wartet auf JJ-Verify)
> Zuletzt aktualisiert: 11.07.2026
> Abhängigkeiten: Deal-Flow (Status-Maschine), Feed

## Übersicht
Der Besitzer verwaltet eigene Inserate unter Profil → „Meine Inserate":
bearbeiten, deaktivieren/reaktivieren, löschen. Alle Aktionen sind am
Listing-Status gesperrt, sobald ein Deal läuft oder abgeschlossen ist.

## Status-Maschine (an der Live-DB verifiziert)
`active` → (Kauf, `create_buy_intent`) `reserved` → (beidseitiger Abschluss,
`complete_transaction`) `sold`. Zusätzlich Nutzer-Aktion: `active` ⇄ `cancelled`
(deaktiviert). Es gibt KEINEN CHECK-Constraint auf `status`; `cancelled` ist Teil
der App-Union `ListingStatus`.

Konsumenten des Status:
- Feed (`app/page.tsx`): zeigt nur `active` + `reserved`.
- Öffentliches Profil (`app/profile/[username]`): zeigt nur `active`.
- `create_buy_intent` (RPC): kauft nur bei `active` → deaktivierte/verkaufte nicht kaufbar.

## Regeln (Block 3)
| Aktion | Erlaubt bei | Gesperrt bei | Grund sichtbar (Lektion 6) |
|---|---|---|---|
| Bearbeiten | active, cancelled | reserved, sold | ja |
| Deaktivieren | active | reserved, sold | ja |
| Reaktivieren | cancelled | – | – |
| Löschen | active, cancelled | reserved (laufender Deal), sold (Nachweis) | ja |

Alle Schreibpfade sind **atomar status-gesichert** (Status-Filter im UPDATE/DELETE,
kein Read-then-Write-Race). Trifft der Schreibversuch 0 Zeilen, wird der aktuelle
Status frisch gelesen und eine präzise Begründung geworfen.

## Dateien
- `app/actions/listings.ts` — `updateListingAction`, `setListingActiveAction`,
  `deleteListingAction` (gehärtet), Helper `explainBlockedListingAction`.
- `components/profile/MyListings.tsx` — Tabs (Aktiv/Reserviert/Verkauft/Deaktiviert),
  pro Zeile Bearbeiten / Deaktivieren·Reaktivieren / Löschen (mit Bestätigung) +
  sichtbarer Sperr-Grund.
- `components/profile/EditListingModal.tsx` — typ-abhängiges Edit-Formular
  (Angebot/Gesuch), Foto-Tausch, sichtbare Feldfehler; nutzt `AngebotSchema`/`GesuchSchema`.
- `components/listing/DealFlow.tsx` — deaktiviertes Inserat zeigt „nicht verfügbar"
  statt Kaufen-Button.

## Sicherheit / RLS
- `listings_update_own` / `listings_delete_own`: nur Besitzer (auth.uid() = user_id).
- Actions setzen NIE `user_id`/`status`(bei Edit)/`type`/`created_at` aus Client-Daten.
- `updated_at` wird DB-seitig vom Trigger `set_fomo_on_sold` (BEFORE UPDATE) gesetzt.

## Tests
- `e2e/block3-manage.spec.ts`: Bearbeiten (UI+DB), Deaktivieren→Reaktivieren
  (+ Feed-Ausschluss), Löschen mit Bestätigung (UI+DB), Reserviert-Sperre mit Grund.
  Self-contained, Seed/Cleanup via Service-Role (`E2E-BLOCK3%`).

## Bekannte Einschränkungen / TODOs
- [ ] **Favoriten**: keine `favorites`-Tabelle vorhanden. DB-gestützte Favoriten =
  eigene Migration (Tabelle + RLS + UI + E2E) → NICHT trivial, bewusst als eigener
  Block ausgelagert (Startnachricht: „falls trivial, sonst notieren"). Der Herz-Button
  in `ListingDetail` ist derzeit rein optisch.
- [ ] Event-Typ ist Phase 2 (Erstellen deaktiviert) → kein Edit-Formular nötig.
