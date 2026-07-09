# Übergabe — Block 3 Nachbesserung (Stand 09.07.2026)

> Kompakter Zwischenstand. Regeln D1–D5 + Lektionen 1–6 (CLAUDE.md) gelten.
> KEIN Push erfolgt — alle Commits liegen lokal auf `main`.

---

## Was committet ist (lokal, kein Push)

| Commit | Inhalt |
|---|---|
| `368cdaa` | CH-Validierung Zahlungen (IBAN Mod-97, Telefon), Zahlungsweg **Bank**, `buyer_contact` min 2, 48h-Reserviert-Hinweis (Verkäufer+Käufer), PNG-Diagnose, Selflearning-Abschnitt |
| `ef74556` | IBAN/Telefon Unit-Tests (8 grün) + präzise IBAN-Meldungen (Länge vs. Prüfziffer) + Lektion 5 |
| `e2b445e` | Schema-Tests (BuyIntent/PaymentInfo) + `vitest.config.ts` (@-Alias), zusammen 14 grün |
| `1237d06` | **Formular-Fehler sichtbar** (Inserat: Sprung zum Fehlerfeld + Scroll + roter Hinweis, Häkchen-Bug gefixt), **ListingDetail-Endlosspinner** bei gelöschtem Inserat gefixt, **„📍 Dein Inserat"-Chip**, Lektion 6 |

(Frühere Block-2/3-Commits: `0784716`, `e54f883` — siehe git log.)

---

## Was ich selbst getestet habe (verifiziert)

- **`npm test` → 14/14 grün**: IBAN (offizielle Beispiel-IBAN `CH9300762011623852957` akzeptiert, falsche Prüfziffer/Länge/Land abgelehnt), Telefon (079/041/+41/0041, mit/ohne Leerzeichen), Zahlwege (cash/twint/bank), Kontakt „JJ" (min 2).
- **`npx tsc --noEmit` → 0 Fehler. `npm run build` → grün** (0 Errors/Warnings; nur harmlose webpack-Cache-Perf-Hinweise).
- **Server-Smoke selbst gefahren**: `GET /` → 200, `GET /profile` → 200 (Seiten kompilieren/laufen serverseitig ohne Absturz).
- **NICHT selbst getestet** (kann keinen Browser bedienen): echter Klick-Kauf mit zwei Profilen, Speichern/Laden im Browser, Login-Flow. → braucht JJ.

---

## 🚨 OFFENE BLOCKER (von JJ gemeldet — zuerst angehen, D1)

### BLOCKER 1 — Nicht angemeldet, aber Profil sichtbar (Auth client vs. server inkonsistent)
Der Client zeigt eingeloggten Zustand (Profil), obwohl serverseitig keine gültige
Session besteht (oder umgekehrt). Verdachtsflächen: `useAuth` (Client, `appStore.user`)
vs. `src/lib/supabase/server.ts` + `src/middleware.ts` (Session-Refresh). NICHT
gemessen — nächste Session: exakten Zustand beweisen (Server `auth.getUser()` vs.
Client-Store vs. Cookies), dann Root-Cause.

### BLOCKER 2 — Anmeldung funktioniert gar nicht mehr (JJ kann nichts testen)
Login/Registrierung schlägt fehl → JJ ist blockiert. Zuerst messen: exakte Meldung
aus `AuthModal` (Toast/root-Error), Browser-Konsole, Netzwerk-Tab (Supabase-Auth-
Response, Statuscode), und ob `middleware.ts` läuft. Kandidaten: Session-Cookies
werden nicht gesetzt/gelesen, `emailRedirectTo`/`NEXT_PUBLIC_APP_URL`, oder DB-seitig
(→ Planungs-Chat, wenn Grants/Policies auf `profiles` betroffen — vgl. offener Punkt
02.07. in CLAUDE.md). **Hängt vermutlich mit BLOCKER 1 zusammen — gemeinsam angehen.**

### BLOCKER 3 — Offene Punkte aus der letzten Runde (Details in `befunde-offen.md`)
- **PNG-Upload:** exakte Fehlermeldung noch ausstehend. Bucket ist DB-seitig sauber
  (kein MIME-/Grössenlimit, Planungs-Chat bestätigt) → Frontend-Bug. Diagnose ist
  im Code (`[uploadListingImage]`), JJ muss PNG hochladen und Toast+Konsole+Netzwerk
  liefern.
- **Markt-Klick-Problem:** eigene Karten jetzt mit „📍 Dein Inserat" markiert,
  Kauf-Fehler lesbar. Falls eine FREMDE aktive Karte sich nicht öffnet → Konsole nötig.
- **„Meine Käufe" Endloslader:** `ListingDetail`-Endlosspinner (gelöschtes Inserat)
  gefixt. Falls ein bestimmter alter Deal weiter hängt → kaputter Testdatensatz,
  Planungs-Chat bereinigt (Claude Code fasst DB nicht an). JJ: welcher Deal (Titel/Status)?

---

## Dev-Server-Stand

- Läuft im Hintergrund: `npm run dev` → **http://localhost:3000** (Next.js 15.2.8).
- Zuletzt frisch gestartet nach `.next`-Löschung (kein stale-Build-Konflikt, Lektion 3).
- Bei Verdacht auf stale Build: Dev stoppen (Prozess auf Port 3000), `.next` löschen,
  `npm run dev` neu.

## Debug-Instrumente aktuell im Code

- `src/lib/supabase/storage.ts` → `console.error('[uploadListingImage]', {message,type,sizeKB,name})`
  bei fehlgeschlagenem Bild-Upload (für BLOCKER 3 / PNG). **Nach Fix wieder entfernen.**
- `src/components/listing/ContactSection.tsx` → `console.warn/error('[ContactSection]', …)`
  bei RPC-Fehlern (Kontaktdaten). Defensiv, kann bleiben.
- Sonst keine temporären Debug-Reste bekannt.

## Tests / Befehle

- `npm test` — Vitest (Validierungen), aktuell 14 grün.
- `npm run build` — Produktions-Build (Dev vorher stoppen).
