# CLAUDE.md — Zentrale Steuerungsdatei Uri-Markt
> ⚠️ PFLICHT: Diese Datei bei JEDEM Start einer neuen Sitzung zuerst lesen.
> Danach die referenzierten Dateien lesen die zur aktuellen Aufgabe relevant sind.

---

## 🎯 Was ist dieses Projekt?

**Uri-Markt** – Hyperlokaler, werbefreier, gamifizierter Marktplatz für den Kanton Uri (Schweiz).
- Slogan: *„Regional – Genau was es brucht!"*
- Betreiber: Einzelperson, Solo
- Stack: Next.js 14 · Supabase · Stripe · Claude API · Vercel

---

## 📁 Pflichtlektüre vor dem Arbeiten

### Immer lesen:
| Datei | Inhalt |
|---|---|
| `DEVELOPMENT_GUIDELINES.md` | Code-Stil, Konventionen, Architekturentscheidungen, Sicherheitsregeln |

### Vor dem Arbeiten an einem Feature lesen:
| Feature | Datei |
|---|---|
| Feed, Listings, TikTok-Scroll | `docs/feed.md` |
| Auth, Onboarding | `docs/auth-onboarding.md` |
| Inserat erstellen (Angebot/Gesuch/Event) | `docs/create-listing.md` |
| Deal-Flow (Kaufen/Verkaufen/Kontakt) | `docs/deal-flow.md` |
| Gamification (XP, Level, Badges) | `docs/gamification.md` |
| Uri-Taler Wallet | `docs/wallet.md` |
| Event-Tickets & QR-System | `docs/events-tickets.md` |
| Smart Match System | `docs/smart-match.md` |
| KI-Features (Text-Booster, Matching) | `docs/ai-features.md` |
| Notifications (Push, E-Mail, In-App) | `docs/notifications.md` |
| Profil & öffentliches Profil | `docs/profile.md` |
| Stripe-Integration | `docs/stripe.md` |
| Admin-Panel | `docs/admin.md` |
| DSGVO & Datenschutz | `docs/dsgvo.md` |

### Datenbank & Architektur:
| Datei | Inhalt |
|---|---|
| `docs/database-schema.md` | Vollständiges DB-Schema, RLS-Policies, RPC-Funktionen |
| `docs/architecture.md` | Systemarchitektur, Patterns, Entscheidungen |

---

## 🔑 Kritische Regeln (Zusammenfassung)

> Details in `DEVELOPMENT_GUIDELINES.md`

1. **`user_id` NIEMALS vom Client** – immer `supabase.auth.getUser()` serverseitig
2. **Taler NIEMALS direkt in DB** – immer via RPC `process_transaction_commission`
3. **Kontaktdaten NIEMALS via CSS verstecken** – Freischaltung nur via RLS
4. **Stripe Webhooks IMMER signieren** – `stripe.webhooks.constructEvent()`
5. **Vor jedem neuen Feature** – Feature-Doku in `/docs` lesen oder anlegen

---

## ⚙️ Tech Stack (FINAL – nicht ändern ohne Rückfrage)

```
Frontend:    Next.js 14 (App Router) + TypeScript
Styling:     Tailwind CSS + shadcn/ui
State:       Zustand
Forms:       React Hook Form + Zod
Backend:     Supabase (PostgreSQL, Auth, Storage, Realtime, Edge Functions)
Payments:    Stripe
AI:          Claude API (claude-sonnet-4-6 · zentral in src/lib/ai.ts)
E-Mail:      Resend
Hosting:     Vercel (mit GitHub CI/CD)
```

---

## 🌍 Lokalisierung

- Sprache: Deutsch (Schweizer Stil: „Hoi", „Merci", „brucht")
- Währung: CHF (immer 2 Dezimalstellen: `CHF 12.50`)
- Zeitzone: `Europe/Zurich`
- Datumsformat: `dd.MM.yyyy` (z.B. `27.05.2026`)

---

## 📦 Umgebungsvariablen (.env.local)

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # NUR SERVER – nie im Frontend!

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=                  # NUR SERVER
STRIPE_WEBHOOK_SECRET=              # NUR SERVER

# Claude AI
ANTHROPIC_API_KEY=                  # NUR SERVER

# Resend
RESEND_API_KEY=                     # NUR SERVER

# App
NEXT_PUBLIC_APP_URL=https://uri-markt.vercel.app
```

---

## 📋 Aktueller Projektstatus

> Diese Sektion nach jeder abgeschlossenen Phase aktualisieren.

| Phase | Status | Beschreibung |
|---|---|---|
| Phase 1 – Fundament | ✅ Abgeschlossen | Setup, Auth, Feed-Basis, Inserat erstellen |
| Phase 2 – Kern-Features | ✅ Abgeschlossen | Deal-Flow, Gamification, FOMO, Gesuche, Profil, Notifications |
| Phase 3 – KI + Events + Wallet | ⏳ Ausstehend | Claude AI, Tickets, QR, Notifications |
| Phase 4 – Stripe + Launch | ⏳ Ausstehend | Echte Zahlungen, DSGVO, PWA, Admin |

**Legende:** ✅ Abgeschlossen · 🔄 In Arbeit · ⏳ Ausstehend · ❌ Blockiert

### Design / Aufgaben-Log

- **Aufgabe A** (30.06.2026, Commit `77976e2`): 7 Korrekturen, u.a. Taler in Rappen, zentrale KI-Modellkonstante. ✅
- **Aufgabe B** (30.06.2026): Marktplatz-/Feed-Screen exakt nach `docs/design/design-referenz.html` gebaut – Hero mit echtem Bergpanorama + Ken-Burns-Zoom, Gold-Stier-Logo, Typ-Tabs, FOMO-Streifen, animierte Inserate-Karten (Badges, Herz, Hover-Lift, Live-Zähler, Gold-Sweep), Event-Karte (Countdown, Fortschrittsbalken, Scarcity), BottomNav. Effekte = reine Optik über der Logik. Details: `docs/feed.md`. ✅ (noch nicht gepusht)
- **Bug-Session 01** (02.07.2026): 6 Bugs abgearbeitet (Auftrag `bugfix-anweisung-01.md`). BUG 1 Feed-Refresh nach Erstellen (Store `feedVersion` + `router.refresh()`). BUG 2 Gesuch-Feed – Typwerte/Filter/Render bereits konsistent, wird durch BUG-1-Fix sofort sichtbar (gegen Live-DB verifiziert). BUG 3 Header-Profil-Dropdown (`ProfileMenu`, inkl. wieder vorhandenem Abmelden). BUG 4 Bottom-Nav Profil war bereits korrekt verlinkt. BUG 5 View-Zähler-Endlosschleife behoben (Ref-Guard, real 9636 → +1/Öffnung). BUG 6 Käufer-Text „provisionsfrei" + `create_buy_intent` als **SECURITY-DEFINER-Migration** (`supabase/migrations/20260702121132_create_buy_intent.sql`) – Einheiten gegen Live-RPC verifiziert. ⚠️ Migration noch nicht eingespielt (kein Supabase-MCP in Session). Commits lokal, KEIN Push.
- **Bug-Session 03** (02.07.2026): Auth-Session-Bug (Login wirkt sofort wieder ausgeloggt) — Root Cause gefunden und behoben: `middleware.ts` lag im Projekt-Root, aber die App nutzt `src/` → Next.js hat die Middleware **stillschweigend ignoriert** (lief in keinem Request, Session wurde serverseitig nie refresht). Fix: nach `src/middleware.ts` verschoben und dabei von der veralteten `get/set/remove`-Cookie-API auf `getAll`/`setAll` umgebaut (Pflicht ab `@supabase/ssr` 0.9). `src/lib/supabase/server.ts` war bereits korrekt (`await cookies()`, `getAll`/`setAll`, alle Aufrufer mit `await`) — dort keine Änderung. Beweis: Build listet jetzt `ƒ Middleware` (vorher fehlte der Eintrag). `tsc` + `build` grün. Commit lokal, KEIN Push.
- **Bug-Session 02** (02.07.2026, Commit `c3d441d`): `create_buy_intent`-Migration ist laut JJ live eingespielt. BUG 2 erneut geprüft – Kauf-Flow und Gesuch-Feed durchgehend konsistent (Typwerte `Angebot`/`Gesuch`/`Event` identisch in `src/types`, Feed-Filter, Erstellung; `ListingCard` rendert Gesuche sauber). Drift beseitigt: `createBuyIntentAction` ruft die RPC jetzt **getypt** mit exakt den 3 Live-Argumenten auf (`p_listing_id`, `p_payment_method`, `p_buyer_contact`) – kein `p_buyer_id`, kein `as any`, keine Betrag/Provisions-Rechnung im Client; bei `success === false` wird `data.error` geworfen. Veraltete 4-Argument-Definition in `src/types/database.ts` von Hand auf die 3-Argument-Version korrigiert (⚠️ `gen types` ohne Access-Token/MCP nicht möglich – bei nächster Gelegenheit sauber neu generieren). `tsc` + `build` grün. Commit lokal, KEIN Push.

---

## 🔄 Workflow für Claude Code

```
1. CLAUDE.md lesen (diese Datei)
2. DEVELOPMENT_GUIDELINES.md lesen
3. Relevante /docs/*.md Dateien lesen
4. Aufgabe umsetzen
5. /docs/*.md aktualisieren wenn Feature geändert/hinzugefügt
6. CLAUDE.md Projektstatus aktualisieren
```
