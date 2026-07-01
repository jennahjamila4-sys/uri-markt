# Profil & öffentliches Profil
> Status: ✅ Fertig
> Zuletzt aktualisiert: 28.06.2026
> Abhängigkeiten: auth-onboarding, gamification, deal-flow, smart-match

## Übersicht
Geschütztes Profil-Dashboard (eigene Daten) und öffentliches Profil (nur
öffentliche Daten). Routing über echte Next-Routen; Inserat-Detail wird per
Store-State (`selectedListingId`) als Overlay geöffnet (siehe `AppChrome`).

## Dateien
- `src/app/profile/page.tsx` – geschützte Route (redirect ohne Login), lädt
  Profil, eigene Inserate, Smart Matches, offene Verkäufe
- `src/app/profile/[username]/page.tsx` – öffentliches Profil (params = Promise,
  Next 15)
- `src/components/profile/ProfileDashboard.tsx` – Header, XP-Bar, Pioneer-Badge,
  Stats-Grid, Quick-Action-Kacheln (Matches/Inserate/Verkäufe/Einladen)
- `src/components/profile/XPBar.tsx`, `SmartMatchList.tsx`, `MyListings.tsx`
- `src/components/profile/PublicListingGrid.tsx` – aktive Inserate (öffentlich)

## Öffentlich vs. privat
- Öffentlich: Avatar, Name, @username, Level, ⭐-Bewertung, Gemeinde, aktive Inserate
- NICHT öffentlich: Telefon/E-Mail, Taler-Guthaben, Transaktionen, Strikes

## Datenbank
- `profiles`, `listings`, `smart_matches`, `transactions`
- Server-Actions: `deleteListingAction`, `dismissMatchAction`

## Sicherheit
- Profil-Route prüft `auth.getUser()` serverseitig, redirect bei fehlendem Login.
- Öffentliche Route selektiert nur unkritische Spalten.
- Löschen/Verwerfen zusätzlich über RLS (`user_id`) abgesichert.

## Bekannte Einschränkungen / TODOs
- [ ] Inserat bearbeiten (Phase 4)
- [ ] „Meine Käufe"-Ansicht (aktuell Fokus auf Verkäufer-Sicht)
- [ ] Tickets/Events/Wallet-Kacheln (Phase 3/4)
