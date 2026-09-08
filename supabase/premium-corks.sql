-- Run after schema.sql, trips-ratings.sql and winery-admin.sql.
-- Adds Sips Club entitlements, verified participation, Corks, rewards,
-- referrals and 5-Sip purchase reminders.
--
-- Important: Corks reward verified participation, never the rating score.
-- A 5-Sip rating remains an honest preference and does not award Corks.

create extension if not exists pgcrypto;

create table if not exists public.membership_plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  price_cents integer not null check (price_cents >= 0),
  billing_interval text not null default 'month' check (billing_interval in ('month','year','none')),
  is_premium boolean not null default false,
  is_active boolean not null default true,
  features jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_id uuid not null references public.membership_plans(id),
  status text not null default 'inactive' check (status in ('inactive','trialing','active','past_due','cancelled','expired')),
  provider text,
  provider_customer_ref text,
  provider_subscription_ref text unique,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists one_current_membership_per_user
on public.memberships(user_id)
where status in ('trialing','active','past_due');

create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.referral_attributions (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  invited_user_id uuid not null unique references auth.users(id) on delete cascade,
  referral_code text not null,
  qualified_at timestamptz,
  created_at timestamptz not null default now(),
  check (referrer_user_id <> invited_user_id)
);

create table if not exists public.verified_visits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  winery_id uuid not null references public.wineries(id) on delete cascade,
  verification_method text not null check (verification_method in ('geofence','winery_qr','staff_code','receipt','partner_purchase')),
  distance_meters integer check (distance_meters is null or distance_meters >= 0),
  location_accuracy_meters integer check (location_accuracy_meters is null or location_accuracy_meters >= 0),
  client_event_id uuid not null,
  verified_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_id, client_event_id)
);

create index if not exists verified_visits_user_time_idx
on public.verified_visits(user_id, verified_at desc);
create index if not exists verified_visits_winery_time_idx
on public.verified_visits(winery_id, verified_at desc);

create table if not exists public.tasting_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  visit_id uuid not null unique references public.verified_visits(id) on delete cascade,
  menu_id uuid references public.tasting_menus(id) on delete set null,
  wines_tasted smallint not null check (wines_tasted between 1 and 20),
  completed_at timestamptz not null default now()
);

create table if not exists public.corks_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  corks integer not null check (corks <> 0),
  reason text not null check (reason in ('verified_check_in','completed_flight','strong_visit_verification','first_winery_visit','verified_partner_purchase','reward_redemption','reward_refund','manual_adjustment')),
  source_kind text not null,
  source_id text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (user_id, source_kind, source_id, reason)
);

create index if not exists corks_ledger_user_time_idx
on public.corks_ledger(user_id, created_at desc);

create table if not exists public.reward_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text not null,
  corks_cost integer not null check (corks_cost > 0),
  funding_source text not null check (funding_source in ('digital','partner_funded','sips_funded')),
  estimated_cost_cents integer not null default 0 check (estimated_cost_cents >= 0),
  inventory_limit integer check (inventory_limit is null or inventory_limit >= 0),
  per_member_limit integer check (per_member_limit is null or per_member_limit > 0),
  starts_at timestamptz,
  ends_at timestamptz,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reward_redemptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reward_id uuid not null references public.reward_catalog(id),
  corks_spent integer not null check (corks_spent > 0),
  request_key uuid not null,
  status text not null default 'pending' check (status in ('pending','approved','fulfilled','cancelled')),
  fulfillment_details jsonb not null default '{}'::jsonb,
  redeemed_at timestamptz not null default now(),
  fulfilled_at timestamptz,
  unique (user_id, request_key)
);

create table if not exists public.purchase_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_wine_id uuid not null references public.saved_wines(id) on delete cascade,
  remind_at timestamptz not null,
  delivery_method text not null default 'in_app' check (delivery_method in ('in_app','email','calendar')),
  status text not null default 'scheduled' check (status in ('scheduled','sent','completed','cancelled')),
  calendar_event_created boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, saved_wine_id, remind_at, delivery_method)
);

create or replace function public.has_active_sips_club(requested_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships membership
    join public.membership_plans plan on plan.id = membership.plan_id
    where membership.user_id = requested_user_id
      and (requested_user_id = auth.uid() or public.is_sips_admin())
      and plan.is_premium = true
      and plan.is_active = true
      and membership.status in ('trialing','active')
      and (membership.current_period_end is null or membership.current_period_end > now())
  );
$$;

create or replace function public.my_corks_balance()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(corks), 0)::integer
  from public.corks_ledger
  where user_id = auth.uid();
$$;

create or replace function public.create_referral_for_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invited_code text;
  referrer_id uuid;
begin
  insert into public.referral_codes(user_id, code)
  values (new.id, lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)))
  on conflict (user_id) do nothing;

  select nullif(trim(raw_user_meta_data ->> 'referral_code'), '')
  into invited_code
  from auth.users
  where id = new.id;

  if invited_code is not null then
    select user_id into referrer_id
    from public.referral_codes
    where code = lower(invited_code);

    if referrer_id is not null and referrer_id <> new.id then
      insert into public.referral_attributions(referrer_user_id, invited_user_id, referral_code)
      values (referrer_id, new.id, lower(invited_code))
      on conflict (invited_user_id) do nothing;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_profile_create_referral on public.profiles;
create trigger on_profile_create_referral
after insert on public.profiles
for each row execute procedure public.create_referral_for_profile();

insert into public.referral_codes(user_id, code)
select profile.id, lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 16))
from public.profiles profile
on conflict (user_id) do nothing;

create or replace function public.verify_winery_check_in(
  requested_winery_id uuid,
  user_latitude double precision,
  user_longitude double precision,
  accuracy_meters integer,
  requested_event_id uuid
)
returns table (visit_id uuid, distance_meters integer, corks_awarded integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  winery_latitude double precision;
  winery_longitude double precision;
  calculated_distance integer;
  new_visit_id uuid;
  awarded integer := 0;
  is_first_visit boolean;
begin
  if auth.uid() is null then raise exception 'Sign in before checking in'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text || requested_winery_id::text));

  select id into new_visit_id
  from public.verified_visits
  where user_id = auth.uid() and client_event_id = requested_event_id;
  if new_visit_id is not null then
    return query
      select new_visit_id,
        (select visit.distance_meters from public.verified_visits visit where visit.id = new_visit_id),
        coalesce((select sum(entry.corks)::integer from public.corks_ledger entry
          where entry.user_id = auth.uid() and entry.source_kind = 'verified_visit'
            and entry.source_id = new_visit_id::text), 0);
    return;
  end if;
  if accuracy_meters is null or accuracy_meters < 0 or accuracy_meters > 200 then
    raise exception 'Location accuracy must be within 200 meters';
  end if;
  if user_latitude not between -90 and 90 or user_longitude not between -180 and 180 then
    raise exception 'Invalid location coordinates';
  end if;

  select latitude::double precision, longitude::double precision
  into winery_latitude, winery_longitude
  from public.wineries
  where id = requested_winery_id and profile_status <> 'suspended';

  if winery_latitude is null or winery_longitude is null then
    raise exception 'This winery location has not been verified yet';
  end if;

  calculated_distance := round(6371000 * acos(least(1::double precision, greatest(-1::double precision,
    cos(radians(user_latitude)) * cos(radians(winery_latitude)) *
    cos(radians(winery_longitude) - radians(user_longitude)) +
    sin(radians(user_latitude)) * sin(radians(winery_latitude))
  ))))::integer;

  if calculated_distance > 1609 then
    raise exception 'You must be within one mile of the winery to verify this visit';
  end if;

  if exists (
    select 1 from public.verified_visits
    where user_id = auth.uid() and winery_id = requested_winery_id
      and verified_at > now() - interval '18 hours'
  ) then
    raise exception 'This winery visit has already been verified today';
  end if;

  select not exists (
    select 1 from public.verified_visits
    where user_id = auth.uid() and winery_id = requested_winery_id
  ) into is_first_visit;

  insert into public.verified_visits(
    user_id, winery_id, verification_method, distance_meters,
    location_accuracy_meters, client_event_id
  ) values (
    auth.uid(), requested_winery_id, 'geofence', calculated_distance,
    accuracy_meters, requested_event_id
  ) returning id into new_visit_id;

  if public.has_active_sips_club(auth.uid()) then
    insert into public.corks_ledger(user_id, corks, reason, source_kind, source_id)
    values (auth.uid(), 20, 'verified_check_in', 'verified_visit', new_visit_id::text)
    on conflict do nothing;
    awarded := 20;

    if is_first_visit then
      insert into public.corks_ledger(user_id, corks, reason, source_kind, source_id)
      values (auth.uid(), 10, 'first_winery_visit', 'verified_visit', new_visit_id::text)
      on conflict do nothing;
      awarded := awarded + 10;
    end if;
  end if;

  return query select new_visit_id, calculated_distance, awarded;
end;
$$;

create or replace function public.complete_verified_tasting(
  requested_visit_id uuid,
  requested_menu_id uuid,
  requested_wines_tasted smallint
)
returns table (completion_id uuid, corks_awarded integer)
language plpgsql
security definer
set search_path = ''
as $$
declare new_completion_id uuid; awarded integer := 0;
begin
  if auth.uid() is null then raise exception 'Sign in before completing a tasting'; end if;
  if requested_wines_tasted not between 1 and 20 then raise exception 'Enter between 1 and 20 tasted wines'; end if;
  select id into new_completion_id from public.tasting_completions
  where visit_id = requested_visit_id and user_id = auth.uid();
  if new_completion_id is not null then
    return query select new_completion_id,
      coalesce((select sum(entry.corks)::integer from public.corks_ledger entry
        where entry.user_id = auth.uid() and entry.source_kind = 'tasting_completion'
          and entry.source_id = new_completion_id::text), 0);
    return;
  end if;
  if not exists (
    select 1 from public.verified_visits visit
    where visit.id = requested_visit_id and visit.user_id = auth.uid()
      and visit.verified_at > now() - interval '18 hours'
      and (requested_menu_id is null or exists (
        select 1 from public.tasting_menus menu
        where menu.id = requested_menu_id and menu.winery_id = visit.winery_id
      ))
  ) then raise exception 'A recent verified winery visit is required'; end if;

  insert into public.tasting_completions(user_id, visit_id, menu_id, wines_tasted)
  values (auth.uid(), requested_visit_id, requested_menu_id, requested_wines_tasted)
  returning id into new_completion_id;

  if public.has_active_sips_club(auth.uid()) then
    insert into public.corks_ledger(user_id, corks, reason, source_kind, source_id)
    values (auth.uid(), 10, 'completed_flight', 'tasting_completion', new_completion_id::text)
    on conflict do nothing;
    awarded := 10;
  end if;
  return query select new_completion_id, awarded;
end;
$$;

create or replace function public.redeem_corks_reward(requested_reward_id uuid, requested_key uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare selected_reward public.reward_catalog%rowtype; current_balance integer; redemption_id uuid; prior_count integer;
begin
  if auth.uid() is null then raise exception 'Sign in before redeeming Corks'; end if;
  perform pg_advisory_xact_lock(hashtext(auth.uid()::text));
  select id into redemption_id from public.reward_redemptions
  where user_id = auth.uid() and request_key = requested_key;
  if redemption_id is not null then return redemption_id; end if;
  if not public.has_active_sips_club(auth.uid()) then raise exception 'An active Sips Club membership is required'; end if;

  select * into selected_reward from public.reward_catalog
  where id = requested_reward_id and is_active = true
    and (starts_at is null or starts_at <= now())
    and (ends_at is null or ends_at > now())
  for update;
  if selected_reward.id is null then raise exception 'This reward is not available'; end if;

  select count(*) into prior_count from public.reward_redemptions
  where user_id = auth.uid() and reward_id = requested_reward_id and status <> 'cancelled';
  if selected_reward.per_member_limit is not null and prior_count >= selected_reward.per_member_limit then
    raise exception 'You have reached the member limit for this reward';
  end if;
  if selected_reward.inventory_limit is not null and (
    select count(*) from public.reward_redemptions
    where reward_id = requested_reward_id and status <> 'cancelled'
  ) >= selected_reward.inventory_limit then raise exception 'This reward is sold out'; end if;

  select public.my_corks_balance() into current_balance;
  if current_balance < selected_reward.corks_cost then raise exception 'Not enough Corks for this reward'; end if;

  insert into public.reward_redemptions(user_id, reward_id, corks_spent, request_key)
  values (auth.uid(), requested_reward_id, selected_reward.corks_cost, requested_key)
  returning id into redemption_id;

  insert into public.corks_ledger(user_id, corks, reason, source_kind, source_id, details)
  values (auth.uid(), -selected_reward.corks_cost, 'reward_redemption', 'reward_redemption', redemption_id::text,
    jsonb_build_object('reward_code', selected_reward.code))
  on conflict do nothing;
  return redemption_id;
end;
$$;

create or replace function public.prevent_corks_ledger_changes()
returns trigger language plpgsql set search_path = ''
as $$ begin raise exception 'Corks ledger entries are immutable'; end; $$;

drop trigger if exists corks_ledger_immutable on public.corks_ledger;
create trigger corks_ledger_immutable
before update or delete on public.corks_ledger
for each row execute procedure public.prevent_corks_ledger_changes();

alter table public.membership_plans enable row level security;
alter table public.memberships enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_attributions enable row level security;
alter table public.verified_visits enable row level security;
alter table public.tasting_completions enable row level security;
alter table public.corks_ledger enable row level security;
alter table public.reward_catalog enable row level security;
alter table public.reward_redemptions enable row level security;
alter table public.purchase_reminders enable row level security;

drop policy if exists "Public reads active membership plans" on public.membership_plans;
drop policy if exists "Sips admins read all membership plans" on public.membership_plans;
drop policy if exists "Members read their membership" on public.memberships;
drop policy if exists "Members read their referral code" on public.referral_codes;
drop policy if exists "Members read their referral activity" on public.referral_attributions;
drop policy if exists "Members read their verified visits" on public.verified_visits;
drop policy if exists "Members read their tasting completions" on public.tasting_completions;
drop policy if exists "Members read their Corks ledger" on public.corks_ledger;
drop policy if exists "Public reads available rewards" on public.reward_catalog;
drop policy if exists "Sips admins read all rewards" on public.reward_catalog;
drop policy if exists "Members read their redemptions" on public.reward_redemptions;
drop policy if exists "Members manage their purchase reminders" on public.purchase_reminders;

create policy "Public reads active membership plans" on public.membership_plans for select using (is_active);
create policy "Sips admins read all membership plans" on public.membership_plans for select to authenticated using (public.is_sips_admin());
create policy "Members read their membership" on public.memberships for select using (user_id = auth.uid() or public.is_sips_admin());
create policy "Members read their referral code" on public.referral_codes for select using (user_id = auth.uid() or public.is_sips_admin());
create policy "Members read their referral activity" on public.referral_attributions for select using (referrer_user_id = auth.uid() or invited_user_id = auth.uid() or public.is_sips_admin());
create policy "Members read their verified visits" on public.verified_visits for select using (user_id = auth.uid() or public.is_sips_admin());
create policy "Members read their tasting completions" on public.tasting_completions for select using (user_id = auth.uid() or public.is_sips_admin());
create policy "Members read their Corks ledger" on public.corks_ledger for select using (user_id = auth.uid() or public.is_sips_admin());
create policy "Public reads available rewards" on public.reward_catalog for select using (is_active);
create policy "Sips admins read all rewards" on public.reward_catalog for select to authenticated using (public.is_sips_admin());
create policy "Members read their redemptions" on public.reward_redemptions for select using (user_id = auth.uid() or public.is_sips_admin());
create policy "Members manage their purchase reminders" on public.purchase_reminders for all
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and public.has_active_sips_club(auth.uid())
  and exists (
    select 1 from public.saved_wines wine
    where wine.id = saved_wine_id and wine.user_id = auth.uid()
  )
);

revoke all on function public.has_active_sips_club(uuid) from public;
revoke all on function public.my_corks_balance() from public;
revoke all on function public.verify_winery_check_in(uuid,double precision,double precision,integer,uuid) from public;
revoke all on function public.complete_verified_tasting(uuid,uuid,smallint) from public;
revoke all on function public.redeem_corks_reward(uuid,uuid) from public;
grant execute on function public.has_active_sips_club(uuid) to authenticated;
grant execute on function public.my_corks_balance() to authenticated;
grant execute on function public.verify_winery_check_in(uuid,double precision,double precision,integer,uuid) to authenticated;
grant execute on function public.complete_verified_tasting(uuid,uuid,smallint) to authenticated;
grant execute on function public.redeem_corks_reward(uuid,uuid) to authenticated;

grant select on public.membership_plans, public.reward_catalog to anon, authenticated;
grant select on public.memberships, public.referral_codes, public.referral_attributions,
  public.verified_visits, public.tasting_completions, public.corks_ledger,
  public.reward_redemptions to authenticated;
grant select, insert, update, delete on public.purchase_reminders to authenticated;

insert into public.membership_plans(code,name,price_cents,billing_interval,is_premium,features)
values
  ('free','Free',0,'none',false,'["Save tasting history","Build trips","Join shared trips"]'::jsonb),
  ('sips-club-monthly','Sips Club',799,'month',true,'["5-Sip Cellar","Direct winery links","Purchase reminders","Calendar reminders","Corks rewards","Advanced history"]'::jsonb),
  ('sips-club-founding','Sips Club Founding Member',499,'month',true,'["5-Sip Cellar","Direct winery links","Purchase reminders","Calendar reminders","Corks rewards","Advanced history","Founding-member rate"]'::jsonb)
on conflict (code) do update set
  name = excluded.name,
  price_cents = excluded.price_cents,
  billing_interval = excluded.billing_interval,
  is_premium = excluded.is_premium,
  features = excluded.features,
  updated_at = now();

insert into public.reward_catalog(code,name,description,corks_cost,funding_source,estimated_cost_cents,per_member_limit,is_active)
values
  ('finger-lakes-starter','Finger Lakes Explorer Badge','A digital badge for beginning your verified Finger Lakes journey.',100,'digital',0,1,true),
  ('regional-map-upgrade','Premium Trip Map','Unlock a premium digital route-map style for a favorite trip.',250,'digital',0,null,true),
  ('partner-tasting-upgrade','Partner Tasting Upgrade','A participating winery-funded tasting upgrade.',500,'partner_funded',0,1,false),
  ('partner-merchandise','Partner Merchandise Add-on','A participating winery-funded merchandise add-on.',750,'partner_funded',0,1,false),
  ('partner-order-offer','Partner Wine Order Offer','A participating winery-funded order or shipping offer.',1000,'partner_funded',0,1,false)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  corks_cost = excluded.corks_cost,
  funding_source = excluded.funding_source,
  estimated_cost_cents = excluded.estimated_cost_cents,
  per_member_limit = excluded.per_member_limit,
  updated_at = now();
