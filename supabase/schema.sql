-- Spendly production schema / migration. Safe to run repeatedly.
create extension if not exists pgcrypto;
create table if not exists public.categories (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, name text not null, created_at timestamptz not null default now(), unique(user_id,name));
create table if not exists public.subcategories (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, category_id uuid not null references public.categories(id) on delete cascade, name text not null, created_at timestamptz not null default now(), unique(category_id,name));
create table if not exists public.purchases (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, item text not null, amount numeric(12,2) not null check(amount>=0), purchase_date date not null default current_date, category_id uuid not null references public.categories(id) on delete restrict, subcategory_id uuid references public.subcategories(id) on delete set null, notes text, created_at timestamptz not null default now());
create index if not exists categories_user_id_idx on public.categories(user_id);
create index if not exists subcategories_user_id_idx on public.subcategories(user_id);
create index if not exists subcategories_category_id_idx on public.subcategories(category_id);
create index if not exists purchases_user_id_idx on public.purchases(user_id);
create index if not exists purchases_category_id_idx on public.purchases(category_id);
create index if not exists purchases_purchase_date_idx on public.purchases(purchase_date);

alter table public.categories enable row level security;
alter table public.subcategories enable row level security;
alter table public.purchases enable row level security;

drop policy if exists "public read categories" on public.categories;
drop policy if exists "public insert categories" on public.categories;
drop policy if exists "public update categories" on public.categories;
drop policy if exists "public delete categories" on public.categories;
drop policy if exists "public read subcategories" on public.subcategories;
drop policy if exists "public insert subcategories" on public.subcategories;
drop policy if exists "public update subcategories" on public.subcategories;
drop policy if exists "public delete subcategories" on public.subcategories;
drop policy if exists "public read purchases" on public.purchases;
drop policy if exists "public insert purchases" on public.purchases;
drop policy if exists "public update purchases" on public.purchases;
drop policy if exists "public delete purchases" on public.purchases;
drop policy if exists "users read own categories" on public.categories;
drop policy if exists "users insert own categories" on public.categories;
drop policy if exists "users update own categories" on public.categories;
drop policy if exists "users delete own categories" on public.categories;
drop policy if exists "users read own subcategories" on public.subcategories;
drop policy if exists "users insert own subcategories" on public.subcategories;
drop policy if exists "users update own subcategories" on public.subcategories;
drop policy if exists "users delete own subcategories" on public.subcategories;
drop policy if exists "users read own purchases" on public.purchases;
drop policy if exists "users insert own purchases" on public.purchases;
drop policy if exists "users update own purchases" on public.purchases;
drop policy if exists "users delete own purchases" on public.purchases;
create policy "users read own categories" on public.categories for select using(auth.uid()=user_id);
create policy "users insert own categories" on public.categories for insert with check(auth.uid()=user_id);
create policy "users update own categories" on public.categories for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "users delete own categories" on public.categories for delete using(auth.uid()=user_id);
create policy "users read own subcategories" on public.subcategories for select using(auth.uid()=user_id);
create policy "users insert own subcategories" on public.subcategories for insert with check(auth.uid()=user_id);
create policy "users update own subcategories" on public.subcategories for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "users delete own subcategories" on public.subcategories for delete using(auth.uid()=user_id);
create policy "users read own purchases" on public.purchases for select using(auth.uid()=user_id);
create policy "users insert own purchases" on public.purchases for insert with check(auth.uid()=user_id);
create policy "users update own purchases" on public.purchases for update using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy "users delete own purchases" on public.purchases for delete using(auth.uid()=user_id);

create or replace function public.validate_spendly_relationships() returns trigger language plpgsql security definer set search_path=public as $$
declare category_owner uuid; sub_owner uuid; sub_category uuid;
begin
  if TG_TABLE_NAME='subcategories' then
    select user_id into category_owner from public.categories where id=NEW.category_id;
    if category_owner is null or category_owner<>NEW.user_id then raise exception 'The selected category does not belong to this account.' using errcode='42501'; end if;
    return NEW;
  end if;
  if TG_TABLE_NAME='purchases' then
    select user_id into category_owner from public.categories where id=NEW.category_id;
    if category_owner is null or category_owner<>NEW.user_id then raise exception 'The selected category does not belong to this account.' using errcode='42501'; end if;
    if NEW.subcategory_id is not null then
      select user_id,category_id into sub_owner,sub_category from public.subcategories where id=NEW.subcategory_id;
      if sub_owner is null or sub_owner<>NEW.user_id or sub_category<>NEW.category_id then raise exception 'The selected subcategory does not belong to the selected category.' using errcode='42501'; end if;
    end if;
    return NEW;
  end if;
  return NEW;
end; $$;
drop trigger if exists validate_spendly_subcategory on public.subcategories;
create trigger validate_spendly_subcategory before insert or update on public.subcategories for each row execute function public.validate_spendly_relationships();
drop trigger if exists validate_spendly_purchase on public.purchases;
create trigger validate_spendly_purchase before insert or update on public.purchases for each row execute function public.validate_spendly_relationships();

create or replace function public.seed_spendly_categories() returns trigger language plpgsql security definer set search_path=public as $$
declare food_id uuid; transport_id uuid;
begin
  insert into public.categories(user_id,name) values(new.id,'Food') on conflict(user_id,name) do nothing;
  insert into public.categories(user_id,name) values(new.id,'Transport') on conflict(user_id,name) do nothing;
  insert into public.categories(user_id,name) values(new.id,'Shopping') on conflict(user_id,name) do nothing;
  insert into public.categories(user_id,name) values(new.id,'Entertainment') on conflict(user_id,name) do nothing;
  insert into public.categories(user_id,name) values(new.id,'Bills') on conflict(user_id,name) do nothing;
  insert into public.categories(user_id,name) values(new.id,'Health') on conflict(user_id,name) do nothing;
  select id into food_id from public.categories where user_id=new.id and name='Food';
  select id into transport_id from public.categories where user_id=new.id and name='Transport';
  insert into public.subcategories(user_id,category_id,name) values(new.id,food_id,'Groceries'),(new.id,food_id,'Restaurants'),(new.id,food_id,'Snacks'),(new.id,transport_id,'Fuel'),(new.id,transport_id,'Public Transport'),(new.id,transport_id,'Parking') on conflict(category_id,name) do nothing;
  return NEW;
end; $$;
drop trigger if exists on_auth_user_created_spendly on auth.users;
create trigger on_auth_user_created_spendly after insert on auth.users for each row execute function public.seed_spendly_categories();

create or replace function public.seed_spendly_categories_from_id(p_user_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare food_id uuid; transport_id uuid;
begin
  insert into public.categories(user_id,name) values(p_user_id,'Food') on conflict(user_id,name) do nothing;
  insert into public.categories(user_id,name) values(p_user_id,'Transport') on conflict(user_id,name) do nothing;
  insert into public.categories(user_id,name) values(p_user_id,'Shopping') on conflict(user_id,name) do nothing;
  insert into public.categories(user_id,name) values(p_user_id,'Entertainment') on conflict(user_id,name) do nothing;
  insert into public.categories(user_id,name) values(p_user_id,'Bills') on conflict(user_id,name) do nothing;
  insert into public.categories(user_id,name) values(p_user_id,'Health') on conflict(user_id,name) do nothing;
  select id into food_id from public.categories where user_id=p_user_id and name='Food';
  select id into transport_id from public.categories where user_id=p_user_id and name='Transport';
  insert into public.subcategories(user_id,category_id,name) values(p_user_id,food_id,'Groceries'),(p_user_id,food_id,'Restaurants'),(p_user_id,food_id,'Snacks'),(p_user_id,transport_id,'Fuel'),(p_user_id,transport_id,'Public Transport'),(p_user_id,transport_id,'Parking') on conflict(category_id,name) do nothing;
end; $$;
revoke all on function public.seed_spendly_categories() from public,anon,authenticated;
revoke all on function public.seed_spendly_categories_from_id(uuid) from public,anon,authenticated;
-- Repair accounts created before the seed trigger existed.
do $$ declare u record; begin for u in select id from auth.users loop if not exists(select 1 from public.categories where user_id=u.id) then perform public.seed_spendly_categories_from_id(u.id); end if; end loop; end $$;
