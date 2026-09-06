-- Run after schema.sql and trips-ratings.sql.
-- Adds winery claims, staff access, tasting menus, CSV/manual imports and audit history.

create table if not exists public.wineries (
  id uuid primary key default gen_random_uuid(),
  directory_ref text unique,
  name text not null,
  slug text not null unique,
  region_slug text not null default 'finger-lakes',
  city text,
  address text,
  website text,
  latitude numeric,
  longitude numeric,
  description text,
  profile_status text not null default 'listed' check (profile_status in ('listed','claimed','verified','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.winery_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  winery_id uuid references public.wineries(id) on delete set null,
  directory_ref text,
  winery_name text not null,
  business_email text not null,
  website text,
  job_title text,
  message text,
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.winery_members (
  winery_id uuid not null references public.wineries(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('owner','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (winery_id,user_id)
);

create table if not exists public.tasting_menus (
  id uuid primary key default gen_random_uuid(),
  winery_id uuid not null references public.wineries(id) on delete cascade,
  name text not null default 'Current Tasting Menu',
  status text not null default 'draft' check (status in ('draft','published','archived')),
  tasting_price_label text,
  valid_from date,
  valid_until date,
  notes text,
  created_by uuid not null references auth.users(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  menu_id uuid not null references public.tasting_menus(id) on delete cascade,
  flight_name text not null default 'Current Tasting',
  vintage text,
  wine_name text not null,
  varietal text,
  style text,
  bottle_price numeric(10,2),
  description text,
  award text,
  purchase_url text,
  in_stock boolean not null default true,
  sort_order integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.winery_imports (
  id uuid primary key default gen_random_uuid(),
  winery_id uuid not null references public.wineries(id) on delete cascade,
  menu_id uuid references public.tasting_menus(id) on delete set null,
  uploaded_by uuid not null references auth.users(id) on delete restrict,
  file_name text,
  row_count integer not null default 0,
  status text not null default 'processed' check (status in ('processed','failed')),
  errors jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  winery_id uuid references public.wineries(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_sips_admin()
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='sips_admin'); $$;

create or replace function public.is_winery_member(requested_winery_id uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.winery_members where winery_id=requested_winery_id and user_id=auth.uid()); $$;

create or replace function public.approve_winery_claim(requested_claim_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare selected_claim public.winery_claims%rowtype; selected_winery_id uuid;
begin
  if not public.is_sips_admin() then raise exception 'Sips administrator access required'; end if;
  select * into selected_claim from public.winery_claims where id=requested_claim_id and status='pending';
  if selected_claim.id is null then raise exception 'Pending claim not found'; end if;
  if selected_claim.winery_id is not null then selected_winery_id:=selected_claim.winery_id;
  else
    insert into public.wineries(directory_ref,name,slug,website,profile_status)
    values(selected_claim.directory_ref,selected_claim.winery_name,
      trim(both '-' from regexp_replace(lower(selected_claim.winery_name),'[^a-z0-9]+','-','g')),
      selected_claim.website,'claimed')
    on conflict(directory_ref) do update set profile_status='claimed',website=coalesce(excluded.website,public.wineries.website),updated_at=now()
    returning id into selected_winery_id;
  end if;
  insert into public.winery_members(winery_id,user_id,role) values(selected_winery_id,selected_claim.user_id,'owner') on conflict do nothing;
  update public.winery_claims set status='approved',winery_id=selected_winery_id,reviewed_by=auth.uid(),reviewed_at=now() where id=requested_claim_id;
  update public.profiles set role=case when role='sips_admin' then role else 'winery_admin' end,updated_at=now() where id=selected_claim.user_id;
  insert into public.admin_audit_log(actor_id,winery_id,action,details) values(auth.uid(),selected_winery_id,'claim_approved',jsonb_build_object('claim_id',requested_claim_id));
  return selected_winery_id;
end; $$;

alter table public.wineries enable row level security;
alter table public.winery_claims enable row level security;
alter table public.winery_members enable row level security;
alter table public.tasting_menus enable row level security;
alter table public.menu_items enable row level security;
alter table public.winery_imports enable row level security;
alter table public.admin_audit_log enable row level security;

drop policy if exists "Public can view wineries" on public.wineries;
drop policy if exists "Staff can update their winery" on public.wineries;
drop policy if exists "Members can submit claims" on public.winery_claims;
drop policy if exists "Members can view their claims" on public.winery_claims;
drop policy if exists "Sips admins can review claims" on public.winery_claims;
drop policy if exists "Staff can view memberships" on public.winery_members;
drop policy if exists "Public reads published menus" on public.tasting_menus;
drop policy if exists "Staff creates menus" on public.tasting_menus;
drop policy if exists "Staff updates menus" on public.tasting_menus;
drop policy if exists "Staff deletes draft menus" on public.tasting_menus;
drop policy if exists "Public reads published menu items" on public.menu_items;
drop policy if exists "Staff creates menu items" on public.menu_items;
drop policy if exists "Staff updates menu items" on public.menu_items;
drop policy if exists "Staff deletes menu items" on public.menu_items;
drop policy if exists "Staff records their imports" on public.winery_imports;
drop policy if exists "Staff views their imports" on public.winery_imports;
drop policy if exists "Sips admins view audit log" on public.admin_audit_log;
drop policy if exists "Sips admins view profiles" on public.profiles;

create policy "Public can view wineries" on public.wineries for select using (profile_status<>'suspended');
create policy "Staff can update their winery" on public.wineries for update using (public.is_winery_member(id) or public.is_sips_admin()) with check (public.is_winery_member(id) or public.is_sips_admin());
create policy "Members can submit claims" on public.winery_claims for insert with check (auth.uid()=user_id);
create policy "Members can view their claims" on public.winery_claims for select using (auth.uid()=user_id or public.is_sips_admin());
create policy "Sips admins can review claims" on public.winery_claims for update using (public.is_sips_admin()) with check (public.is_sips_admin());
create policy "Staff can view memberships" on public.winery_members for select using (auth.uid()=user_id or public.is_winery_member(winery_id) or public.is_sips_admin());
create policy "Public reads published menus" on public.tasting_menus for select using (status='published' or public.is_winery_member(winery_id) or public.is_sips_admin());
create policy "Staff creates menus" on public.tasting_menus for insert with check ((public.is_winery_member(winery_id) or public.is_sips_admin()) and auth.uid()=created_by);
create policy "Staff updates menus" on public.tasting_menus for update using (public.is_winery_member(winery_id) or public.is_sips_admin()) with check (public.is_winery_member(winery_id) or public.is_sips_admin());
create policy "Staff deletes draft menus" on public.tasting_menus for delete using ((public.is_winery_member(winery_id) or public.is_sips_admin()) and status='draft');
create policy "Public reads published menu items" on public.menu_items for select using (exists(select 1 from public.tasting_menus menu where menu.id=menu_id and (menu.status='published' or public.is_winery_member(menu.winery_id) or public.is_sips_admin())));
create policy "Staff creates menu items" on public.menu_items for insert with check (exists(select 1 from public.tasting_menus menu where menu.id=menu_id and (public.is_winery_member(menu.winery_id) or public.is_sips_admin())));
create policy "Staff updates menu items" on public.menu_items for update using (exists(select 1 from public.tasting_menus menu where menu.id=menu_id and (public.is_winery_member(menu.winery_id) or public.is_sips_admin())));
create policy "Staff deletes menu items" on public.menu_items for delete using (exists(select 1 from public.tasting_menus menu where menu.id=menu_id and (public.is_winery_member(menu.winery_id) or public.is_sips_admin())));
create policy "Staff records their imports" on public.winery_imports for insert with check ((public.is_winery_member(winery_id) or public.is_sips_admin()) and auth.uid()=uploaded_by);
create policy "Staff views their imports" on public.winery_imports for select using (public.is_winery_member(winery_id) or public.is_sips_admin());
create policy "Sips admins view audit log" on public.admin_audit_log for select using (public.is_sips_admin());
create policy "Sips admins view profiles" on public.profiles for select using (public.is_sips_admin());

grant execute on function public.is_sips_admin() to authenticated;
grant execute on function public.is_winery_member(uuid) to authenticated;
grant execute on function public.approve_winery_claim(uuid) to authenticated;
grant select on public.wineries,public.tasting_menus,public.menu_items to anon,authenticated;
grant insert,select,update on public.winery_claims to authenticated;
grant select on public.winery_members to authenticated;
grant insert,select,update,delete on public.tasting_menus,public.menu_items to authenticated;
grant insert,select on public.winery_imports to authenticated;
grant select on public.admin_audit_log to authenticated;

insert into public.wineries(directory_ref,name,slug,city,address,latitude,longitude,profile_status)
values
 ('49','Heart & Hands Wine Company','heart-and-hands-wine-company','Union Springs','4162 State Route 90N, Union Springs, NY',42.819816373702,-76.699191661073,'listed'),
 ('28','Constantia Wine Company','constantia-wine-company','Scipio Center','3262 Long Hill Rd, Scipio Center, NY',42.739236474456,-76.525257465482,'listed')
on conflict(directory_ref) do update set name=excluded.name,city=excluded.city,address=excluded.address,latitude=excluded.latitude,longitude=excluded.longitude,updated_at=now();

-- Run again after the Sips owner has registered if the account does not exist yet.
update public.profiles set role='sips_admin',updated_at=now()
where id=(select id from auth.users where lower(email)='sipswine@yahoo.com' limit 1);
