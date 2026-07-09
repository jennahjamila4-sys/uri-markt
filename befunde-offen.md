# Offene Befunde (nicht sofort fixen — kein Scope-Creep)

> Während der autonomen Blöcke gefundene Lücken, die NICHT zum aktuellen Block
> gehören. Werden im passenden Block oder nach Rücksprache mit JJ abgearbeitet.

## Aus Block 2 (Status-Ordnung Feed, 09.07.2026)

- **Öffentliches Profil zeigt keine „Abgeschlossen"-Inserate.**
  `src/app/profile/[username]/page.tsx` lädt nur `.eq('status', 'active')`.
  Das Soll-Verhalten aus Block 2 nennt für das Verkäufer-Profil „Abgeschlossen"
  (sold). Aktuell tauchen verkaufte Inserate auf dem öffentlichen Profil gar nicht
  auf. Nicht Teil der Feed-Messpunkte/Abschlusskriterien von Block 2 → hier notiert.
  Fix-Kandidat: eigener Abschnitt „Abgeschlossen" auf dem öffentlichen Profil
  (Design + `PublicListingGrid` um Status-Anzeige erweitern).

- **TikTokScroll: toter Sold-Badge-Code.** `TikTokScroll.tsx` rendert noch ein
  VERKAUFT-Badge für `status === 'sold'`. Da sold nun schon in der Query aus dem
  Feed ausgeschlossen wird, ist dieser Zweig nicht mehr erreichbar (harmlos,
  defensiv). Kann bei Gelegenheit entfernt werden.

## Aus Block 3 Nachbesserung II (09.07.2026)

- **„Markt nicht klickbar" (ein Profil) — Ursache noch zu bestätigen.** Aus dem Code
  liess sich KEIN harter Klick-Blocker isolieren: Karten öffnen das Detail
  (`setSelectedListingId` → `ListingDetail`), und der Kauf-Button erscheint nur bei
  fremden, aktiven Inseraten. Wahrscheinlichste Ursache (auch JJs Verdacht): das
  Test-Profil sieht überwiegend EIGENE Inserate → Eigenkauf ist korrekt gesperrt.
  Fix (Lektion 6): eigene Karten tragen jetzt sichtbar „📍 Dein Inserat", das Detail
  zeigt weiterhin „Das ist dein Inserat", und Kauf-Validierungsfehler kommen als
  lesbarer Text statt Zod-JSON. **Falls eine FREMDE, aktive Karte sich trotzdem nicht
  öffnen lässt:** JJ bitte Konsole (F12) beim Klick fotografieren — dann gezielt fixen.

- **„Meine Käufe" Endlos-Ladehänger — evtl. kaputter Testdatensatz.** Code-Bug gefunden
  und gefixt: `ListingDetail` zeigte bei nicht (mehr) existierendem Inserat einen
  stummen Endlos-Spinner (`if (loading || !listing)`), jetzt getrennt in Ladezustand
  und schliessbaren „Inserat gibt's nicht mehr"-Hinweis. Die `ContactSection` hat seit
  Block 3 try/catch/finally und kann nicht hängen. **Falls in „Meine Käufe" weiterhin
  ein bestimmter alter Deal hängt:** wahrscheinlich ein kaputter Testdatensatz
  (Transaktion in unerwartetem Status / gelöschtes Inserat) → Claude Code fasst die DB
  NICHT an, Planungs-Chat bereinigt den Datensatz (Dauerregel 4). JJ bitte melden,
  welche Transaktion (Titel/Status) es ist.

## Aus Block 3 Nachbesserung (09.07.2026)

- **PNG-Upload — Frontend-Bug, exakter Fehler noch zu messen.** Planungs-Chat hat
  live bestätigt: Bucket `listings` hat KEINE MIME-Whitelist und KEIN Grössenlimit
  → PNG wird DB-seitig nicht blockiert. Die Ursache liegt im Frontend/Upload-Code.
  Der Code-Pfad (`src/lib/supabase/storage.ts`) sieht für PNG korrekt aus
  (`image/png` erlaubt, `contentType` gesetzt, Extension via `file.name`) — durch
  reine Code-Inspektion war kein PNG-spezifischer Bug eindeutig zu isolieren.
  **Nächster Schritt (D1):** JJ lädt eine PNG hoch und liest die exakte Meldung aus
  Toast + Browser-Konsole (`[uploadListingImage]` → message/type/sizeKB) +
  Netzwerk-Tab (Statuscode). Diagnose ist eingebaut. Kein Blind-Fix vor der
  gemessenen Meldung.

- **Übergabe-Wunsch / optionale Nachricht im Kauf-Flow.** Fachlich geprüft: ein
  freier „Wunsch zur Übergabe/Nachricht" bräuchte eine neue Spalte auf
  `transactions`. Bewusst NICHT gebaut (keine unaufgeforderte DB-Änderung,
  Dauerregel 4). Für MVP ausreichend: beide Seiten tauschen nach der Bestätigung
  ohnehin vollständige Kontaktdaten aus und klären die Übergabe direkt. Bei Bedarf
  später: Spalte `transactions.buyer_message text` via Planungs-Chat + Feld im
  DealFlow.
