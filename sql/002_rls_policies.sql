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

-- Transactions / wallet_transactions: server-side via RPC only; restrict client operations
create policy "Transactions: no client access" on transactions
  for all using (false);

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
