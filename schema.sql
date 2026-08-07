-- PRIME LAR PRO V4
-- Pode ser executado em projeto novo ou sobre as versões anteriores.
-- Não apaga imóveis existentes.

create extension if not exists pgcrypto;
create sequence if not exists public.property_code_seq start 1;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text unique,
  role text not null default 'corretor' check (role in ('admin','corretor')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  title text not null,
  purpose text not null check (purpose in ('Venda','Aluguel')),
  availability_status text not null default 'Disponível' check (availability_status in ('Disponível','Alugado','Vendido','Reservado')),
  type text not null,
  price numeric(14,2) not null default 0,
  condo_fee numeric(14,2) not null default 0,
  city text not null,
  neighborhood text not null,
  address text,
  description text not null,
  area numeric(12,2) not null default 0,
  bedrooms integer not null default 0,
  suites integer not null default 0,
  bathrooms integer not null default 0,
  parking integer not null default 0,
  floor integer not null default 0,
  pool boolean not null default false,
  financing boolean not null default false,
  condominium boolean not null default false,
  featured boolean not null default false,
  active boolean not null default true,
  images jsonb not null default '[]'::jsonb,
  video text,
  tour text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.property_metrics (
  property_id uuid primary key references public.properties(id) on delete cascade,
  views bigint not null default 0,
  clicks bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Migrações seguras para instalações antigas.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists enabled boolean not null default true;
alter table public.profiles add column if not exists updated_at timestamptz not null default now();
update public.profiles p set email = u.email from auth.users u where p.id = u.id and p.email is null;
create unique index if not exists profiles_email_unique_idx on public.profiles(email);

alter table public.properties add column if not exists availability_status text not null default 'Disponível';
alter table public.properties add column if not exists latitude numeric(10,7);
alter table public.properties add column if not exists longitude numeric(10,7);
alter table public.properties add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.properties add column if not exists updated_at timestamptz not null default now();

-- Sincroniza a sequência com códigos já existentes.
do $$
declare highest_code bigint;
begin
  select coalesce(max((substring(code from '(\d+)$'))::bigint), 0)
    into highest_code
  from public.properties
  where code ~ '\d+$';
  if highest_code > 0 then
    perform setval('public.property_code_seq', highest_code, true);
  else
    perform setval('public.property_code_seq', 1, false);
  end if;
end $$;

create or replace function public.next_property_code(p_prefix text default 'IMV')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare n bigint;
begin
  n := nextval('public.property_code_seq');
  return upper(regexp_replace(coalesce(nullif(trim(p_prefix),''),'IMV'), '[^A-Za-z0-9_-]', '', 'g')) || '-' || lpad(n::text, 5, '0');
end;
$$;
grant execute on function public.next_property_code(text) to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at before update on public.properties for each row execute function public.set_updated_at();
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role, enabled)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    case when new.raw_user_meta_data->>'role' in ('admin','corretor') then new.raw_user_meta_data->>'role' else 'corretor' end,
    true
  )
  on conflict (id) do update set
    name = excluded.name,
    email = excluded.email,
    role = excluded.role;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert or update of raw_user_meta_data, email on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and enabled = true);
$$;

create or replace function public.is_active_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and enabled = true);
$$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_active_staff() to authenticated;

create or replace function public.increment_property_metric(p_property_id uuid, p_metric text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_metric not in ('views','clicks') then raise exception 'Métrica inválida'; end if;
  insert into public.property_metrics(property_id, views, clicks)
  values (p_property_id, case when p_metric='views' then 1 else 0 end, case when p_metric='clicks' then 1 else 0 end)
  on conflict (property_id) do update set
    views = public.property_metrics.views + case when p_metric='views' then 1 else 0 end,
    clicks = public.property_metrics.clicks + case when p_metric='clicks' then 1 else 0 end,
    updated_at = now();
end $$;
grant execute on function public.increment_property_metric(uuid,text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_metrics enable row level security;

-- Profiles
drop policy if exists "profiles read self or admin" on public.profiles;
create policy "profiles read self or admin" on public.profiles for select to authenticated
using (id = auth.uid() or public.is_admin());

-- Imóveis: público vê somente anúncios exibidos. Equipe ativa administra.
drop policy if exists "public reads visible properties" on public.properties;
create policy "public reads visible properties" on public.properties for select to anon, authenticated using (active = true);
drop policy if exists "staff reads properties" on public.properties;
create policy "staff reads properties" on public.properties for select to authenticated using (public.is_active_staff());
drop policy if exists "staff inserts properties" on public.properties;
create policy "staff inserts properties" on public.properties for insert to authenticated with check (public.is_active_staff());
drop policy if exists "staff updates properties" on public.properties;
create policy "staff updates properties" on public.properties for update to authenticated using (public.is_active_staff()) with check (public.is_active_staff());
drop policy if exists "staff deletes properties" on public.properties;
create policy "staff deletes properties" on public.properties for delete to authenticated using (public.is_active_staff());

-- Métricas visíveis somente para equipe autenticada.
drop policy if exists "staff reads metrics" on public.property_metrics;
create policy "staff reads metrics" on public.property_metrics for select to authenticated using (public.is_active_staff());

-- Bucket público para imagens dos imóveis.
insert into storage.buckets (id, name, public)
values ('property-images','property-images',true)
on conflict (id) do update set public = true;

drop policy if exists "public reads property images" on storage.objects;
create policy "public reads property images" on storage.objects for select to public using (bucket_id = 'property-images');
drop policy if exists "staff uploads property images" on storage.objects;
create policy "staff uploads property images" on storage.objects for insert to authenticated with check (bucket_id = 'property-images' and public.is_active_staff());
drop policy if exists "staff updates property images" on storage.objects;
create policy "staff updates property images" on storage.objects for update to authenticated using (bucket_id = 'property-images' and public.is_active_staff()) with check (bucket_id = 'property-images' and public.is_active_staff());
drop policy if exists "staff deletes property images" on storage.objects;
create policy "staff deletes property images" on storage.objects for delete to authenticated using (bucket_id = 'property-images' and public.is_active_staff());
