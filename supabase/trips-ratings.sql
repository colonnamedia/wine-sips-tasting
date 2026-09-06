-- Run after schema.sql. This adds shared trips, personal ratings and the
-- automatic "buy again" list for wines rated 5.

create extension if not exists pgcrypto;

create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  region_slug text not null default 'finger-lakes',
  starts_on date,
  ends_on date,
  share_token uuid not null default gen_random_uuid() unique,
  sharing_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.trip_members (
  trip_id uuid not null references public.trips(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  member_role text not null default 'member' check (member_role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create table if not exists public.trip_stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete cascade,
  winery_ref text not null,
  winery_name text not null,
  stop_order integer not null check (stop_order > 0),
  scheduled_at timestamptz,
  created_at timestamptz not null default now(),
  unique (trip_id, winery_ref)
);

create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trip_id uuid references public.trips(id) on delete cascade,
  journey_key text not null default 'journal',
  winery_ref text not null,
  winery_name text not null,
  wine_ref text not null,
  wine_name text not null,
  score smallint not null check (score between 1 and 5),
  notes text,
  rated_at timestamptz not null default now(),
  unique (user_id, journey_key, winery_ref, wine_ref)
);

create table if not exists public.saved_wines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  winery_ref text not null,
  winery_name text not null,
  wine_ref text not null,
  wine_name text not null,
  source_rating_id uuid references public.ratings(id) on delete set null,
  saved_at timestamptz not null default now(),
  unique (user_id, winery_ref, wine_ref)
);

create or replace function public.is_trip_member(requested_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = requested_trip_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_trip_owner(requested_trip_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.trips
    where id = requested_trip_id and owner_id = auth.uid()
  );
$$;

create or replace function public.add_trip_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.trip_members (trip_id, user_id, member_role)
  values (new.id, new.owner_id, 'owner')
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_trip_created on public.trips;
create trigger on_trip_created
after insert on public.trips
for each row execute procedure public.add_trip_owner_membership();

create or replace function public.sync_five_star_saved_wine()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.score = 5 then
    insert into public.saved_wines
      (user_id, winery_ref, winery_name, wine_ref, wine_name, source_rating_id)
    values
      (new.user_id, new.winery_ref, new.winery_name, new.wine_ref, new.wine_name, new.id)
    on conflict (user_id, winery_ref, wine_ref) do update
      set winery_name = excluded.winery_name,
          wine_name = excluded.wine_name,
          source_rating_id = excluded.source_rating_id,
          saved_at = now();
  else
    delete from public.saved_wines
    where user_id = new.user_id
      and winery_ref = new.winery_ref
      and wine_ref = new.wine_ref;
  end if;
  return new;
end;
$$;

drop trigger if exists on_rating_saved on public.ratings;
create trigger on_rating_saved
after insert or update of score on public.ratings
for each row execute procedure public.sync_five_star_saved_wine();

create or replace function public.get_shared_trip(requested_share_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'title', t.title,
    'region_slug', t.region_slug,
    'starts_on', t.starts_on,
    'ends_on', t.ends_on,
    'stops', coalesce((
      select jsonb_agg(jsonb_build_object(
        'winery_ref', s.winery_ref,
        'winery_name', s.winery_name,
        'stop_order', s.stop_order,
        'scheduled_at', s.scheduled_at
      ) order by s.stop_order)
      from public.trip_stops s where s.trip_id = t.id
    ), '[]'::jsonb)
  )
  from public.trips t
  where t.share_token = requested_share_token and t.sharing_enabled = true;
$$;

create or replace function public.join_shared_trip(requested_share_token uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare selected_trip_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in before joining a trip';
  end if;
  select id into selected_trip_id from public.trips
  where share_token = requested_share_token and sharing_enabled = true;
  if selected_trip_id is null then
    raise exception 'Trip invitation is invalid or no longer active';
  end if;
  insert into public.trip_members (trip_id, user_id)
  values (selected_trip_id, auth.uid())
  on conflict do nothing;
  return selected_trip_id;
end;
$$;

alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_stops enable row level security;
alter table public.ratings enable row level security;
alter table public.saved_wines enable row level security;

drop policy if exists "Trip members can view trips" on public.trips;
create policy "Trip members can view trips" on public.trips for select
using (public.is_trip_member(id));
drop policy if exists "Members can create trips" on public.trips;
create policy "Members can create trips" on public.trips for insert
with check (auth.uid() = owner_id);
drop policy if exists "Owners can update trips" on public.trips;
create policy "Owners can update trips" on public.trips for update
using (auth.uid() = owner_id) with check (auth.uid() = owner_id);
drop policy if exists "Owners can delete trips" on public.trips;
create policy "Owners can delete trips" on public.trips for delete
using (auth.uid() = owner_id);

drop policy if exists "Trip members can view memberships" on public.trip_members;
create policy "Trip members can view memberships" on public.trip_members for select
using (public.is_trip_member(trip_id));

drop policy if exists "Trip members can view stops" on public.trip_stops;
create policy "Trip members can view stops" on public.trip_stops for select
using (public.is_trip_member(trip_id));
drop policy if exists "Trip owners can add stops" on public.trip_stops;
create policy "Trip owners can add stops" on public.trip_stops for insert
with check (public.is_trip_owner(trip_id));
drop policy if exists "Trip owners can update stops" on public.trip_stops;
create policy "Trip owners can update stops" on public.trip_stops for update
using (public.is_trip_owner(trip_id)) with check (public.is_trip_owner(trip_id));
drop policy if exists "Trip owners can delete stops" on public.trip_stops;
create policy "Trip owners can delete stops" on public.trip_stops for delete
using (public.is_trip_owner(trip_id));

drop policy if exists "Members can view trip ratings" on public.ratings;
create policy "Members can view trip ratings" on public.ratings for select
using (auth.uid() = user_id or (trip_id is not null and public.is_trip_member(trip_id)));
drop policy if exists "Members can add their ratings" on public.ratings;
create policy "Members can add their ratings" on public.ratings for insert
with check (auth.uid() = user_id and (trip_id is null or public.is_trip_member(trip_id)));
drop policy if exists "Members can update their ratings" on public.ratings;
create policy "Members can update their ratings" on public.ratings for update
using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Members can delete their ratings" on public.ratings;
create policy "Members can delete their ratings" on public.ratings for delete
using (auth.uid() = user_id);

drop policy if exists "Members can view saved wines" on public.saved_wines;
create policy "Members can view saved wines" on public.saved_wines for select
using (auth.uid() = user_id);
drop policy if exists "Members can manage saved wines" on public.saved_wines;
create policy "Members can manage saved wines" on public.saved_wines for all
using (auth.uid() = user_id) with check (auth.uid() = user_id);

revoke all on function public.get_shared_trip(uuid) from public;
grant execute on function public.get_shared_trip(uuid) to anon, authenticated;
revoke all on function public.join_shared_trip(uuid) from public;
grant execute on function public.join_shared_trip(uuid) to authenticated;
revoke all on function public.is_trip_member(uuid) from public;
grant execute on function public.is_trip_member(uuid) to authenticated;
revoke all on function public.is_trip_owner(uuid) from public;
grant execute on function public.is_trip_owner(uuid) to authenticated;
