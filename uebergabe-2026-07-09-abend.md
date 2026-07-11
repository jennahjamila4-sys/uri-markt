# Übergabe 09.07.2026 (Abend) — Session-Abbruch wegen Credits

**Regel für diese Session:** Kurze, kompakte Arbeitsweise. Session nach jedem abgeschlossenen Block (Commit + JJ-Test grün) BEENDEN und neu starten. Kein Opus, Standard-Modell reicht. CLAUDE.md ## Lektionen zuerst lesen.

---

## ✅ BEWIESEN & ABGESCHLOSSEN (nicht erneut prüfen)

### Auth-Blocker behoben (Commit e6fd028)
- Root Cause gemessen, nicht geraten: DB war sauber (Grants, RLS, 3 User = 3 Profile, 0 unbestätigt — vom Planungs-Chat live verifiziert).
- [AUTH-DIAG]-Messung im Browser: getUser hasUser=true, profiles.single() HTTP 200, error null. Login funktioniert, F5 hält Session, /profile unangemeldet → 307 Redirect. **JJ hat Login bestätigt.**
- Gemeinde-Pflichtfeld-Bug: weg (JJ bestätigt).
- Notifications-400-Bug: Tabelle `notifications` hat exakt: id, recipient_id, type, is_read, created_at, title, message, listing_id. Query wurde korrigiert.
- ⚠️ Falls [AUTH-DIAG]-Diagnose-Logs noch im Code: beim nächsten Commit entfernen (D5).

### Beidseitiger Deal-Abschluss (DB fertig migriert + Frontend committed)
**DB (vom Planungs-Chat migriert + D2-verifiziert — NICHT anfassen):**
- `transactions` neu: `buyer_completed_at`, `seller_completed_at` (timestamptz).
- `complete_transaction(p_transaction_id uuid)` — NUR 1 Argument. Alte 2-Arg-Version existiert nicht mehr (PGRST202 bewiesen). Rolle via auth.uid(), idempotent, row-locked. Erst wenn BEIDE bestätigt: status='completed', Listing 'sold', XP atomar in der RPC (Verkäufer +50 / Käufer +10, idempotent), Notifications an beide. Return: {success, status, buyer_completed, seller_completed, buyer_id, listing_id}. Nur `authenticated`.
- `get_transaction_contact`: bei 'completed' → {success:true, status:'completed'} OHNE Kontakte (Zustand, kein Fehler — Lektion 7); bei 'confirmed' → Kontakte + beide completed-Flags.
- XP/Notifications NICHT mehr im App-Code für den Abschluss (aus completeTransactionAction entfernt — so lassen).

**Frontend (committed, tsc+build 0 Errors):**
- Käufer- UND Verkäufer-Ansicht rendern strikt nach Status: confirmed+nicht selbst bestätigt → Kontakt + „Übergabe bestätigen"; confirmed+selbst bestätigt → „Wartet auf Gegenseite" (Kontakt bleibt); completed → Kontakt weg, „Abgeschlossen" + Bewertung.
- Bewertung: Insert mit transaction_id, eine pro Nutzer+Transaktion, +5 XP idempotent (review_<tx>_<reviewer>), Button-Ausblendung, Beteiligten-Check.
- database.ts von Hand nachgezogen (buyer/seller_completed_at, reviews.transaction_id, complete_transaction-Signatur).

## ⏳ UNGETESTET (ehrlich: kein Browser-E2E gelaufen)
Der komplette Deal-Flow ist NICHT im Browser durchgeklickt. JJ-Testliste offen:
1. A kauft bei B, B bestätigt → beide sehen Kontakt
2. A „Übergabe bestätigen" → „Wartet auf Gegenseite", Kontakt bleibt
3. B bestätigt → beide: Kontakt weg, „Abgeschlossen", XP sichtbar
4. Beide bewerten genau 1×, zweiter Versuch abgelehnt
5. Jeder Fehler als Toast, F5 hält Zustand

## 🔄 ANGEFANGEN: E2E-Playwright-Setup (pausiert bei Credit-Stopp)
- `e2e/setup-users.mjs` geschrieben (legt 2 Test-Accounts via echtem Signup an, Credentials → .env.local als E2E_USER_A/B_EMAIL/PASSWORD, nie geloggt, idempotent, Exit 2 + „NEEDS_EMAIL_CONFIRMATION" falls E-Mail-Bestätigung blockt → dann STOPP und an JJ für Planungs-Chat: der bestätigt per DB-Update).
- Status: Skript-Lauf wurde durch Credit-Ende unterbrochen — **unbekannt ob Accounts angelegt wurden.** Erster Schritt: `node e2e/setup-users.mjs` erneut (idempotent), SETUP EXIT prüfen.
- Danach: `e2e/deal-completion.spec.ts` (Playwright, chromium, headless): A erstellt GRATIS-Listing „E2E-TEST bitte ignorieren" (Gratis → Provision 0, kein Taler nötig) → kompletter Flow aus JJ-Testliste oben → Test-Listing am Ende löschen. Grün = „selbst getestet, funktioniert" (Lektion 8).
- Playwright ggf. noch nicht installiert: `npm i -D @playwright/test` + `npx playwright install chromium`.

## 📋 DANACH (Reihenfolge, mit Planungs-Chat abgestimmt)
1. E2E grün + JJ-Sichttest Deal-Flow → Block fertig, Diagnose-Logs raus, Commit. **Session beenden.**
2. Öffentliche Bewertungs-Anzeige (Profil/Listing) — reines Frontend.
3. 48h-Reservierungs-Auto-Expiry — **macht der Planungs-Chat per Migration**, nicht Claude Code.
4. Listing bearbeiten. 5. Stripe-Taler-Kauf (Block 9). 6. Rechtsseiten + comments-Tabelle + 5-Taler-Start. 7. Vercel-Deploy-Config.

## ⚠️ Offene Punkte / Schulden
- `npx supabase gen types` einmal mit SUPABASE_ACCESS_TOKEN aus .env.local laufen lassen (database.ts ist 2× von Hand nachgezogen — Drift-Risiko).
- [AUTH-DIAG]-Logs entfernen (falls noch drin).
- Ungeklärt seit 02.07.: welcher Migrationsschritt damals die GRANTs entfernte (nur relevant vor neuen Migrationen — Migrationen macht ohnehin nur der Planungs-Chat).

## Arbeitsteilung (unverändert)
- DB-Migrationen: NUR Planungs-Chat (Supabase MCP). Claude Code fasst die DB nicht an.
- Kein git push ohne JJ-OK. D1–D5 immer. Lektionen 1–8 in CLAUDE.md gelten.
