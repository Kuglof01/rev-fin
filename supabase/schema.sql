-- Spendly multi-user Supabase schema
create extension if not exists pgcrypto;

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(user_id, name)
);

create table if not exists subcategories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  unique(category_id, name)
);

create table if not exists purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item text not null,
  amount numeric(12,2) not null check (amount >= 0),
  purchase_date date not null default current_date,
  category_id uuid not null references categories(id) on delete restrict,
  subcategory_id uuid references subcategories(id) on delete set null,
  notes text,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;
alter table subcategories enable row level security;
alter table purchases enable row level security;

drop policy if exists "public read categories" on categories;
drop policy if exists "public insert categories" on categories;
drop policy if exists "public update categories" on categories;
drop policy if exists "public delete categories" on categories;
drop policy if exists "public read subcategories" on subcategories;
drop policy if exists "public insert subcategories" on subcategories;
drop policy if exists "public update subcategories" on subcategories;
drop policy if exists "public delete subcategories" on subcategories;
drop policy if exists "public read purchases" on purchases;
drop policy if exists "public insert purchases" on purchases;
drop policy if exists "public update purchases" on purchases;
drop policy if exists "public delete purchases" on purchases;

drop policy if exists "users read own categories" on categories;
drop policy if exists "users insert own categories" on categories;
drop policy if exists "users update own categories" on categories;
drop policy if exists "users delete own categories" on categories;
drop policy if exists "users read own subcategories" on subcategories;
drop policy if exists "users insert own subcategories" on subcategories;
drop policy if exists "users update own subcategories" on subcategories;
drop policy if exists "users delete own subcategories" on subcategories;
drop policy if exists "users read own purchases" on purchases;
drop policy if exists "users insert own purchases" on purchases;
drop policy if exists "users update own purchases" on purchases;
drop policy if exists "users delete own purchases" on purchases;

create policy "users read own categories" on categories for select using (auth.uid() = user_id);
create policy "users insert own categories" on categories for insert with check (auth.uid() = user_id);
create policy "users update own categories" on categories for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own categories" on categories for delete using (auth.uid() = user_id);

create policy "users read own subcategories" on subcategories for select using (auth.uid() = user_id);
create policy "users insert own subcategories" on subcategories for insert with check (auth.uid() = user_id);
create policy "users update own subcategories" on subcategories for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own subcategories" on subcategories for delete using (auth.uid() = user_id);

create policy "users read own purchases" on purchases for select using (auth.uid() = user_id);
create policy "users insert own purchases" on purchases for insert with check (auth.uid() = user_id);
create policy "users update own purchases" on purchases for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users delete own purchases" on purchases for delete using (auth.uid() = user_id);

-- Seed default categories for each new account.
create or replace function public.seed_spendly_categories()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  food_id uuid;
  transport_id uuid;
begin
  insert into categories(user_id, name) values (new.id, 'Food') returning id into food_id;
  insert into categories(user_id, name) values (new.id, 'Transport') returning id into transport_id;
  insert into categories(user_id, name) values (new.id, 'Shopping');
  insert into categories(user_id, name) values (new.id, 'Entertainment');
  insert into categories(user_id, name) values (new.id, 'Bills');
  insert into categories(user_id, name) values (new.id, 'Health');
  insert into subcategories(user_id, category_id, name) values
    (new.id, food_id, 'Groceries'), (new.id, food_id, 'Restaurants'), (new.id, food_id, 'Snacks'),
    (new.id, transport_id, 'Fuel'), (new.id, transport_id, 'Public Transport'), (new.id, transport_id, 'Parking');
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_spendly on auth.users;
create trigger on_auth_user_created_spendly
after insert on auth.users
for each row execute procedure public.seed_spendly_categories();
