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
AI:          Claude API (claude-sonnet-4-20250514)
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
| Phase 1 – Fundament | 🔄 In Arbeit | Setup, Auth, Feed-Basis, Inserat erstellen |
| Phase 2 – Kern-Features | ⏳ Ausstehend | Deal-Flow, Gamification, FOMO, Gesuche |
| Phase 3 – KI + Events + Wallet | ⏳ Ausstehend | Claude AI, Tickets, QR, Notifications |
| Phase 4 – Stripe + Launch | ⏳ Ausstehend | Echte Zahlungen, DSGVO, PWA, Admin |

**Legende:** ✅ Abgeschlossen · 🔄 In Arbeit · ⏳ Ausstehend · ❌ Blockiert

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
