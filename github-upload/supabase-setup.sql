-- ============================================================
--  CLOSET TRACKER — Supabase database setup
--  Run this ONCE in Supabase → SQL Editor → New query → Run.
--  Safe to re-run (uses IF NOT EXISTS / ON CONFLICT).
-- ============================================================

-- ---------- Tables ----------
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  color       text default '#F59E0B',
  icon        text default 'sparkles',
  created_at  timestamptz default now()
);

create table if not exists items (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  category_id         uuid references categories(id) on delete set null,
  total_quantity      int  not null default 0,
  available_quantity  int  not null default 0,
  image_url           text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create table if not exists transactions (
  id           uuid primary key default gen_random_uuid(),
  item_id      uuid references items(id) on delete cascade,
  person_name  text,
  quantity     int  not null default 1,
  type         text not null default 'checkout',   -- checkout | return
  status       text not null default 'active',      -- active | return_pending | returned
  created_at   timestamptz default now(),
  resolved_at  timestamptz
);

-- ---------- Row Level Security ----------
-- Public (anonymous) visitors may READ everything so the live
-- dashboard and realtime work. All WRITES happen only through the
-- server API using the secret service_role key, which bypasses RLS.
alter table categories   enable row level security;
alter table items        enable row level security;
alter table transactions enable row level security;

drop policy if exists "public read categories"   on categories;
drop policy if exists "public read items"         on items;
drop policy if exists "public read transactions"  on transactions;

create policy "public read categories"  on categories   for select using (true);
create policy "public read items"        on items        for select using (true);
create policy "public read transactions" on transactions for select using (true);

-- ---------- Realtime (live dashboard) ----------
alter publication supabase_realtime add table items;
alter publication supabase_realtime add table transactions;
alter publication supabase_realtime add table categories;

-- ---------- Image storage bucket ----------
insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

drop policy if exists "public read item images" on storage.objects;
create policy "public read item images" on storage.objects
  for select using (bucket_id = 'item-images');

-- ---------- Starter categories ----------
insert into categories (name, color, icon)
select * from (values
  ('Stationery',            '#3B82F6', 'pen'),
  ('Candy',                 '#EC4899', 'candy'),
  ('Paper',                 '#F59E0B', 'paper'),
  ('Art & Craft Machines',  '#8B5CF6', 'machine')
) as v(name, color, icon)
where not exists (select 1 from categories);

-- Done! Your closet database is ready.
