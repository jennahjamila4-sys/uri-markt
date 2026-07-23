# BLOCK 13 — GO-LIVE-HÄRTUNG (Plan v1, 23.07.2026)

> Letzter Block vor Echtgeld. Planungs-Chat hat D1 + Migration + D2 bereits erledigt (Abschnitt 2).
> Danach: Block 14 „Smart Form 2.0" (KI-Formular), Block 15 „Profil & Einstellungen" — separat geplant.

---

## 1. ZIEL & DONE-KRITERIEN

Block 13 ist DONE, wenn:
- [ ] Registrierung nur mit AGB/Datenschutz-Häkchen möglich; Consent-Zeitstempel landet in `user_consents` (E2E-bewiesen)
- [ ] Platzhalter-Sweep über ganzes Repo = 0 Treffer (Impressum-Daten hat JJ bereits lokal eingetragen — nur noch verifizieren)
- [ ] Arabische/RTL-Zeichen-Sweep = 0 Treffer (JJ hat 2 Stellen gesehen, u.a. beim Upload — finden + Root-Cause-Fix)
- [ ] `deploy/vercel-env-push.ps1` existiert, Preflight GRÜN, alle Nicht-E2E-Variablen in Vercel gesetzt
- [ ] Stripe Live: Konto aktiviert, `rk_live_`-Key + Prod-Webhook-Secret in Vercel Production
- [ ] Vercel Pro aktiv (Hobby verbietet kommerzielle Nutzung)
- [ ] Anwalts-Freigabe AGB (Taler-/No-Cash-out-Klausel)
- [ ] Finaler Live-Smoke auf https://uri-markt-gamma.vercel.app inkl. EIN echter 5-Taler-Kauf
- [ ] tsc/build/E2E grün, Verify GRÜN, Push, Deploy, Übergabe

---

## 2. BEREITS ERLEDIGT (Planungs-Chat, 23.07.2026 — BEWIESEN)

**D1-Messung Live-DB:**
- `credit_taler`-RPC existiert live; `uq_wallet_tx_stripe_pi` (Unique-Index auf `stripe_payment_intent_id`, partial NOT NULL) existiert → Stripe-Gutschrift idempotent, DB launch-bereit
- 48h-Expiry läuft via **pg_cron in Supabase** (`expire-stale-reservations` alle 5 Min., `warn-expiring-reservations` alle 15 Min.) → KEIN Vercel-Cron nötig, Hobby/Pro-Cron-Limits irrelevant
- `profiles`-Grants sauber (anon SELECT, authenticated SELECT+UPDATE)

**Migration `block13_signup_consent` eingespielt, D2 GRÜN:**
- Tabelle `user_consents` (id, user_id→auth.users CASCADE, doc_type CHECK agb/datenschutz, version, accepted_at default now()), Index auf user_id
- RLS aktiv; Policy `consents_select_own` (nur eigene Zeilen, authenticated); Grants: NUR `authenticated SELECT` — kein anon, kein Client-INSERT/UPDATE/DELETE
- `handle_new_user()` erweitert: liest `raw_user_meta_data->>'consent_version'`; wenn vorhanden → 2 Zeilen (agb + datenschutz) serverseitig. Bestehende Logik (500 Rappen Bonus, Pioneer <50, Username-Kollision) byte-gleich erhalten
- Hinweis: Bestehende Nutzer (alles Testkonten) haben keinen Consent-Eintrag — akzeptiert, da vor Launch keine echten Nutzer existieren

---

## 3. CLAUDE-CODE-AUFTRAG (eine Session, Startnachricht in Abschnitt 8)

**Schritt 0 (Pflicht):** Repo-Ist messen und an JJ melden:
- Exakten Webhook-Routen-Pfad aus dem Repo nennen (z.B. `/api/stripe/webhook` — NIE raten, aus Code lesen) → JJ braucht ihn für Schritt 5D
- Exakte Stripe-Env-Variablennamen aus Repo/`.env.local`-Verwendung nennen (nie raten)
- Resend-Absenderadresse prüfen: wenn noch `onboarding@resend.dev` → an JJ melden (eigene Domain-Verifizierung nötig, siehe Abschnitt 6)

**Aufgaben:**
1. **Consent-Checkbox Registrierung:** Pflicht-Checkbox im Register-Tab des AuthModal, Links auf AGB + Datenschutz, Text z.B. „Ich akzeptiere die AGB und die Datenschutzerklärung". Ohne Häkchen kein Submit (Button disabled + klare Hilfe). Bei `signUp`: `consent_version` in die Metadata (EINE Konstante als Single Source, z.B. `CONSENT_VERSION = '2026-07-23'` in einer lib-Datei). Frontend-Design-Skill anwenden (s. Regel unten).
2. **Types regenerieren:** via Supabase-MCP `generate_typescript_types` (project `lhqsuelguwfdflapzdhk`) → `src/types/database.ts` (enthält dann `user_consents`). Kein Handedit, DB nur lesen (Muster aus Block 12). Falls MCP nicht verfügbar → STOPP an JJ; Planungs-Chat generiert und liefert die Datei.
3. **Platzhalter-Sweep:** Repo-weite Suche nach Platzhalter-Mustern (TODO, PLATZHALTER, Muster-, [Name], [Adresse], example.com, Lorem etc.) in Impressum/Datenschutz/AGB und überall → Liste an JJ; Erwartung 0 Treffer (JJ hat Daten schon eingetragen). Treffer ≠ 0 → JJ trägt lokal nach (Firmendaten NIE im Chat).
4. **Arabisch/RTL-Sweep + Fix:** Repo-weite Regex-Suche Unicode-Bereiche `\u0600-\u06FF`, `\u0750-\u077F`, `\uFB50-\uFEFF` + RTL-Steuerzeichen (`\u200E`, `\u200F`, `\u202A-\u202E`). JJ sah arabische Schrift u.a. beim Foto-Upload. Root-Cause finden (vermutlich kopierter/korrupter String oder Fremd-Locale einer Library) und sauber fixen — kein CSS-Verstecken.
5. **`deploy/vercel-env-push.ps1`:**
   - Preflight: `vercel whoami` + Projekt-Link geprüft → sonst ROT „FEHLT: X — so beheben: Y" und Abbruch
   - Liest `.env.local`; **filtert raus:** `E2E_*` und alle rein lokalen Test-Variablen
   - **Stripe-Sonderregel:** `STRIPE`-Secrets werden NUR nach Preview/Development gepusht (Test-Keys), NIE nach Production — Production-Stripe setzt JJ manuell mit Live-Werten (Schritt 5E). Verhindert Test-Keys im Echtgeld-Environment.
   - Zeigt vor dem Push NUR Variablen-NAMEN + Ziel-Environments, wartet auf Bestätigung, pusht dann einzeln via `vercel env add`
   - Hard-Guard: bricht ab, wenn `.env.local` fehlt; gibt GRÜN/ROT-Endstatus; `Read-Host` am Ende
6. **E2E `e2e/block13-consent.spec.ts`:** (a) Registrierung ohne Häkchen → Submit blockiert; (b) mit Häkchen → Konto entsteht UND `user_consents` enthält 2 Zeilen (agb+datenschutz) mit `CONSENT_VERSION` und Zeitstempel (Service-Role-Check); (c) User B sieht Consents von User A nicht (RLS-Beweis); Cleanup vorher/nachher.
7. Qualitäts-Gates (Cloud-Sandbox, Muster Block 12): `npm ci`, dann `./node_modules/.bin/tsc --noEmit` 0 Errors, `npm run build` grün (Dummy-`NEXT_PUBLIC`-Keys erlaubt, nichts an `.env.local` anlegen), ESLint grün. Playwright-E2E läuft NICHT im Cloud-Sandbox (keine Secrets) → Status UNGETESTET, **Auslieferung als Pull Request**. JJ fährt E2E lokal via `e2e/run-verify.ps1` auf dem PR-Branch; erst bei GRÜN gilt der Block als fertig, dann merged JJ den PR.

**Bindende Regel für JEDE UI-Arbeit (Block 13, 14, 15 und alle weiteren):**
> **Frontend-Design-Skill IMMER anwenden.** Ziel: exklusive Animationen und Erlebnisse, hochwertig und einzigartig — keine generischen Standard-Komponenten. Design-Referenz `docs/design/design-referenz.html` bleibt verbindlich (Dark, Gold #FFD700, Glassmorphism, Syne + DM Sans).

---

## 4. VERCEL CLI — EINMALIGES SETUP (JJ, klickgenau)

1. PowerShell öffnen → `npm i -g vercel`
2. `vercel login` → Browser öffnet sich → mit deinem Vercel-Konto bestätigen → Terminal meldet Erfolg
3. `cd "C:\Users\El Hamd\uri-markt"` (Anführungszeichen wegen Leerzeichen!)
4. `vercel link` → Fragen mit Enter/Ja beantworten → bestehendes Projekt `uri-markt` auswählen
5. **Kontrolle brauchst du nicht selbst:** `vercel-env-push.ps1` prüft Login + Link automatisch im Preflight und sagt dir GRÜN oder ROT mit exakter Behebung.

---

## 5. STRIPE LIVE — SCHRITT FÜR SCHRITT (JJ)

**Wichtig vorab: Der Testmodus bleibt für immer parallel bestehen.** Umschalter „Testmodus/Live" oben im Stripe-Dashboard. Lokal (`.env.local`) bleiben die Test-Keys → E2E und lokales Testen laufen unverändert weiter. Live-Keys existieren NUR in Vercel Production.

- **A. Konto aktivieren:** dashboard.stripe.com → Banner „Konto aktivieren" → Einzelfirma, Angaben, IBAN, ID-Dokument → absenden → 1–2 Tage Prüfzeit. (Kannst du SOFORT starten, parallel zu allem anderen.)
- **B. Nach Freigabe — Restricted Key:** Dashboard auf **Live-Modus** schalten → Entwickler → API-Schlüssel → „Eingeschränkten Schlüssel erstellen": Checkout Sessions = **Schreiben**, Kunden (Customers) = **Schreiben**, alles andere = Keine → erstellen → `rk_live_...` kopieren (wird nur 1× angezeigt). Den normalen Secret Key (`sk_live_`) NIE verwenden.
- **C. Webhook (Live-Modus):** Entwickler → Webhooks → „Endpoint hinzufügen" → URL = `https://uri-markt-gamma.vercel.app` + **exakter Pfad, den Claude Code in Schritt 0 aus dem Repo meldet** → Events: die, die Claude Code aus dem Webhook-Code bestätigt (mind. `checkout.session.completed`) → speichern → **Signing Secret `whsec_...`** kopieren.
- **D. Live-Werte in Vercel eintragen (manuell, klickbasiert):** vercel.com → Projekt `uri-markt` → Settings → Environment Variables → **nur Environment „Production"**: die beiden Stripe-Variablen (exakte Namen aus Claude-Code-Schritt-0-Meldung) mit `rk_live_...` und `whsec_...` anlegen. NIE in `.env.local`, NIE im Chat, NIE ins Repo.
- **E. Redeploy:** nach Env-Änderung `deploy/deploy-vercel.ps1` doppelklicken (Env greift erst mit neuem Deployment).
- **F. Echtgeld-Smoke:** In der Live-App EINEN 5-Taler-Kauf mit deiner eigenen Karte. Geld fliesst auf dein eigenes Stripe-Konto (abzüglich Stripe-Gebühr ~CHF 0.30 + 2.9%). Prüfen: Taler-Guthaben +5, Eintrag in `wallet_transactions`, Zahlung im Stripe-Dashboard sichtbar.

---

## 6. WEITERE JJ-GATES & LÜCKEN-CHECK (proaktiv geprüft)

| Punkt | Status / Aktion |
|---|---|
| Vercel Pro | Vor Echtgeld: vercel.com → Settings → Billing → Upgrade Pro (~20 USD/Mt). Hobby verbietet kommerzielle Nutzung. |
| Anwalt AGB | Taler-/No-Cash-out-Klausel freigeben lassen. **Frage mitgeben:** „Reicht zum Start ein E-Mail-Prozess für Auskunft/Löschung nach nDSG, bis der In-App-Selfservice (Block 15) live ist?" |
| Supabase Auth URLs | Supabase Dashboard → Authentication → URL Configuration: Site URL = Live-Domain, Redirect-URLs enthalten Live-Domain. (Planungs-Chat prüft mit, bevor Live-Smoke startet.) |
| Resend-Absender | Wenn noch `onboarding@resend.dev` (Claude Code meldet in Schritt 0): eigene Domain in Resend verifizieren, sonst landen Mails im Spam. Entscheidung dann im Planungs-Chat. |
| pg_cron | ✅ Verifiziert: läuft in Supabase, unabhängig von Vercel. Nichts zu tun. |
| Stripe-Idempotenz | ✅ Verifiziert: `credit_taler` + Unique-Index live. Nichts zu tun. |
| E2E-Variablen | Gehen NIE zu Vercel (Skript filtert `E2E_*`). |

---

## 7. ABLAUF-REIHENFOLGE (Empfehlung)

1. **Heute:** Stripe-Aktivierung absenden (Wartezeit läuft) + Vercel CLI Setup (Abschnitt 4) + Anwalt kontaktieren
2. Claude-Code-Session Block 13 (Abschnitt 8) → Verify → Push → Deploy
3. `vercel-env-push.ps1` ausführen (Nicht-Stripe-Variablen)
4. Nach Stripe-Freigabe: Abschnitt 5 B–E
5. Vercel Pro upgraden
6. Finaler Live-Smoke: registrieren (mit Häkchen) → inserieren → matchen → reservieren → Deal → bewerten → echter 5-Taler-Kauf
7. Bei GRÜN überall: **LAUNCH-Gates erfüllt** → Übergabe → neuer Planungs-Chat für Block 14 (Smart Form 2.0)

---

## 8. STARTNACHRICHT FÜR CLAUDE CODE (kopierfertig)

```
Lies zuerst CLAUDE.md und uebergabe-2026-07-21-block12.md vollständig. Dann Block 13 laut docs/planung/block-13-go-live-haertung.md, Abschnitt 3.

Regeln: No-Workaround (nur Root-Cause), D1–D5, ein Fix pro Zyklus, max. 3 Zyklen dann STOPP an JJ. Auslieferung als Pull Request (kein direkter Push auf main). DB wird NICHT angefasst — die Migration ist bereits eingespielt, user_consents existiert live (Supabase-MCP nur LESEN, z.B. generate_typescript_types).

Schritt 0 (Pflicht, VOR jedem Code): Repo-Ist messen und an JJ melden:
- Exakter Stripe-Webhook-Routen-Pfad (aus dem Code, nicht raten)
- Exakte Stripe-Env-Variablennamen (aus Repo-Verwendung)
- Resend-Absenderadresse (resend.dev ja/nein)

Dann Aufgaben 1–7 aus Abschnitt 3 des Block-MD:
1. Pflicht-Consent-Checkbox in der Registrierung + CONSENT_VERSION-Konstante + consent_version in signUp-Metadata
2. Types via Supabase-MCP generate_typescript_types (project lhqsuelguwfdflapzdhk) → src/types/database.ts, kein Handedit
3. Platzhalter-Sweep gesamtes Repo (Liste an JJ, Erwartung 0 Treffer)
4. Arabisch/RTL-Sweep (Unicode-Ranges \u0600-\u06FF, \u0750-\u077F, \uFB50-\uFEFF + RTL-Steuerzeichen \u200E \u200F \u202A-\u202E) → Root-Cause-Fix der Fundstellen (JJ sah 2 Stellen, u.a. beim Foto-Upload)
5. deploy/vercel-env-push.ps1 (läuft auf JJs PC): Preflight vercel whoami + Projekt-Link, E2E_*-Filter, Stripe-Secrets NIE nach Production, Namen-Vorschau vor Push, Hard-Guards, GRÜN/ROT, Read-Host am Ende
6. e2e/block13-consent.spec.ts (ohne Häkchen blockiert mit sichtbarem Grund; mit Häkchen → 2 user_consents-Zeilen mit Version+Zeitstempel via Service-Role-Check; RLS-Beweis mit User B; Cleanup vorher/nachher)
7. Gates im Cloud-Sandbox: npm ci → ./node_modules/.bin/tsc --noEmit 0 Errors, npm run build grün (Dummy-NEXT_PUBLIC-Keys erlaubt, nichts an .env.local anlegen), ESLint grün. Playwright läuft hier NICHT (keine Secrets) → als UNGETESTET markieren, PR erstellen. JJ fährt run-verify.ps1 auf dem PR-Branch; bei ROT: Fix-Commits auf DENSELBEN Branch/PR, kein neuer PR.

BINDEND für alle UI-Arbeit: Frontend-Design-Skill anwenden — exklusive Animationen und Erlebnisse, hochwertig und einzigartig, keine generischen Komponenten. Design-Referenz docs/design/design-referenz.html (Dark, Gold #FFD700, Glassmorphism, Syne + DM Sans) verbindlich.

Am Ende: uebergabe-2026-07-23-block13.md schreiben (strikt BEWIESEN/UNGETESTET/ANGEFANGEN) + neue Lektionen in CLAUDE.md — beides im selben PR.
```
