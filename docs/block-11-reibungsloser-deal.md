# Block 11 — Reibungsloser Deal (Plan v1, 19.07.2026)

> Planungs-Chat-Teil (Migrationen) ist ERLEDIGT und D2-verifiziert. Dieses Dokument steuert die
> Claude-Code-Session. Die Startnachricht steht am Ende — als TEXT einfügen, nie als Datei.

---

## 1. Bereits erledigt (Planungs-Chat, 19.07.2026 — Live-DB, bewiesen)

**Migration M11-1** (`block11_reserved_until_relisted_warning_columns`):
- `listings.reserved_until timestamptz` — öffentlicher 48h-Ablauf-Zeitpunkt (für Feed-Countdown, alle sehen ihn; anon hat SELECT auf listings)
- `listings.relisted_at timestamptz` — ehrlicher „Wieder erhältlich"-Marker (nur bei echter Reaktivierung gesetzt)
- `transactions.expiry_warning_sent_at timestamptz` — Idempotenz für Vorwarnung
- Alle 5 Status-RPCs pflegen die Felder:
  - `create_buy_intent` → `reserved_until = now()+48h`
  - `process_transaction_commission` → Fenster startet bei Bestätigung neu (`now()+48h`), `expiry_warning_sent_at = null` (zweite Warnung fürs Abschluss-Fenster)
  - `expire_stale_reservations` → `status='active'`, `reserved_until=null`, `relisted_at=now()`
  - `escalate_no_show` → dito
  - `complete_transaction` → `status='sold'`, `reserved_until=null`
- Backfill: alle aktuell reservierten Inserate haben `reserved_until` (Check: 0 offen)
- Grant-Härtung (bewiesen tot, risikofrei): `transactions` — anon ALLES entzogen; authenticated UPDATE/DELETE entzogen (keine Policies dafür). Bleibt: authenticated INSERT+SELECT (Policies existieren).

**Migration M11-2** (`block11_warn_expiring_cron_realtime`):
- `warn_expiring_reservations()` — SECURITY DEFINER; warnt bei T−6h (42–48h Fenster), idempotent; EXECUTE nur postgres + service_role (Client kann sie NICHT aufrufen)
  - pending → Verkäufer: „⏳ Nur noch 6 Stunden! Jemand wartet auf „[Titel]"! Bestätige die Kaufanfrage jetzt – sonst geht die Reservierung zurück in den Markt."
  - confirmed → Verkäufer UND Käufer (Abschluss-Erinnerung, FOMO-empathisch)
  - Notification-`type`: **`tx_expiring`** (kein Check-Constraint auf notifications.type — verifiziert)
- Cron: `expire-stale-reservations` von 30 → **alle 5 Min** (Countdown-Genauigkeit); neu `warn-expiring-reservations` **alle 15 Min**
- Realtime: `public.listings` zur Publikation `supabase_realtime` hinzugefügt (RLS greift auch für Realtime — Entwürfe bleiben unsichtbar)

**Types:** offiziell via `gen types` generiert (kein Handedit) → Datei `database.ts` liegt bei.

## 2. Warum (Root Causes)
- 48h-Frist war nur in `transactions` ableitbar (RLS: nur Käufer/Verkäufer) → Feed konnte keinen Countdown für alle zeigen → `reserved_until` auf listings.
- Es gab nur die Benachrichtigung NACH Ablauf → Vorwarnung T−6h neu.
- Realtime-Publikation war leer → Statuswechsel erst nach Reload sichtbar → listings publiziert.
- Reaktivierung war in der DB nicht erkennbar → `relisted_at`.

## 3. UI-Textprinzip (JJ, bindend)
Positives Gefühl zuerst, Frage-/Einladungsform, intrinsisch motivierend, IMMER faktisch wahr.
FOMO = empathische Schlüsselwörter, KEINE erfundenen Zahlen.

---

## 4. STARTNACHRICHT FÜR CLAUDE CODE (ab hier kopieren, als Text einfügen)

---

Block 11 — Reibungsloser Deal. Lies zuerst CLAUDE.md und uebergabe-2026-07-18-block10.md komplett. Alle Lektionen gelten, besonders 1 (Cross-Feature), 2 (Schweizer Format-Validierung), 6 (blockierte Aktionen nie stumm), 7 (kein Error-Swallowing), 8/9 (E2E, kein Aufweichen), 11 (database.ts nie handeditiert), 13 (Token-Ökonomie), 14 (Preflight), 20 (Formular-Selektoren), 21 (Sicherung vor Reparatur). KEIN Push ohne JJ-OK. Max 3 Root-Cause-Zyklen, dann STOPP-Bericht.

DB-STAND (vom Planungs-Chat bereits eingespielt und D2-verifiziert — NICHT anfassen, nur nutzen):
- listings.reserved_until (timestamptz): öffentlicher 48h-Ablauf. Gesetzt bei Kaufanfrage (now+48h), neu gesetzt bei Verkäufer-Bestätigung (now+48h), null bei active/sold. Für alle lesbar (anon SELECT).
- listings.relisted_at (timestamptz): gesetzt, wenn ein Inserat nach Expiry/No-Show wieder aktiv wurde. Ehrlicher Marker.
- transactions.expiry_warning_sent_at: nur DB-intern (Vorwarnung T−6h läuft per Cron alle 15 Min, Typ 'tx_expiring'; Expire-Cron alle 5 Min). Du baust dafür KEINE App-Logik — nur die Glocke muss den neuen Typ verlinken.
- Realtime ist für public.listings aktiviert (Publikation supabase_realtime, RLS greift).
- Grants transactions gehärtet: Client kann nur INSERT+SELECT (RLS-geschützt). Alle Status-Wechsel weiterhin NUR über die RPCs.

SCHRITT 0 (D1, Pflicht vor jedem Edit): Repo-Ist messen und kurz dokumentieren: (a) Wo lebt das Kaufanfrage-Formular (DealFlow/BuyModal?) und welche Felder hat es? (b) Wo lebt das Konto-/Profil-Bearbeiten-Modal? (c) ListingCard + TikTokScroll: wie wird der ⏳-RESERVIERT-Sticker heute gerendert? (d) Wie liest der Feed listings (Query-Spalten — reserved_until/relisted_at ergänzen)? (e) Glocke/Notifications: wie werden tx_pending/match verlinkt? (f) Gibt es irgendwo direkte UPDATE/DELETE-Aufrufe des Clients auf transactions? (Erwartung: nein — falls doch: STOPP, Bericht an JJ, nicht umbauen.)

TEIL 1 — Types: src/types/database.ts 1:1 durch die von JJ gelieferte Datei ersetzen (liegt schon am Zielpfad, wenn JJ sie gespeichert hat — prüfen, Anker `warn_expiring_reservations` muss enthalten sein). Danach npx tsc --noEmit. Kein Handedit (Lektion 11).

TEIL 2 — Kaufanfrage ohne Doppel-Tipperei (Prefill): Beim Öffnen des Kaufformulars die eigenen Daten aus profiles_private laden (RLS own-only, existiert) und die Kontaktfelder vorbefüllen; editierbar. Checkbox „💾 Für nächstes Mal merken" (Default an, wenn Felder leer waren): speichert Änderungen per Upsert in profiles_private zurück. Fehlerpfade sichtbar (Lektion 6/7). Leere profiles_private-Zeile = leeres Formular, kein Fehler.

TEIL 3 — Konto-Modal Tabs: „Angaben" (bestehende Profilfelder) + neu „Zahlungen": IBAN + Twint-Nummer aus profiles_private, mit Schweizer Format-Validierung (Lektion 2: technisch begründet, exakte Fehlermeldung was falsch ist; Test-IBAN CH9300762011623852957 muss valid sein, Fantasie-IBAN invalid). Sichtbarkeits-Toggles (show_iban/show_twint) daneben, mit kurzem Klartext, wer das wann sieht (nur Deal-Partner nach Bestätigung — get_transaction_contact respektiert die Toggles bereits).

TEIL 4 — 48h SICHTBAR für alle (Feed + Detail): Reservierte Karte zeigt statt nur „⏳ RESERVIERT" jetzt „⏳ Reserviert — noch X Std." aus reserved_until (unter 90 Min: Minuten; Berechnung client-seitig, 1x/Min Tick). Ist reserved_until überschritten, aber Status noch 'reserved' (Cron-Lag max 5 Min): ehrlich „🔄 Gleich wieder frei…" — NIE den Status raten. Realtime: eine Subscription auf postgres_changes (UPDATE, public.listings) im Feed, die status/reserved_until/relisted_at der sichtbaren Karten aktualisiert — Reservierung/Freigabe erscheint ohne Reload. Subscription sauber aufräumen (unmount), Fehler nicht schlucken (Lektion 7: Realtime-Fehler loggen, UI bleibt korrekt über normale Fetches).

TEIL 5 — „🔄 Wieder erhältlich"-Sticker: Karte + Detail zeigen ihn, wenn status='active' UND relisted_at innerhalb der letzten 48h. Text auf Karte: „🔄 Wieder erhältlich!" — nur echt (Spalte wird nur bei echter Reaktivierung gesetzt).

TEIL 6 — Deal-Countdown für Käufer + Verkäufer: In SellerDashboard und Käufer-Ansicht nach Bestätigung prominent: „⏳ Noch X Std. — schliesst euren Deal zu „[Titel]" ab, sonst geht er automatisch zurück in den Markt und jemand anderes greift zu." Quelle: listings.reserved_until (eine Wahrheit, kein Nachrechnen aus confirmed_at). Bei pending sieht der Verkäufer: „⏳ Noch X Std., um die Anfrage anzunehmen."

TEIL 7 — Hinweis beim Erstellen (JJ-Anforderung): Im ChameleonForm (nur Tab Angebot, dezent unter dem Veröffentlichen-Bereich) UND im Erfolgs-Toast-Umfeld: „💛 Gut zu wissen: Sobald jemand kaufen möchte, ist dein Inserat 48 Std. für euch beide reserviert. Schau regelmässig vorbei — so entgeht dir kein Deal!" Faktisch wahr, empathisch, kein Druck.

TEIL 8 — Entwürfe in 1 Klick (JJ-Anforderung): Auf /profile ein direkt sichtbarer Button „📝 Entwürfe (n)" (n = Anzahl eigener Drafts; bei 0 ausblenden oder ohne Zahl), der Meine Inserate DIREKT im Entwürfe-Tab öffnet (Tab-Vorwahl per Prop/Query-Param — kein zweiter Klick nötig).

TEIL 9 — Glocke: Notification-Typ 'tx_expiring' verlinkt aufs betroffene Inserat/den Deal (wie tx_pending). Lektion 1: neuer Datenproduzent (Cron) → Konsument (Glocke) im selben Block.

TEIL 10 — Aufräumen: src/components/create/AngebotForm.tsx und GesuchForm.tsx löschen (seit Block 10 ungenutzt — vorher per Grep beweisen, dass kein Import existiert).

TEIL 11 — E2E (e2e/block11-deal.spec.ts, Preflight nach Lektion 14, Cleanup vorher+nachher, Service-Role-REST für Seeds wie in block6):
1. Prefill: User B hinterlegt Telefon in profiles_private (Service-Role-Seed) → öffnet Kaufformular → Feld ist vorbefüllt; ändert Wert + „merken" → profiles_private aktualisiert.
2. Zahlungen-Tab: Test-IBAN CH9300762011623852957 wird akzeptiert; „CH00INVALID" zeigt exakte Fehlermeldung, Speichern blockiert sichtbar (Lektion 6).
3. Countdown Feed: A erstellt Angebot, B stellt Kaufanfrage → Karte zeigt „Reserviert — noch 48 Std." (bzw. 47/48-Toleranz) für einen DRITTEN Kontext (oder ausgeloggten Kontext — anon sieht reserved_until).
4. Wieder erhältlich: offene pending-Transaktion per Service-Role auf created_at = now()-49h rückdatieren → expire_stale_reservations per Service-Role-RPC aufrufen → Karte zeigt „🔄 Wieder erhältlich!", Status active, Detail kaufbar.
5. Vorwarnung: pending-Transaktion auf created_at = now()-43h rückdatieren → warn_expiring_reservations per Service-Role-RPC aufrufen → Verkäufer hat Notification Typ tx_expiring, Glocke verlinkt korrekt; zweiter Aufruf erzeugt KEINE zweite Notification (Idempotenz).
6. Foto-Upload (Testschuld Block 10): Angebot mit echtem Bild-Upload erstellen → Bild auf Detail sichtbar.
7. Entwürfe-Button: Draft anlegen → /profile zeigt „📝 Entwürfe (1)" → Klick landet direkt im Entwürfe-Tab.
Bestehende Specs dürfen nicht brechen (Erfolgs-Toasts und Flow aus Block 10 unverändert lassen).

ABSCHLUSS: tsc --noEmit + eslint 0 Errors, alle Specs headless grün → Commit (Vorschlag: „Block 11: Reibungsloser Deal — Prefill, Zahlungen, 48h-Countdown live, Wieder-erhältlich, Vorwarnung, Entwürfe-Schnellzugriff, E2E") — KEIN Push. Übergabe uebergabe-2026-07-19.md (BEWIESEN/UNGETESTET/ANGEFANGEN) + neue Lektionen in CLAUDE.md. Dann Testliste für JJ (Verify-Doppelklick).

---
Ende Startnachricht.

## 5. Verify-Testliste für JJ (nach grünem Verify)
1. Als Käufer auf ein Angebot: Kaufformular ist mit deinen Daten vorbefüllt.
2. Profil → Konto → Tab „Zahlungen": Test-IBAN CH93 0076 2011 6238 5295 7 speichern klappt; Fantasie-IBAN zeigt exakte Fehlermeldung.
3. Zweites Fenster (ausgeloggt): reserviertes Inserat zeigt „⏳ Reserviert — noch 48 Std." — und aktualisiert sich OHNE Reload, wenn im ersten Fenster reserviert wird.
4. Profil: Button „📝 Entwürfe" → ein Klick, du bist direkt im Entwürfe-Tab.
5. Neues Angebot erstellen: der 💛-48h-Hinweis ist sichtbar.
