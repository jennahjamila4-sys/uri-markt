# Uri-Markt — Übergabe Stand 02.07.2026

## Kontext
- Uri-Markt, hyperlokaler Marktplatz Kanton Uri. Next.js 15 (App Router), Supabase
  (EU Paris, ID lhqsuelguwfdflapzdhk), Stripe, Claude API, Resend, Vercel.
- Repo: jennahjamila4-sys/uri-markt. Lokal: C:\Users\El Hamd\uri-markt.
- JJ nicht-technisch. Umsetzung via Claude Code (Windows PowerShell), alles Deutsch.
- Human in the Loop: jeden Schreib-Schritt einzeln bestätigen. Reines Lesen + npx tsc
  dürfen durchgewunken werden. KEIN Push ohne explizites OK. Keine Workarounds.
- PowerShell-Pipes (Get-ChildItem | ...) laufen in Timeouts → Claude Code nutzt eigene
  Read/Glob/Grep-Tools, keine Pipes.

## Immer zuerst lesen
CLAUDE.md, DEVELOPMENT_GUIDELINES.md, docs/database-schema.md, docs/design/design-referenz.html.
Echtes Supabase-Schema (MCP) ist die Wahrheit, NICHT die Phase-Plan-Dateien.

## Git-Stand
- Commit 77976e2 = Aufgabe A. Commit 6344b3e = Aufgabe B (Design + Fixes).
- Heutige Auth/Onboarding-Fixes: beim Schliessen lokal committet (siehe unten). KEIN Push.
- Vor Arbeit morgen: git status prüfen.

## Heute gefixt (tsc+build grün)
1. Login-Bug: src/lib/supabase/server.ts createServerClient async, await cookies() +
   getAll/setAll (Next.js 15). catch schluckt nur isReadonlyCookiesError. 15 Aufrufer auf
   await umgestellt. cookies()-Warnung weg.
2. Onboarding-Benachrichtigung: requestPermission nur im onClick, fängt !isSecureContext
   (LAN-IP) und denied ab, default erzeugt keine Fehlermeldung.

## OFFENE BUGS (morgen: erst diagnostizieren, Ursache je Bug erklären, auf OK warten, dann fixen)
BUG 1: Neu erstelltes Inserat erscheint erst nach Logout. Vermutung: fehlendes revalidatePath/Cache.
BUG 2: Erstelltes GESUCH nicht im Feed sichtbar, nur Angebote. type korrekt? Feed/Tab filtert falsch?
BUG 3: Profil-Icon (oben rechts) löst sofort Logout aus statt Dropdown-Menü.
BUG 4: Klick auf "Profil" (Navigation) öffnet keine Route.
BUG 5: View-Zähler läuft endlos hoch ("1144 views"). Absichtlicher FOMO-Effekt oder echter Bug? Klären.
BUG 6 (wichtig): Text "+10% Provision in Talern bei Kauf" ist falsch. Käufer zahlt nur den
  Preis; 10% zieht die App vom VERKÄUFER ab (Taler). Prüfen: (a) Text UND (b) echte Berechnung
  im Deal-Flow/Provisions-RPC — wird dem Käufer fälschlich etwas aufgeschlagen?

## Danach (nicht sofort)
- Formulare smarter machen (bedingte Felder, verkaufspsychologisch führen). Vorlage:
  docs/design/design-referenz.html — Claude Code muss dort nachsehen.
- Spracheingabe (VoiceInput) = Phase 3.
- Vor Phase 3: Supabase-Typen frisch generieren; Phase-3/4-Pläne gegen echtes Schema korrigieren
  (xp_events→xp_log, doppelter Stripe-Webhook-case, nicht-atomare Taler-Gutschrift,
  veraltete KI-Modellnamen, fehlender unique-Constraint smart_matches).