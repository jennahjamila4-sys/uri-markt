# Uebergabe 16.07.2026 — Block 8 abgeschlossen (Deploy LIVE)

> Ersetzt alle aelteren Uebergabe-Dateien. Naechste Session: zuerst CLAUDE.md, dann diese Datei.

## BEWIESEN (Stand heute)

- **App live auf https://uri-markt-gamma.vercel.app** — Deploy-Script `deploy/deploy-vercel.ps1` GRUEN durchgelaufen (Log: `deploy/_deploy.log`).
- Env-Vars (Supabase, Stripe, APP_URL) via Script nach Vercel Production gesynct.
- Stripe-Prod-Webhook aktiv (checkout.session.completed auf Live-Domain, Endpoint-Secret in Vercel).
- Supabase-Auth-URLs gesetzt (Site URL + Redirect /auth/callback).
- Taler-Kauf idempotent auf Live-Domain getestet (JJ: Smoke-Test 5/5 + Taler-Testkauf gruen).
- Deploy-Zyklen (D5): Zyklus 1 ROT = `vercel link` wollte Projekt neu anlegen (409) -> Fix `cbb6646` (nur bestehendes Projekt verlinken, Lektion 16). Zyklus 2 Haenger = interaktiver Prompt bei gecapturetem `vercel env add` -> Fix `72895b7` (alle vercel-Aufrufe non-interaktiv: `env add --force` per stdin statt rm+add, `--prod --yes`; Lektion-15-Ergaenzung).
- Commits Block 8: `710479d`, `cbb6646`, `72895b7` (+ dieser Abschluss-Commit). KEIN Push bisher.

## OFFEN

- Anwaltliche AGB-Pruefung vor Echtgeld (JJ).
- Vercel Pro vor Go-Live (JJ).
- Consent-Persistierung (optional).
- Aus mvp-masterplan.md weiterhin offen: Foto-Upload-E2E, Status-Sticker-Assertion, 48h-Auto-Expiry, Favoriten-Block, Guthaben-Check + Nicht-negativ-Constraint, rk_-Key-Haertung, Kommentar-Zaehler (Block 9).
- JJ-Featureliste APP_TEST -> Planung Block 9+ durch Planungs-Chat: Onboarding-Umbau, Smart-Formulare V33, Entwurf-Speichern, Match-System mit Benachrichtigungen, Kaeuferdaten aus Profil vorbefuellen, Reserviert-Benachrichtigung.

## NAECHSTER SCHRITT

Block-9-Planung im Planungs-Chat (Featureliste APP_TEST priorisieren + offene Masterplan-Punkte einordnen).
