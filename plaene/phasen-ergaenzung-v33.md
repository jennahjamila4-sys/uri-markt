# PHASEN-ERGÄNZUNG V33 – ALLE FUNKTIONEN DER ALTEN APP (verbindlich)
> Additiv zu den v2-Plänen (Phase 2/3/4). Ersetzt NICHTS, ergänzt nur.
> Quelle: vollständige Analyse von `Uri_V33.html` (12'882 Zeilen, ~250 Funktionen) + Live-DB-Abgleich am 06.07.2026.
> Entscheidung JJ: ALLE V33-Funktionen bleiben erhalten.
> Live-DB-Befund: Auktions-Spalten, `bids`, `coffee_donations`, `smart_data`, private Kontaktfelder existieren noch NICHT → Migrationen unten.

---

## TEIL 1 – BEWUSSTE KORREKTUREN GEGENÜBER V33 (Sicherheit, nicht Geschmack)

Diese vier Dinge werden ANDERS gebaut als in V33 — die Funktion für den Nutzer bleibt identisch:

1. **Private Daten raus aus `profiles`.** Die Live-Policy `profiles_select_all` macht ALLE profiles-Spalten öffentlich lesbar. V33 speicherte Telefon, Adresse, IBAN und Twint-Nummer in `profiles` — das wäre in der neuen App ein öffentliches Datenleck. → Neue Tabelle `profiles_private` (RLS: nur der Eigentümer), Migration V33-2.
2. **Taler-Einheit.** V33 rechnete CHF 1 = 10 Credits. Die neue DB-Wahrheit ist: 1 Taler = 1 CHF = **100 Rappen** (`profiles.credits` bigint). Alle V33-Beträge sind umgerechnet (Coffee CHF 1 = 100 Rappen usw.). NIE V33-Zahlen 1:1 kopieren.
3. **Auktionen atomar.** V33 machte Gebote clientseitig (Read-then-Write, PATCH auf fremde Listings — das scheitert an der Live-RLS `listings_update_own` ohnehin). → RPC `place_bid` / `auction_buy_now`, Abwicklung abgelaufener Auktionen serverseitig per Cron (Migration V33-1).
4. **Kein CSS/Client als Schutz.** Kontaktfreigabe, Guthaben, Kapazitäten: ausschliesslich RPC/RLS (gilt schon, hier nur bekräftigt).

---

## TEIL 2 – DB-MIGRATIONEN (via Supabase-MCP im Planungs-Chat, mit JJ-OK; Claude Code prüft nur Existenz)

### Migration V33-1: Auktionen
```sql
alter table public.listings
  add column if not exists auction_end     timestamptz,
  add column if not exists current_bid     numeric,
  add column if not exists bid_count       integer not null default 0,
  add column if not exists buyout_price    numeric,
  add column if not exists auction_winner  uuid references public.profiles(id),
  add column if not exists smart_data      jsonb;

create table if not exists public.bids (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id    uuid not null references public.profiles(id),
  amount     numeric not null check (amount > 0),
  created_at timestamptz not null default now()
);
create index if not exists idx_bids_listing on public.bids (listing_id, amount desc);

alter table public.bids enable row level security;
create policy bids_select_own_or_seller on public.bids for select
  using (
    user_id = auth.uid()
    or exists (select 1 from public.listings l where l.id = listing_id and l.user_id = auth.uid())
  );
-- Kein INSERT/UPDATE/DELETE für User: Gebote entstehen NUR über die RPC.
grant select on public.bids to authenticated;

-- Atomares Gebot: Zeilen-Lock, Mindestgebots-Staffel wie V33 (+5 / +10 / +25)
create or replace function public.place_bid(
  p_listing_id uuid,
  p_amount     numeric
) returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare
  v_user_id  uuid := auth.uid();
  v_l        record;
  v_cur      numeric;
  v_min      numeric;
begin
  if v_user_id is null then
    return jsonb_build_object('success', false, 'error', 'Nicht angemeldet');
  end if;

  select id, user_id, title, status, price, current_bid, bid_count, auction_end
    into v_l
  from public.listings where id = p_listing_id for update;

  if v_l.id is null then return jsonb_build_object('success', false, 'error', 'Inserat nicht gefunden'); end if;
  if v_l.auction_end is null then return jsonb_build_object('success', false, 'error', 'Keine Auktion'); end if;
  if v_l.status <> 'active' then return jsonb_build_object('success', false, 'error', 'Auktion nicht aktiv'); end if;
  if v_l.auction_end < now() then return jsonb_build_object('success', false, 'error', 'Auktion abgelaufen'); end if;
  if v_l.user_id = v_user_id then return jsonb_build_object('success', false, 'error', 'Eigene Auktion nicht bietbar'); end if;

  v_cur := coalesce(v_l.current_bid, v_l.price, 0);
  v_min := v_cur + case when v_cur < 100 then 5 when v_cur < 500 then 10 else 25 end;
  if p_amount < v_min then
    return jsonb_build_object('success', false, 'error', 'Mindestgebot: CHF ' || v_min::text, 'min_bid', v_min);
  end if;

  insert into public.bids (listing_id, user_id, amount) values (p_listing_id, v_user_id, p_amount);

  update public.listings
  set current_bid = p_amount, bid_count = coalesce(bid_count, 0) + 1
  where id = p_listing_id;

  perform public.send_notification(v_l.user_id, '🔨 Neues Gebot!',
    'CHF ' || p_amount::text || ' auf „' || v_l.title || '".', 'new_bid', p_listing_id);

  return jsonb_build_object('success', true, 'current_bid', p_amount, 'bid_count', coalesce(v_l.bid_count,0) + 1);
end;
$$;

-- Sofort-Kauf: beendet die Auktion und erzeugt einen normalen Deal (pending, Verkäufer bestätigt)
create or replace function public.auction_buy_now(
  p_listing_id    uuid,
  p_buyer_contact text
) returns jsonb
language plpgsql security definer set search_path to ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_l       record;
  v_tx_id   uuid;
begin
  if v_user_id is null then return jsonb_build_object('success', false, 'error', 'Nicht angemeldet'); end if;

  select id, user_id, title, status, buyout_price, auction_end
    into v_l from public.listings where id = p_listing_id for update;

  if v_l.id is null or v_l.auction_end is null or v_l.buyout_price is null
     then return jsonb_build_object('success', false, 'error', 'Kein Sofort-Kauf möglich'); end if;
  if v_l.status <> 'active' then return jsonb_build_object('success', false, 'error', 'Nicht mehr verfügbar'); end if;
  if v_l.user_id = v_user_id then return jsonb_build_object('success', false, 'error', 'Eigenes Inserat'); end if;

  insert into public.transactions
    (listing_id, buyer_id, seller_id, amount, commission, payment_method, status, buyer_confirmed, seller_confirmed, buyer_contact)
  values
    (p_listing_id, v_user_id, v_l.user_id, v_l.buyout_price, round(v_l.buyout_price * 0.10, 2),
     'twint', 'pending', true, false, p_buyer_contact)
  returning id into v_tx_id;

  update public.listings
  set status = 'reserved', auction_winner = v_user_id
  where id = p_listing_id;

  perform public.send_notification(v_l.user_id, '⚡ Sofort-Kauf!',
    '„' || v_l.title || '" wurde per Sofort-Kauf angefragt. Bitte bestätigen.', 'buy_intent', p_listing_id);

  return jsonb_build_object('success', true, 'transaction_id', v_tx_id);
end;
$$;

-- Abgelaufene Auktionen abwickeln (Cron): Gewinner → normaler pending-Deal; 0 Gebote → expired
create or replace function public.settle_expired_auctions()
returns jsonb language plpgsql security definer set search_path to ''
as $$
declare
  v_l       record;
  v_top     record;
  v_settled integer := 0;
begin
  for v_l in
    select id, user_id, title, current_bid, bid_count
    from public.listings
    where auction_end is not null and auction_end < now() and status = 'active'
    for update skip locked
  loop
    if coalesce(v_l.bid_count, 0) = 0 then
      update public.listings set status = 'expired' where id = v_l.id;
      perform public.send_notification(v_l.user_id, '⏰ Auktion abgelaufen',
        '„' || v_l.title || '" endete ohne Gebot. Du kannst sie im Profil reaktivieren.', 'system', v_l.id);
    else
      select user_id, amount into v_top
      from public.bids where listing_id = v_l.id
      order by amount desc, created_at asc limit 1;

      insert into public.transactions
        (listing_id, buyer_id, seller_id, amount, commission, payment_method, status, buyer_confirmed, seller_confirmed, buyer_contact)
      values
        (v_l.id, v_top.user_id, v_l.user_id, v_top.amount, round(v_top.amount * 0.10, 2),
         'twint', 'pending', true, false, '');

      update public.listings set status = 'reserved', auction_winner = v_top.user_id where id = v_l.id;

      perform public.send_notification(v_l.user_id, '🔨 Auktion beendet!',
        '„' || v_l.title || '" ging für CHF ' || v_top.amount::text || ' weg. Bitte Deal bestätigen.', 'system', v_l.id);
      perform public.send_notification(v_top.user_id, '🏆 Auktion gewonnen!',
        'Du hast „' || v_l.title || '" für CHF ' || v_top.amount::text || ' gewonnen.', 'system', v_l.id);
    end if;
    v_settled := v_settled + 1;
  end loop;
  return jsonb_build_object('success', true, 'settled', v_settled);
end;
$$;
revoke execute on function public.settle_expired_auctions() from public, anon, authenticated;

-- Zeitplan (Supabase: Extension pg_cron muss im Dashboard aktiviert sein):
-- select cron.schedule('settle-auctions', '*/5 * * * *', $$select public.settle_expired_auctions()$$);
```
Hinweis Gewinner-Kontakt: Beim Cron-Abschluss ist kein `buyer_contact` vorhanden. Der Gewinner wird per Notification aufgefordert, den Kauf in „Schnäppchen-Jagd" zu bestätigen und dort seinen Kontakt zu hinterlegen (UPDATE der eigenen Transaktion, RLS-konform), bevor der Verkäufer bestätigt.

### Migration V33-2: Private Konto-Daten (Angaben + Zahlungen)
```sql
create table if not exists public.profiles_private (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  salutation      text,
  birth_date      date,
  phone           text,
  address         text,
  city            text,
  billing_address text,
  pay_bar         boolean not null default true,
  pay_twint       boolean not null default false,
  twint_nr        text,
  pay_bank        boolean not null default false,
  iban            text,
  updated_at      timestamptz not null default now()
);
alter table public.profiles_private enable row level security;
create policy pp_select_own on public.profiles_private for select using (user_id = auth.uid());
create policy pp_insert_own on public.profiles_private for insert with check (user_id = auth.uid());
create policy pp_update_own on public.profiles_private for update using (user_id = auth.uid());
grant select, insert, update on public.profiles_private to authenticated;

alter table public.profiles add column if not exists bio text;  -- öffentlich ok
```

### Migration V33-3: Coffee-Spende (Beträge in Rappen!)
```sql
create table if not exists public.coffee_donations (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id),
  amount_chf    numeric not null,
  amount_rappen bigint  not null,
  created_at    timestamptz not null default now()
);
alter table public.coffee_donations enable row level security;
create policy cd_select_own on public.coffee_donations for select using (user_id = auth.uid());
grant select on public.coffee_donations to authenticated;

create or replace function public.donate_coffee(p_amount_chf numeric)
returns jsonb language plpgsql security definer set search_path to ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_rappen  bigint;
  v_updated integer;
begin
  if v_user_id is null then return jsonb_build_object('success', false, 'error', 'Nicht angemeldet'); end if;
  if p_amount_chf not in (1, 3, 5, 10) then
    return jsonb_build_object('success', false, 'error', 'Ungültiger Betrag');
  end if;
  v_rappen := (p_amount_chf * 100)::bigint;

  update public.profiles set credits = credits - v_rappen
  where id = v_user_id and coalesce(credits, 0) >= v_rappen;
  get diagnostics v_updated = row_count;
  if v_updated = 0 then return jsonb_build_object('success', false, 'error', 'Nicht genug Taler'); end if;

  insert into public.coffee_donations (user_id, amount_chf, amount_rappen) values (v_user_id, p_amount_chf, v_rappen);
  insert into public.wallet_transactions (user_id, amount, type, description)
  values (v_user_id, -v_rappen, 'coffee', 'Kaffee-Spende ☕');

  return jsonb_build_object('success', true);
end;
$$;
```

### Migration V33-4: „Nur benachrichtigen" bei Vorankündigungen
```sql
create table if not exists public.event_reminders (
  listing_id uuid not null references public.listings(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);
alter table public.event_reminders enable row level security;
create policy er_all_own on public.event_reminders for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, delete on public.event_reminders to authenticated;
```

### Migration V33-5: Entwürfe dürfen nicht öffentlich lesbar sein
```sql
-- Die bestehende Policy "Listings: public select" macht ALLE Zeilen lesbar.
-- Mit Entwürfen (status='draft') wäre das ein Leak. Ersatz:
drop policy "Listings: public select" on public.listings;
create policy "Listings: public select" on public.listings for select
  using (status <> 'draft' or user_id = auth.uid());
```
Nach JEDER dieser Migrationen: Grant/RLS-Check (D2) und Supabase-Types neu generieren.

---

## TEIL 3 – FEATURE-SPEZIFIKATIONEN (1:1 aus V33 verifiziert)

### 3.1 Header-Dropdown oben rechts → **Phase-2-Nachtrag (sofort)**
Der Header-Button rechts zeigt ausgeloggt „Anmelden" (öffnet Auth-Modal), eingeloggt den Avatar/Namen (öffnet Dropdown). Dropdown-Inhalt exakt:
```
[Avatar] [Username]
         [Level-Name]                      ← z.B. „Lokal-Matador"
─────────────────────────────
🛒  🎯 Schnäppchen-Jagd                    → öffnet „Meine Käufe"-Screen (3.6)
🏪  💸 Loswerden & Verdienen               → öffnet „Meine Verkäufe"-Screen (3.6)
🪙  Uri Taler                              → öffnet Wallet
⚙️  Benutzerkonto                          → öffnet Konto-Modal (3.2)
🌍  Öffentliches Profil                    → /profile/[username]
🚪  Abmelden                               ← ROT (#ff4444), rote Hover-Fläche
```
Schliessen bei Klick ausserhalb. Bottom-Nav „Profil" bleibt zusätzlich bestehen (beides existierte in V33).

### 3.2 Benutzerkonto-Modal, 3 Tabs → **Phase-2-Nachtrag** (braucht Migration V33-2)
Vollbild-Modal, Tabs „Angaben | Zahlungen | Benachrichtigungen".
- **Angaben:** Anrede (Select), Name, Benutzername, Geburtsdatum, E-Mail (read-only), Mitglied-Nr. `URI-XXXXXXXX` (read-only, erste 8 Zeichen der User-ID), Telefonnummer, Strasse, PLZ/Ort, Rechnungsadresse, Sprache. Speichern: `username`/`full_name`/`bio` → `profiles`; alles Private → `profiles_private` (upsert). NIE Telefon/Adresse in `profiles`.
- **Zahlungen:** 3 Checkboxen mit Aufklapp-Feldern — 💵 Barzahlung, 📱 Twint (+ Twint-Nummer), 🏦 Bank (+ IBAN) → `profiles_private`. Darunter Taler-Stand + „TALER AUFLADEN"-Button (→ Wallet/Stripe, Phase 4).
- **Benachrichtigungen:** Toggles Kommentare / Matches / XP / News → `profiles` (`push_notifications`, `email_notifications`) statt V33s localStorage.

### 3.3 Inserat bearbeiten → **Phase-2-Nachtrag**
Owner-Aktion im Detail und in „Meine Inserate": Overlay mit Titel, Beschreibung, Preis (V33-Umfang). Regeln aus V33 übernehmen: nur Eigentümer (RLS `listings_update_own` erzwingt es zusätzlich); bei `status='reserved'` gesperrt mit Meldung „Während laufender Kaufanfrage nicht editierbar". Validierung: Titel ≥ 3 Zeichen, Preis ≥ 0.

### 3.4 Entwürfe → **Phase-2-Nachtrag** (braucht Migration V33-5)
„Als Entwurf speichern" im Erstellen-Formular → `status='draft'`. Tab „📝 Entwürfe" unter Meine Inserate/Verkäufe mit „Veröffentlichen" (→ `status='active'`) und „Löschen". Feed filtert weiterhin `status='active'` — Drafts erscheinen nie öffentlich (Policy V33-5 sichert das auch API-seitig).

### 3.5 Auktionen → **Phase 3** (braucht Migration V33-1)
- **Erstellen:** Im Angebot-Formular Preis-Modell-Umschalter „Fixpreis | Auktion" (V33 `setPriceModel`). Bei Auktion: Preis = Startpreis, Pflichtfeld „Auktion endet am" (datetime), optional „⚡ Sofort-Kaufen Preis". Hinweistext: „Provision = 10% vom Zuschlag."
- **Feed-Karte:** violettes Badge „🔨 Auktion", Leiste `🔨 CHF {current_bid} · {bid_count} Gebote | {Countdown}`.
- **Detail:** Block mit aktuellem Gebot, Anzahl Gebote, Countdown, Endzeitpunkt (de-CH, Europe/Zurich), optional Sofort-Kaufen-Zeile; Gebots-Input + „⚡ Bieten" → RPC `place_bid` (zeigt bei Fehler das Mindestgebot aus der RPC-Antwort); darunter „⚡ Sofort kaufen CHF X" → RPC `auction_buy_now` (danach normaler Deal-Flow: Verkäufer bestätigt, Provision via `process_transaction_commission`, Kontakt via `get_transaction_contact`).
- **Ablauf:** ausschliesslich serverseitig durch `settle_expired_auctions` (Cron alle 5 Min). Client zeigt nur an. Gewinner ergänzt seinen Kontakt in „Schnäppchen-Jagd", dann bestätigt der Verkäufer.
- **Realtime:** Supabase-Realtime auf `listings` aktualisiert `current_bid`/`bid_count` live in offenen Detail-Ansichten.

### 3.6 „Schnäppchen-Jagd" & „Loswerden & Verdienen" → **Phase 3**
Zwei Fullscreen-Overlays (wie V33), erreichbar NUR über das Dropdown:
- **🛒 Schnäppchen-Jagd (Meine Käufe):** Sektionen Offene Käufe (pending/confirmed, mit Status, 48h-Countdown der Reservierung, „Übergabe bestätigen" → RPC `complete_transaction`-Gegenstück des Käufers = bestehender Flow), Meine Gebote (aus `bids`, gewonnene markiert, Bieten direkt möglich), Meine Tickets (aus `event_bookings`, QR öffnen), Abgeschlossen (mit 5-Sterne-Bewertung inline, +5 XP).
- **🏪 Loswerden & Verdienen (Meine Verkäufe):** KPI-Kacheln (Aktiv / Verkauft / Umsatz), Tabs 🏷️ Aktiv | 📝 Entwürfe | 🏆 Verkauft. Pro Verkauf: Detail mit Käufer-Anfragen (Annehmen = `process_transaction_commission`, Ablehnen), laufende Auktionen mit Geboteliste (aus `bids`, nur eigene Listings — RLS-Policy deckt das), No-Show-Eskalation.

### 3.7 Smartes Gesuch (Chamäleon-Formular) → **Phase 3**, ersetzt die manuelle Kategorie-Wahl aus dem v2-GesuchForm
- **Erkennung:** Die komplette `categoryConfig` aus V33 wird 1:1 als TypeScript-Konstante übernommen (`src/lib/gesuchConfig.ts`): 9 Kategorien (Kleidung, Fahrzeuge, Elektronik, Immobilien, Jobs, Moebel, Sport, Events, Tiere), je Keyword-Liste + Felder (Typen: pills, toggle, slider, select, date, text, number). Erkennung ist lokales Keyword-Matching beim Tippen (kein API-Call, kostenlos, sofort) — genau wie V33. Optionaler KI-Fallback (CLAUDE_MODEL_FAST) nur, wenn nach 15+ Zeichen nichts erkannt wurde UND der Nutzer nicht manuell wählt.
- **UI:** Freitext „Was suchst du?" (+ Voice-Button) → bei Erkennung Banner „✨ Erkannt: [Kategorie]" + dynamische smarte Felder blenden ein; sonst Fallback-Select. Referenzbild-Upload (optional, Supabase Storage). Budget Von/Bis.
- **Speichern:** smarte Feldwerte als `smart_data` (jsonb) auf dem Listing; Kategorie gemappt auf die bestehenden Feed-Kategorien; danach wie gehabt `calculate-smart-matches`.
- **Anzeige:** Detail-Ansicht rendert `smart_data` als 2-Spalten-Grid (V33 `smart_data_block`) — auch bei Angeboten, falls vorhanden.

### 3.8 Coffee-Funktion → **Phase 3** (braucht Migration V33-3)
Nach erfolgreichem Gratis-Veröffentlichen eines Inserats erscheint das Modal „☕ Dein Inserat ist gratis!" mit Buttons CHF 1 / 3 / 5 / 10 und „Nein danke, gratis veröffentlichen". Spende → RPC `donate_coffee` (atomarer Abzug in Rappen, Wallet-Log Typ `coffee`). Bei zu wenig Guthaben: Fehlermeldung der RPC anzeigen, Veröffentlichung bleibt davon unberührt. Erscheint maximal 1× pro Veröffentlichung, nie blockierend.

### 3.9 Vorankündigungen: Smart-Routing → **Phase 3** (braucht Migration V33-4)
CTA auf Coming-Soon-Karten/Detail routet nach `commitment_type`:
- `ticket` → Stripe-Ticketkauf (Phase 4 `purchaseTicket`)
- `deposit` → Hinweis „Anzahlung" + Buchung via `book_event`
- `waitlist`/`reservation` → Wahl-Dialog: „🪑 Warteliste/Platz" (→ RPC `book_event`) oder „🔔 Nur benachrichtigen" (→ Insert `event_reminders`; beim Event-Start bzw. Statuswechsel benachrichtigt eine kleine Server-Routine alle Reminder via `send_notification`).

### 3.10 Kleinteile aus V33, verbindlich übernommen
- Öffentliches Profil als Overlay von überall (Klick auf Verkäufer) mit Tabs Inserate | Bewertungen.
- Avatar: Emoji-Auswahl UND Foto-Upload (V33 hatte beides; `avatar_url` existiert).
- „🔄 Wieder erhältlich"-Sticker, wenn eine Reservierung platzt und das Inserat reaktiviert wird.
- Teilen-Button mit Link-Kopieren (Web Share API + Clipboard-Fallback).
- Fehler-Panel „Fehler kopieren" (formatiziert für Support) statt roher Toasts bei unerwarteten Fehlern.
- Pull-to-Refresh im Feed; Reserviert-Countdown (48h) auf Karten; Zeichenzähler in Textfeldern.

---

## TEIL 4 – REIHENFOLGE & CHECKLISTE

Reihenfolge: 1) offene Bugfixes (Auth-Test, Gesuche-Tab, Feed-Duplikate) → 2) Migrationen V33-2 + V33-5 → 3) Phase-2-Nachtrag (3.1–3.4) → 4) Phase-3-Start gemäss v2-Plan, erweitert um 3.5–3.10 (Migrationen book_event + V33-1/3/4 gebündelt) → 5) Phase 4 unverändert (V33-Boost ist durch `purchase_boost` abgedeckt).

```
[ ] Migrationen V33-1..5 eingespielt (via Supabase-MCP) + D2-Check + Types regeneriert
[ ] pg_cron aktiviert, Job settle-auctions läuft (Test: Auktion mit Ende in 2 Min)
[ ] Dropdown: alle 6 Einträge + rotes Abmelden, schliesst bei Aussenklick
[ ] Konto-Modal: 3 Tabs speichern korrekt; IBAN/Twint/Telefon liegen in profiles_private
[ ] Beweis: anon-Query auf profiles_private liefert 0 Zeilen; anon-Query auf listings zeigt keine Drafts
[ ] Inserat bearbeiten: nur Owner, gesperrt bei reserved
[ ] Auktion: Bieten unter Mindestgebot wird abgelehnt (Staffel +5/+10/+25); zwei gleichzeitige Gebote → keins geht verloren
[ ] Sofort-Kauf erzeugt pending-Deal, Verkäufer-Bestätigung zieht 10% Provision (Rappen!)
[ ] Auktionsablauf ohne Gebot → expired + Notification; mit Geboten → Gewinner-Deal + beide Notifications
[ ] Smartes Gesuch: „roten Pulli Grösse M" erkennt Kleidung, blendet Grösse/Farbe/Zustand ein, smart_data gespeichert und im Detail sichtbar
[ ] Coffee: CHF 5 Spende zieht exakt 500 Rappen ab, Wallet-Log Typ coffee
[ ] Schnäppchen-Jagd & Loswerden-Screens zeigen echte Daten (Käufe, Gebote, Tickets, KPI)
[ ] Vorankündigung: alle 3 Routing-Wege funktionieren; „Nur benachrichtigen" legt event_reminders-Zeile an
```
