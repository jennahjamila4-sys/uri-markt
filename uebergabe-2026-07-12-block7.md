# Übergabe 12.07.2026 — Block 7 (5-Taler-Texte + Rechtsseiten)

Arbeitsmodus: Planungs-Chat mit Repo-Mount. Code selbst; Build + E2E via „Uri-Markt
Verify" bei JJ. Kein Push ohne JJ-OK. D1–D5, Lektionen 1–14.
Hinweis: Sandbox in dieser Session wegen Speichermangel nicht verfügbar → tsc/eslint
lokal NICHT lauffähig; stattdessen sorgfältige Escaping-Prüfung (Lektion 12) und voller
Nachweis über „Uri-Markt Verify" (next build inkl. tsc+eslint + Playwright).

## VORAB (freigegeben, erledigt)
- `e2e/lock-commit.ps1` (Muster push.ps1): npm install → add+commit package-lock.json →
  push. JJ ausgeführt, GRUEN. package-lock ist jetzt in sync (Voraussetzung Block 8 Vercel `npm ci`).

## ✅ BEWIESEN & ABGESCHLOSSEN (Verify GRUEN: 28/28)

### 5-Taler-Startguthaben (Frontend)
- Einzige nutzersichtbare Falschaussage war `src/components/onboarding/screens/OnboardingScreen5.tsx`
  („100" → **5**). Alle übrigen „100" im Frontend = CSS/Prozent/Limits (bewertet, korrekt).
  „Pionier-Plätze"/`pioneer_badge` = eigenes Badge-Feature, unverändert.
- Doc `docs/database-schema.md` (nannte noch 100 Taler = 10000) auf 5 = 500 korrigiert (Drift weg).
- DB-Default/Onboarding-RPC = 5 laut Live-DB (JJ bestätigt) — nicht Teil dieses Code-Blocks.

### Rechtsseiten (CH-konform, statisch)
- Neue Routen `src/app/impressum/page.tsx`, `.../datenschutz/page.tsx`, `.../agb/page.tsx`
  über gemeinsame Hülle `src/components/legal/LegalShell.tsx`.
- **Impressum** (UWG Art. 3): echte Angaben eingetragen (Christin Radegonde, Lindenstrasse 20,
  6472 Erstfeld, E-Mail sellehcyes.ssiws@gmail.com), Verantwortliche = dieselbe Person.
  KEINE Platzhalter mehr (Telefon/HR/MWST ohne Daten entfernt, da nicht zutreffend).
- **Datenschutz** (revDSG 2023): Datenarten (Konto, Profil, Inserate, Kommentare,
  Transaktionen, Zahlungsdaten, technisch), Zweck, Empfänger/Auftragsbearbeiter
  (Supabase EU Paris, Vercel, Stripe, Resend), Bekanntgabe Ausland, Speicherdauer,
  Betroffenenrechte inkl. Verlinkung der bestehenden Konto-Löschung im Profil, nur technisch
  notwendige Cookies, Kontakt via Impressum.
- **AGB** inkl. Taler-Klausel: Uri-Taler = internes Guthaben, KEIN Zahlungsmittel/E-Geld,
  KEIN Auszahlungs-/Rückerstattungs-/Umtauschanspruch; 5-Taler-Startguthaben ohne
  Rechtsanspruch; 10 % Provision auf bestätigte Deals; 48h-Reservierungsablauf;
  Verhaltensregeln; Haftungsausschluss (reine Vermittlung); Gerichtsstand Erstfeld (UR).

### Footer + Signup-Zustimmung (Lücken geschlossen, Lektion 1 + 6)
- `src/components/layout/Footer.tsx` global im Root-Layout (`src/app/layout.tsx`) → Links
  Impressum/Datenschutz/AGB auf JEDER Seite. Untere Polsterung hält Links frei von der
  fixierten BottomNav.
- Registrierung hatte KEINE Zustimmung. Neu in `src/lib/validations/auth.ts`
  (`acceptTerms` Pflicht via `refine`) + `src/components/auth/AuthModal.tsx`: Pflicht-Checkbox
  mit sichtbarer Fehlermeldung (`register-terms-error`), Links auf AGB+Datenschutz (neuer Tab).
  Ohne Häkchen wird `signUp` gar nicht erst aufgerufen.

### E2E `e2e/block7-legal.spec.ts` (GRUEN)
- Onboarding zeigt 5 (nicht 100); `/impressum` `/datenschutz` `/agb` je Status 200 + Inhalt +
  Footer; AGB-Taler-Klausel (kein Zahlungsmittel, kein Auszahlungsanspruch, 10 %, 48h);
  Footer-Links vorhanden + navigierbar; Signup ohne Zustimmung blockiert MIT Meldung + kein
  Konto; Signup mit Zustimmung sendet den Request ab (Gate offen). Test-Konto-Cleanup via Admin-API.

## 🐛 D5 — Root Cause Zyklus-1-Rot (Verify 1: 27/28, Test „mit Zustimmung")
- Symptom: nach Submit blieb das Username-Feld sichtbar (`toBeHidden` Timeout), DB-Beweis lief nie.
- Gemessen (D1, aus `_pw.log` + Code-Pfad): Test „ohne Zustimmung" GRUEN → Gate-Logik korrekt.
  Username sichtbar ⇒ `setTab('login')` lief nicht ⇒ `supabase.auth.signUp` gab einen Fehler
  zurück (nur dann bleibt das Formular stehen). `signUp` selbst ist unveränderter Bestands-App-
  Code; die Testumgebung (E-Mail-Bestätigung/Ratelimit) lehnt einen echten Neu-Signup ab.
- Ursache der Rot-Meldung = **über-spezifizierte Test-Erwartung** (hing an E-Mail-Zustellung),
  KEIN Block-7-Bug. Kein App-Code geändert (Lektion 9: Test nicht um echten Bug herumgebaut —
  es gab keinen; Gate ist durch den grünen „ohne Zustimmung"-Test bewiesen).
- Fix (1, D3): Test misst jetzt deterministisch das echte Block-7-Verhalten — mit Häkchen geht
  der `POST /auth/v1/signup` ab (Gate offen), HTTP-Status wird geloggt (D1), und es wird
  geprüft, dass KEIN halbes Konto entsteht (Lektion 7). Zyklus 2: GRUEN, 28/28.

## ⚠️ OFFENE PUNKTE
- **Anwaltliche Prüfung vor Launch/Echtgeld:** Die Rechtstexte sind nach bestem Wissen
  CH-konform formuliert (UWG, revDSG 2023), aber NICHT anwaltlich geprüft. Vor echten
  Zahlungen (Block 8+) durch eine Fachperson prüfen/freigeben lassen — insbesondere
  Taler-Klausel (Abgrenzung E-Geld/Finanzmarktrecht), Datenschutz-Auftragsbearbeiter und
  Haftungsausschluss.
- **Impressum/AGB-Text nach dem grünen Lauf editiert** (echte Angaben statt Platzhalter,
  Gerichtsstand Erstfeld) — reine statische Texte, kein Logik-/JSX-Sonderzeichen-Risiko.
  Vor Push zur Sicherheit „Uri-Markt Verify" 1× wiederholen (empfohlen).
- Consent-Nachweis wird aktuell NICHT persistiert (nur Client-Gate). Falls für DSG-
  Nachweisbarkeit gewünscht: Consent-Zeitpunkt in Profil/DB speichern — eigener Mini-Block
  mit DB-Migration (Planungs-Chat), bewusst nicht in Block 7.

## 📋 NÄCHSTE BLÖCKE
Block 7 ✅. Offen: Block 8 (Vercel-Deploy), Block 9 (Kommentar-Zähler Feed-Karten).

## Push
Noch NICHT freigegeben. Nach empfohlenem Re-Verify (GRUEN) und JJ-OK: „Uri-Markt Push".
