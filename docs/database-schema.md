# Datenbank-Schema
> Status: ✅ Fertig (aus der echten Supabase-Datenbank ausgelesen)
> Zuletzt aktualisiert: 29.06.2026
> Projekt-Ref: `lhqsuelguwfdflapzdhk` · Region: EU (Paris)
> Abhängigkeiten: –

> ⚠️ Diese Datei ist die **Quelle der Wahrheit**. Sie wurde direkt aus der
> laufenden Datenbank generiert. Code MUSS sich an diese Namen halten.
> RLS ist auf ALLEN Tabellen aktiviert (`rls_enabled = true`).

---

## 0-B. Block 10 — Smarte Formulare (17./18.07.2026)

Ergänzungen durch Block 10 (Migrationen 10-1/10-2 vom Planungs-Chat live eingespielt,
Types via `gen types` neu generiert):

**`listings` — neue Spalten**
- `smart_data jsonb NULL` — kategorie-spezifische Match-Signale (nur befüllte Keys,
  z.B. `{ "g-farbe": ["Rot"], "g-groesse": "M", "verhandelbar": "Ja" }`). Fliesst in
  die Edge Function `calculate-smart-matches` (v5) ein.
- `gemeinden text[] NOT NULL DEFAULT '{}'` — eine oder mehrere Gemeinden. `gemeinde`
  (Singular, NOT NULL) bleibt die erste Auswahl (Kompatibilität mit Feed/Karte),
  `gemeinden` enthält alle. Bestehende 15 Inserate wurden auf `gemeinden = [gemeinde]`
  migriert.

**`listings.status = 'draft'`** — kein CHECK-Constraint; Entwürfe sind reguläre Zeilen.
Beim Entwurf erfüllen `category`/`gemeinde` NOT NULL als Leerstring (`''`).

**RLS-Policy „Listings: public select" (ersetzt)**
`USING (status <> 'draft' OR user_id = auth.uid())` — Entwürfe sind API-seitig NUR für
den Eigentümer sichtbar (Draft-Leak-Schutz, per E2E Test 2 bewiesen).

**Grant-Stand (gehärtet)**
- `listings`: `anon` = nur SELECT; `authenticated` = SELECT/INSERT/UPDATE/DELETE
  (RLS regelt Zeilenzugriff). Kein Schreibzugriff für `anon`.
- `wallet_transactions`: `anon` = nichts; `authenticated` = nur SELECT. Schreiben
  ausschliesslich über SECURITY-DEFINER-RPCs.

**Neue RPC `donate_coffee(p_amount_rappen bigint) → jsonb`**
SECURITY DEFINER, `search_path` fixiert, EXECUTE nur `authenticated`/`service_role`.
Atomarer Abzug (ein UPDATE mit Guthaben-Bedingung, kein Read-then-Write). Erlaubt
100/300/500/1000 Rappen. Wallet-Log Typ `'coffee'`. Antwort `{success, new_balance}`
bzw. `{success:false, error}` (freundlicher Text bei zu wenig Guthaben). Wird im
Provisions-Moment (Annahme eines Gratis-Inserats) vom Kaffee-Modal aufgerufen.

---

## 0. Wichtige Konventionen (zuerst lesen)

1. **Taler-Guthaben = `profiles.credits` (bigint).** Wird als **Rappen** behandelt:
   `1 Taler = 1 CHF = 100 credits`. Anzeige im Frontend immer `credits / 100`.
   Diese Umrechnung MUSS überall konsistent sein (auch beim 100-Taler-Onboarding-Bonus → `10000`).
2. **XP-Log-Tabelle heisst `xp_log`** – NICHT `xp_events`. (Plan an dieser Stelle korrigieren.)
3. **Geld-/Deal-Logik immer über die fertigen RPC-Funktionen** (Abschnitt 3), nie von Hand nachbauen.
4. **`user_id` nie vom Client** – immer serverseitig via `auth.getUser()`.

---

## 1. Tabellen (public)

### `profiles`  (PK: `id` → `auth.users.id`)
| Spalte | Typ | Default / Notiz |
|---|---|---|
| id | uuid | = auth.users.id |
| username | text | unique |
| full_name | text | nullable |
| avatar_url | text | nullable |
| gemeinde | text | nullable |
| xp_points | integer | 0 |
| level | text | nullable |
| credits | bigint | 0 · **Rappen** (siehe Konventionen) |
| avg_rating | numeric | nullable · via Trigger |
| review_count | integer | 0 |
| pioneer_badge | boolean | false |
| strikes | integer | 0 |
| is_banned | boolean | false |
| can_buy | boolean | true |
| referral_code | text | nullable |
| preferred_categories | text[] | nullable |
| stripe_customer_id | text | nullable |
| push_subscription | jsonb | nullable |
| referred_by | uuid | nullable → profiles.id |
| is_admin | boolean | false |
| email_notifications | boolean | true |
| push_notifications | boolean | true |
| profile_public | boolean | true |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

> Hinweis: `is_admin` existiert bereits → das `ALTER TABLE ... ADD is_admin` in Phase 4 ist überflüssig (schadet aber nicht dank `IF NOT EXISTS`).

### `listings`  (PK: `id`)
| Spalte | Typ | Default / Notiz |
|---|---|---|
| id | uuid | gen_random_uuid() |
| user_id | uuid | → profiles.id |
| title | text | |
| description | text | nullable |
| type | text | 'Angebot' / 'Gesuch' / 'Event' |
| status | text | 'active' (active/reserved/sold/draft/cancelled) |
| price | numeric | nullable |
| price_type | text | fixed/vhb/free/auction |
| category | text | |
| gemeinde | text | |
| image_url | text | nullable |
| image_urls | text[] | nullable |
| is_boosted | boolean | false |
| boost_expires_at | timestamptz | nullable |
| boost_type | text | nullable |
| boost_cost | bigint | nullable · Rappen |
| fomo_expires_at | timestamptz | nullable · via Trigger `set_fomo_on_sold` |
| views | integer | 0 |
| max_budget | numeric | nullable (Gesuche) |
| condition | text | nullable |
| pickup_available | boolean | true |
| shipping_available | boolean | false |
| shipping_cost | numeric | nullable |
| is_flagged | boolean | false |
| event_date | timestamptz | nullable (Events) |
| event_location | text | nullable |
| max_capacity | integer | nullable |
| current_bookings | integer | 0 |
| commitment_type | text | waitlist/reservation/deposit/ticket |
| ticket_price | numeric | nullable |
| deposit_amount | numeric | nullable |
| is_blurred | boolean | false |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

### `transactions`  (PK: `id`)
| Spalte | Typ | Default / Notiz |
|---|---|---|
| id | uuid | gen_random_uuid() |
| buyer_id | uuid | → profiles.id |
| seller_id | uuid | → profiles.id |
| listing_id | uuid | → listings.id |
| amount | numeric | |
| commission | numeric | |
| payment_method | text | cash/twint |
| buyer_contact | text | nullable |
| seller_contact | text | nullable |
| status | text | 'pending' (pending/confirmed/completed/escalated/cancelled) |
| created_at | timestamptz | now() |
| completed_at | timestamptz | nullable |

### `event_bookings`  (PK: `id`)
| Spalte | Typ | Default / Notiz |
|---|---|---|
| id | uuid | gen_random_uuid() |
| listing_id | uuid | → listings.id |
| user_id | uuid | → profiles.id |
| party_size | integer | 1 |
| quantity | integer | 1 |
| qr_code | text | nullable |
| commitment_type | text | nullable |
| status | text | 'confirmed' (confirmed/used/cancelled) |
| qr_validated_at | timestamptz | nullable |
| created_at | timestamptz | now() |

### `notifications`  (PK: `id`)
| Spalte | Typ | Default / Notiz |
|---|---|---|
| id | uuid | gen_random_uuid() |
| recipient_id | uuid | → profiles.id |
| title | text | nullable |
| message | text | nullable |
| type | text | nullable |
| is_read | boolean | false |
| listing_id | uuid | nullable → listings.id |
| created_at | timestamptz | now() |

### `wallet_transactions`  (PK: `id`)
| Spalte | Typ | Default / Notiz |
|---|---|---|
| id | uuid | gen_random_uuid() |
| user_id | uuid | → profiles.id |
| amount | bigint | · Rappen (positiv = Eingang, negativ = Abzug) |
| type | text | purchase/commission/boost/referral_bonus/refund |
| description | text | nullable |
| stripe_payment_intent_id | text | nullable · für Idempotenz |
| listing_id | uuid | nullable → listings.id |
| created_at | timestamptz | now() |

### `reviews`  (PK: `id`)
| Spalte | Typ | Default / Notiz |
|---|---|---|
| id | uuid | gen_random_uuid() |
| reviewer_id | uuid | → profiles.id |
| reviewee_id | uuid | → profiles.id |
| listing_id | uuid | → listings.id |
| transaction_id | uuid | → transactions.id |
| rating | integer | 1–5 |
| comment | text | nullable |
| created_at | timestamptz | now() |

> `update_avg_rating`-Trigger aktualisiert `profiles.avg_rating` automatisch.

### `smart_matches`  (PK: `id`)
| Spalte | Typ | Default / Notiz |
|---|---|---|
| id | uuid | gen_random_uuid() |
| gesuch_id | uuid | → listings.id |
| matched_listing_id | uuid | → listings.id |
| user_id | uuid | → profiles.id |
| score | integer | 0 |
| dismissed | boolean | false |
| created_at | timestamptz | now() |

> Für `upsert(onConflict: 'gesuch_id,matched_listing_id')` muss eine Unique-Constraint auf diesen beiden Spalten existieren → vor Phase 2/3 prüfen.
>
> **Grant-Stand (Block 9, vom Planungs-Chat live bewiesen):** `authenticated`
> hat auf `smart_matches` nur **SELECT + UPDATE** (own-only via RLS über
> `user_id`), **kein INSERT/DELETE**. Zeilen schreibt ausschliesslich die Edge
> Function `calculate-smart-matches` (Service-Role).

### `xp_log`  (PK: `id`)  ⚠️ NICHT `xp_events`
| Spalte | Typ | Default / Notiz |
|---|---|---|
| id | uuid | gen_random_uuid() |
| user_id | uuid | |
| amount | integer | |
| reason | text | nullable |
| idempotency_key | text | nullable |
| created_at | timestamptz | now() |

---

## 2. Trigger

| Trigger-Funktion | Zweck |
|---|---|
| `handle_new_user()` | Legt bei Registrierung automatisch ein `profiles`-Zeile an |
| `set_fomo_on_sold()` | Setzt `listings.fomo_expires_at` automatisch wenn Status → 'sold' |
| `set_created_at()` | Setzt Zeitstempel |
| `update_avg_rating()` | Aktualisiert `profiles.avg_rating` nach neuer Bewertung |

---

## 3. RPC-Funktionen (alle SECURITY DEFINER, ausser wo vermerkt)

> Diese Funktionen IMMER aufrufen statt die Logik im App-Code nachzubauen.

| Funktion | Argumente | Rückgabe | Zweck |
|---|---|---|---|
| `award_xp` | `p_user_id uuid, p_amount int, p_reason text, p_idempotency_key text` | void | XP vergeben (idempotent über `idempotency_key`) |
| `process_transaction_commission` | `p_transaction_id uuid, p_seller_id uuid` | jsonb | Provision in Talern atomar abziehen (Verkäufer-Bestätigung) |
| `complete_transaction` | `p_transaction_id uuid, p_seller_id uuid` | jsonb | **Deal atomar abschliessen.** ⚠️ Plan baut das aktuell von Hand nach → stattdessen diese RPC nutzen |
| `escalate_no_show` | `p_transaction_id uuid, p_seller_id uuid` | jsonb | No-Show: Provision zurück + Strike |
| `send_notification` | `p_recipient_id uuid, p_title text, p_message text, p_type text, p_listing_id uuid` | void | Benachrichtigung erstellen (umgeht RLS-Insert-Sperre) |
| `get_transaction_contact` | `p_transaction_id uuid` | record | **Kontaktdaten sicher abrufen** (nur Beteiligte, nur nach Freigabe). ⚠️ Plan liest aktuell die Tabelle direkt → stattdessen diese RPC nutzen |
| `get_my_profile` | – | profiles | Eigenes Profil sicher laden |
| `handle_new_user` | – | trigger | (Trigger, siehe oben) |
| `update_avg_rating` | – | trigger | (Trigger, siehe oben) |
| `set_fomo_on_sold` | – | trigger | (Trigger, siehe oben) |
| `set_created_at` | – | trigger | (Trigger, siehe oben) |

---

## 4. Offene Prüf-Punkte für die Plan-Korrektur

- [ ] Phase 3: `xp_events` → überall in `xp_log` umbenennen
- [ ] Phase 2: `completeTransaction` (App-Action) auf RPC `complete_transaction` umstellen
- [ ] Phase 2: `ContactSection` auf RPC `get_transaction_contact` umstellen
- [ ] Phase 4: doppelten `case 'checkout.session.completed'` entfernen (toter Code)
- [ ] Phase 4: Taler-Gutschrift atomar machen (kein Read-then-Write auf `credits`)
- [x] Phase 3/4: KI-Modellnamen gegen aktuell verfügbare Modelle prüfen → zentrale Konstante `CLAUDE_MODEL = 'claude-sonnet-4-6'` in `src/lib/ai.ts` (alter Wert `claude-sonnet-4-20250514` war deprecated)
- [ ] `smart_matches`: Unique-Constraint auf (`gesuch_id`, `matched_listing_id`) verifizieren
- [ ] Onboarding-Bonus 5 Taler = `500` credits (Rappen) sicherstellen
