# Gamification
> Status: ✅ Fertig
> Zuletzt aktualisiert: 28.06.2026
> Abhängigkeiten: auth-onboarding

## Übersicht
XP-System mit 5 Levels, XP-Toast bei Zuwachs und Fullscreen-Level-Up-Modal
(reine CSS-Konfetti, keine Library). XP wird ausschliesslich serverseitig und
idempotent via RPC `award_xp` vergeben.

## XP-Vergabe (Server, idempotent)
| Aktion | XP | Idempotency-Key |
|---|---|---|
| Angebot erstellt | 10 | `listing_created_{id}` |
| Gesuch erstellt | 10 | `gesuch_created_{id}` |
| Kauf abgeschlossen | 10 | `listing_bought_{txId}` |
| Verkauf abgeschlossen | 50 | `listing_sold_{txId}` |
| Bewertung abgegeben | 5 | `review_given_{txId}` |
| Kommentar | 5 | `comment_{listingId}_{userId}_{ts}` |

## Level (Single Source of Truth: `src/lib/levels.ts`)
| Level | Emoji | XP |
|---|---|---|
| Beobachter | 👁️ | 0–49 |
| Dorf-Händler | 🥉 | 50–199 |
| Lokal-Matador | 🥈 | 200–499 |
| Kantons-Legende | 🥇 | 500–999 |
| Gotthard-Titan | 💎 | 1000+ |

## Dateien
- `src/lib/levels.ts` – `XP_LEVELS`, `getLevelProgress()`, `levelEmoji()`
- `src/hooks/useXPWatcher.ts` – beobachtet XP/Level (Store), löst Toast/Modal aus
- `src/components/gamification/XPToast.tsx` – Gold-Münze + Fortschrittsbalken
- `src/components/gamification/LevelUpModal.tsx` – Konfetti-Overlay (Store-State `levelUp`)
- `src/components/gamification/LevelBadge.tsx` – wiederverwendbares Level-Badge
- `src/components/profile/XPBar.tsx` – Fortschrittsbalken im Profil
- Konfetti-Keyframes: `src/app/globals.css` (`.confetti-piece` / `confetti-fall`)

## Datenbank
- `profiles.xp_points`, `profiles.level` (von DB-Trigger/`calculate_level` gesetzt)
- `xp_log` (idempotency_key UNIQUE), RPC `award_xp`, `calculate_level`

## Sicherheit
- XP niemals vom Client – nur via RPC `award_xp` mit Idempotenz-Key.

## Bekannte Einschränkungen / TODOs
- [ ] Badges/Achievements über Level hinaus (Phase 3+)
