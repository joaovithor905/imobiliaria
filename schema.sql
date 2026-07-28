-- PRIME LAR PRO V2
-- Execute este arquivo no SQL Editor do Supabase em um projeto novo.

create extension if not exists pgcrypto;

create sequence if not exists property_code_seq start 1;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  role text not null default 'corretor' check (role in ('admin', 'corretor')),
  enabled boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.properties (
  id uuid primary key default gen_random_uuid(),
  code text unique not null default ('IMV-' || lpad(nextval('property_code_seq')::text, 5, '0')),
  title text not null,
  purpose text not null check (purpose in ('Venda', 'Aluguel')),
  availability_status text not null default 'Disponível' check (availability_status in ('Disponível', 'Alugado', 'Vendido', 'Reservado')),
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
  map text,
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

-- Compatibilidade com uma versão anterior do projeto.
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists enabled boolean not null default true;
update public.profiles p set email = u.email from auth.users u where p.id = u.id and p.email is null;
create unique index if not exists profiles_email_unique_idx on public.profiles(email);

alter table public.properties add column if not exists availability_status text not null default 'Disponível';
alter table public.properties add column if not exists created_by uuid references public.profiles(id) on delete set null;
alter table public.properties add column if not exists updated_at timestamptz not null default now();
alter table public.properties alter column code set default ('IMV-' || lpad(nextval('property_code_seq')::text, 5, '0'));

do $$
declare
  highest_code bigint;
begin
  select coalesce(max((substring(code from '(\d+)$'))::bigint), 0)
  into highest_code
  from public.properties
  where code ~ '\d+$';

  if highest_code > 0 then
    perform setval('property_code_seq', highest_code, true);
  else
    perform setval('property_code_seq', 1, false);
  end if;
end;
$$;

create table if not exists public.site_settings (
  id integer primary key default 1 check (id = 1),
  name text not null default 'Prime Lar',
  initials text not null default 'PL',
  whatsapp text not null default '5564999999999',
  phone text not null default '(64) 99999-9999',
  instagram text not null default 'https://instagram.com/',
  address text not null default 'Rio Verde - GO',
  description text not null default 'Imóveis para venda e aluguel com atendimento simples e próximo.',
  primary_color text not null default '#0f3d32',
  accent_color text not null default '#c89b5b',
  logo_url text,
  updated_at timestamptz not null default now()
);

insert into public.site_settings (id) values (1) on conflict (id) do nothing;

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists properties_set_updated_at on public.properties;
create trigger properties_set_updated_at before update on public.properties
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
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
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert or update of raw_user_meta_data on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function public.increment_property_metric(p_property_id uuid, p_metric text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_metric not in ('views', 'clicks') then
    raise exception 'Métrica inválida';
  end if;

  insert into public.property_metrics(property_id, views, clicks)
  values (
    p_property_id,
    case when p_metric = 'views' then 1 else 0 end,
    case when p_metric = 'clicks' then 1 else 0 end
  )
  on conflict(property_id) do update set
    views = public.property_metrics.views + case when p_metric = 'views' then 1 else 0 end,
    clicks = public.property_metrics.clicks + case when p_metric = 'clicks' then 1 else 0 end,
    updated_at = now();
end;
$$;

grant execute on function public.increment_property_metric(uuid, text) to anon, authenticated;

alter table public.profiles enable row level security;
alter table public.properties enable row level security;
alter table public.property_metrics enable row level security;
alter table public.site_settings enable row level security;

drop policy if exists "profiles select own or admin" on public.profiles;
create policy "profiles select own or admin" on public.profiles
for select to authenticated using (id = auth.uid() or public.is_admin());

drop policy if exists "admins update profiles" on public.profiles;
create policy "admins update profiles" on public.profiles
for update to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public reads visible properties" on public.properties;
create policy "public reads visible properties" on public.properties
for select using (active = true or auth.uid() is not null);

drop policy if exists "authenticated inserts properties" on public.properties;
create policy "authenticated inserts properties" on public.properties
for insert to authenticated with check (true);

drop policy if exists "authenticated updates properties" on public.properties;
create policy "authenticated updates properties" on public.properties
for update to authenticated using (true) with check (true);

drop policy if exists "authenticated deletes properties" on public.properties;
create policy "authenticated deletes properties" on public.properties
for delete to authenticated using (true);

drop policy if exists "authenticated reads metrics" on public.property_metrics;
create policy "authenticated reads metrics" on public.property_metrics
for select to authenticated using (true);

drop policy if exists "public reads settings" on public.site_settings;
create policy "public reads settings" on public.site_settings
for select using (true);

drop policy if exists "admins manage settings" on public.site_settings;
create policy "admins manage settings" on public.site_settings
for all to authenticated using (public.is_admin()) with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('property-images', 'property-images', true)
on conflict (id) do update set public = true;

drop policy if exists "public reads property images" on storage.objects;
create policy "public reads property images" on storage.objects
for select using (bucket_id = 'property-images');

drop policy if exists "authenticated uploads property images" on storage.objects;
create policy "authenticated uploads property images" on storage.objects
for insert to authenticated with check (bucket_id = 'property-images');

drop policy if exists "authenticated updates property images" on storage.objects;
create policy "authenticated updates property images" on storage.objects
for update to authenticated using (bucket_id = 'property-images') with check (bucket_id = 'property-images');

drop policy if exists "authenticated deletes property images" on storage.objects;
create policy "authenticated deletes property images" on storage.objects
for delete to authenticated using (bucket_id = 'property-images');


insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do update set public = true;

drop policy if exists "public reads site assets" on storage.objects;
create policy "public reads site assets" on storage.objects
for select using (bucket_id = 'site-assets');

drop policy if exists "admins upload site assets" on storage.objects;
create policy "admins upload site assets" on storage.objects
for insert to authenticated with check (bucket_id = 'site-assets' and public.is_admin());

drop policy if exists "admins update site assets" on storage.objects;
create policy "admins update site assets" on storage.objects
for update to authenticated using (bucket_id = 'site-assets' and public.is_admin()) with check (bucket_id = 'site-assets' and public.is_admin());

drop policy if exists "admins delete site assets" on storage.objects;
create policy "admins delete site assets" on storage.objects
for delete to authenticated using (bucket_id = 'site-assets' and public.is_admin());

-- Depois de criar o primeiro usuário no painel Authentication do Supabase,
-- transforme-o em administrador:
-- update public.profiles set role = 'admin' where email = 'SEU_EMAIL@EXEMPLO.COM';