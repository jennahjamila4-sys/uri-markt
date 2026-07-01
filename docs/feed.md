# Feed / Marktplatz
> Status: ✅ Fertig
> Zuletzt aktualisiert: 30.06.2026
> Abhängigkeiten: auth-onboarding, create-listing

## Übersicht

Der Marktplatz-/Feed-Screen ist der Startbildschirm (`/`). Er ist exakt nach der
verbindlichen Design-Referenz `docs/design/design-referenz.html` gebaut:
dunkles Glass-/Gold-Design, echtes Uri-Bergpanorama als Hero und FOMO-optimierte,
animierte Inserate-Karten.

**Leitprinzip:** Alle visuellen Effekte sind reine Optik und liegen ÜBER der
Funktion – sie ersetzen niemals die Logik (echte Daten, RLS, Filter bleiben
unangetastet).

## Dateien

- `app/page.tsx` – Server-Komponente: lädt erste 20 Inserate (Server), rendert Header → Hero → FeedPage → CreateModal → BottomNav
- `components/feed/Hero.tsx` – Bergpanorama-Hero (Ken-Burns-Zoom, Gold-Sheen, Pionier-Scarcity). Statisch, keine Logik.
- `components/feed/TypeTabs.tsx` – Tabs Angebote/Gesuche/Vorankündigungen mit gleitender Gold-Pille; steuert echten Typ-Filter
- `components/feed/CategoryFilter.tsx` – Kategorie-Chips (Zusatz-Filter unter den Tabs)
- `components/feed/FomoZone.tsx` – „Kürzlich verpasst": verkaufte Inserate im 24h-Fenster, Stempel-Optik
- `components/feed/ListingCard.tsx` – Standard-Karte (Angebot/Gesuch): Badges, Herz, Hover-Lift, Live-Zähler, Gold-Sweep bei Boost
- `components/feed/EventCard.tsx` – Vorankündigungs-/Event-Karte: Countdown, Fortschrittsbalken, Plätze-Scarcity
- `components/feed/FeedPage.tsx` – Client: Typ-/Kategorie-Filter, Infinite-Scroll (Cursor), Rendering der Karten
- `components/feed/TikTokScroll.tsx` – Vollbild-Scroll-Modus über die Inserate
- `components/layout/Header.tsx` – Gold-Stier-Logo, Bell (Beacon bei ungelesenen), Anmelden/Profil
- `components/layout/BottomNav.tsx` – Marktplatz / Erstellen (Gold-Button) / Profil
- `app/globals.css` – zentrale Effekt-Klassen (Abschnitt „DESIGN-REFERENZ-EFFEKTE")
- `docs/feed.md` – diese Datei

## Datenbank

Liest nur aus `listings` (+ Join `profiles`). Keine Mutationen im Feed selbst.

- Feed-Query: `status IN ('active','sold')`, `type = <Tab>`, optional `category`,
  sortiert nach `is_boosted` dann `created_at`, Cursor-Pagination über `created_at`.
  Selektierte Felder inkl. Event-Spalten: `event_date, event_location, max_capacity,
  current_bookings, ticket_price`.
- FOMO-Query: `status = 'sold'` und `fomo_expires_at > now()` (24h-Fenster, via
  Trigger `set_fomo_on_sold` gesetzt).

## Sicherheit

- Reiner Lesezugriff; RLS auf `listings` schützt die Datenbasis serverseitig.
- Keine Kontaktdaten im Feed (Freischaltung erst im Deal-Flow via RLS/RPC).
- Effekte verstecken keine Daten per CSS – sie zeigen nur, was die Query liefert.

## Effekte (reine Optik – Referenz-Mapping)

| Effekt | Umsetzung | Datenbasis |
|---|---|---|
| Bergpanorama + langsamer Zoom | `Hero` + `.kenburns` | statisch (`public/uri-markt-alps-banner.jpg`) |
| Gestaffeltes Einblenden | `.reveal` + `animationDelay` (separater Wrapper, damit Hover-Lift erhalten bleibt) | – |
| FOMO-Streifen „Kürzlich verpasst" | `FomoZone` + `.animate-stamp` | echt (`fomo_expires_at`) |
| Live-Zähler „X schauen gerade" | `ListingCard` › `LiveViewers` | **Optik**: deterministisch aus Listing-ID geseedet, schwankt clientseitig |
| Augen-Zähler | `ListingCard`/`EventCard` | echt (`views`) |
| Countdown | `EventCard` | echt (`event_date`) |
| Fortschrittsbalken | `EventCard` + `.prog-shimmer` | echt (`current_bookings`/`max_capacity`) |
| Gold-Rand-Highlight | `.gold-sweep` | echt (`is_boosted`) |
| Hover-Lift / Media-Zoom | Tailwind `hover:` + `ease-smooth` | – |
| Herz-Animation | `.heart-pop` | **Optik**: visueller Toggle (keine Favoriten-Tabelle) |
| Scarcity / Pionier-Badge | `.animate-scarce` | **Optik**: Marketing-Zahl (Prop) |
| „Erinnere mich" | `EventCard` | **Optik**: visueller Toggle (kein Reminder-Backend) |

## Bekannte Einschränkungen / TODOs

- [ ] Herz/„Merken" hat keine Persistenz → echte Favoriten-Tabelle + RLS, falls gewünscht.
- [ ] „X schauen gerade" ist FOMO-Optik (kein echtes Concurrency-Tracking).
- [ ] „Erinnere mich" auf Events an echte Reminder-/Notification-Logik koppeln.
- [ ] Profil-/Verkäufer-Zeile bewusst aus den Grid-Karten entfernt (nur im Detail). Bei Bedarf zurückholen.
- [ ] Desktop: Grid ist 2-spaltig (mobil-first, Referenz), ab `lg` 3-spaltig – kein strenger 430px-Phone-Frame erzwungen.
- [ ] DB-Typen (`src/types/database.ts`) sind insgesamt noch unvollständig gegenüber `database-schema.md`; bisher nur die 5 Event-Spalten nachgezogen.
