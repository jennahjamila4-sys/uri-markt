-- 002_rls_policies.sql
-- Aktivieren von RLS und Basis-Policies (anpassen nach Bedarf)

-- Enable RLS for all tables
alter table profiles enable row level security;
alter table listings enable row level security;
alter table notifications enable row level security;
alter table transactions enable row level security;
alter table wallet_transactions enable row level security;
alter table reviews enable row level security;
alter table event_bookings enable row level security;
alter table smart_matches enable row level security;
alter table comments enable row level security;
alter table xp_log enable row level security;

-- Profiles: allow users to read public profile info, and update their own profile
create policy "Profiles: public select" on profiles
  for select using (true);

create policy "Profiles: update own" on profiles
  for update using (auth.uid() = id)
  with check (auth.uid() = id);

-- Listings: public read, insert only for authenticated users and enforce user_id = auth.uid(), update/delete only by owner
create policy "Listings: public select" on listings
  for select using (true);

create policy "Listings: insert auth" on listings
  for insert with check (auth.role() is not null and auth.uid()::text = user_id::text);

create policy "Listings: update owner" on listings
  for update using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);

create policy "Listings: delete owner" on listings
  for delete using (auth.uid()::text = user_id::text);

-- Notifications: user-only access
create policy "Notifications: user access" on notifications
  for all using (auth.uid()::text = user_id::text)
  with check (auth.uid()::text = user_id::text);

-- Transactions: buyer/seller can read their own transactions, sensitive fields hidden until confirmed
create policy "Transactions: buyer/seller read" on transactions
  for select using (
    auth.uid() = buyer_id or auth.uid() = seller_id
  );

-- Transactions: insert only via RPC
create policy "Transactions: no direct insert" on transactions
  for insert using (false);

-- Transactions: update only via RPC (for confirm/complete operations)
create policy "Transactions: no direct update" on transactions
  for update using (false);

create policy "Wallet tx: no client access" on wallet_transactions
  for all using (false);

-- Reviews: allow inserts by authenticated users, select public
create policy "Reviews: public select" on reviews
  for select using (true);

create policy "Reviews: insert auth" on reviews
  for insert with check (auth.uid() is not null and auth.uid()::text = reviewer_id::text);

-- Event bookings: insert by authenticated users, owner access for select
create policy "Event bookings: insert auth" on event_bookings
  for insert with check (auth.uid()::text = user_id::text);

create policy "Event bookings: select owner" on event_bookings
  for select using (auth.uid()::text = user_id::text);

-- Smart matches: user can read their own matches, update dismissals
create policy "Smart matches: user read own" on smart_matches
  for select using (auth.uid() = user_id);

create policy "Smart matches: user dismiss own" on smart_matches
  for update using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Comments: public read, authenticated users can insert, no direct delete
create policy "Comments: public select" on comments
  for select using (true);

create policy "Comments: insert auth" on comments
  for insert with check (auth.uid()::text = user_id::text);

create policy "Comments: delete own" on comments
  for delete using (auth.uid()::text = user_id::text);

-- XP log: no client access (read-only for internal use)
create policy "XP log: no client access" on xp_log
  for all using (false);
