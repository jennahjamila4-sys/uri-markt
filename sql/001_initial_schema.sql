-- 001_initial_schema.sql
-- Basis-Tabellen: profiles, listings, notifications, transactions, wallet_transactions, reviews, event_bookings

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  full_name text,
  avatar_url text,
  gemeinde text,
  xp_points int default 0,
  level text,
  credits numeric(12,2) default 0,
  avg_rating numeric(3,2),
  review_count int default 0,
  pioneer_badge boolean default false,
  strikes int default 0,
  is_banned boolean default false,
  can_buy boolean default true,
  referral_code text,
  preferred_categories text[],
  created_at timestamptz default now()
);

create table if not exists listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  description text,
  type text not null,
  status text not null default 'active',
  price numeric(12,2),
  price_type text not null,
  category text not null,
  gemeinde text not null,
  image_url text,
  image_urls text[],
  is_boosted boolean default false,
  boost_expires_at timestamptz,
  fomo_expires_at timestamptz,
  views int default 0,
  created_at timestamptz default now()
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  type text,
  payload jsonb,
  read boolean default false,
  created_at timestamptz default now()
);

create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references profiles(id) on delete cascade,
  seller_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  amount numeric(12,2) not null,
  commission numeric(12,2) not null default 0,
  payment_method text,
  buyer_contact text,
  seller_contact text,
  status text not null default 'pending',
  confirmed_at timestamptz,
  completed_at timestamptz,
  no_show_reported_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  amount numeric(12,2),
  type text,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  reviewer_id uuid references profiles(id),
  reviewee_id uuid references profiles(id),
  listing_id uuid references listings(id),
  rating int,
  comment text,
  created_at timestamptz default now()
);

create table if not exists event_bookings (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references listings(id),
  user_id uuid references profiles(id),
  seats int default 1,
  created_at timestamptz default now()
);

create table if not exists smart_matches (
  id uuid primary key default gen_random_uuid(),
  gesuch_id uuid not null references listings(id) on delete cascade,
  matched_listing_id uuid not null references listings(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  score int not null default 0,
  dismissed boolean default false,
  dismissed_at timestamptz,
  created_at timestamptz default now(),
  unique(gesuch_id, matched_listing_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  text text not null,
  censored_text text,
  created_at timestamptz default now()
);

create table if not exists xp_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  amount int not null,
  reason text,
  idempotency_key text unique,
  created_at timestamptz default now()
);
