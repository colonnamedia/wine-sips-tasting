-- Run after winery-admin.sql.
-- Adds private review settings and a repeatable menu-confirmation workflow.

create table if not exists public.winery_menu_settings (
  winery_id uuid primary key references public.wineries(id) on delete cascade,
  refresh_interval_months integer not null default 3 check (refresh_interval_months in (1,3,6,12)),
  reminder_enabled boolean not null default true,
  contact_email text,
  last_confirmed_at timestamptz,
  next_review_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tasting_menus
  add column if not exists last_confirmed_at timestamptz,
  add column if not exists next_review_at date;

alter table public.winery_menu_settings enable row level security;

drop policy if exists "Winery staff view menu settings" on public.winery_menu_settings;
drop policy if exists "Winery staff create menu settings" on public.winery_menu_settings;
drop policy if exists "Winery staff update menu settings" on public.winery_menu_settings;

create policy "Winery staff view menu settings"
on public.winery_menu_settings for select
using (public.is_winery_member(winery_id) or public.is_sips_admin());

create policy "Winery staff create menu settings"
on public.winery_menu_settings for insert
with check (public.is_winery_member(winery_id) or public.is_sips_admin());

create policy "Winery staff update menu settings"
on public.winery_menu_settings for update
using (public.is_winery_member(winery_id) or public.is_sips_admin())
with check (public.is_winery_member(winery_id) or public.is_sips_admin());

create or replace function public.set_menu_review_dates()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare refresh_months integer;
begin
  if new.status = 'published'
    and (tg_op = 'INSERT' or old.status is distinct from 'published' or new.published_at is distinct from old.published_at)
  then
    select refresh_interval_months into refresh_months
    from public.winery_menu_settings
    where winery_id = new.winery_id;

    new.last_confirmed_at := coalesce(new.last_confirmed_at, now());
    new.next_review_at := (new.last_confirmed_at::date + make_interval(months => coalesce(refresh_months,3)))::date;
  end if;
  return new;
end;
$$;

drop trigger if exists tasting_menu_review_dates on public.tasting_menus;
create trigger tasting_menu_review_dates
before insert or update of status,published_at on public.tasting_menus
for each row execute function public.set_menu_review_dates();

create or replace function public.confirm_published_menu_current(requested_menu_id uuid)
returns table(last_confirmed_at timestamptz,next_review_at date)
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_menu public.tasting_menus%rowtype;
  refresh_months integer;
  confirmed_at timestamptz := now();
  review_date date;
begin
  select * into selected_menu
  from public.tasting_menus
  where id = requested_menu_id and status = 'published';

  if selected_menu.id is null then raise exception 'Published menu not found'; end if;
  if not (public.is_winery_member(selected_menu.winery_id) or public.is_sips_admin()) then
    raise exception 'Winery access required';
  end if;

  select refresh_interval_months into refresh_months
  from public.winery_menu_settings
  where winery_id = selected_menu.winery_id;

  review_date := (confirmed_at::date + make_interval(months => coalesce(refresh_months,3)))::date;

  update public.tasting_menus
  set last_confirmed_at=confirmed_at,next_review_at=review_date,updated_at=confirmed_at
  where id=requested_menu_id;

  insert into public.winery_menu_settings(winery_id,last_confirmed_at,next_review_at,updated_at)
  values(selected_menu.winery_id,confirmed_at,review_date,confirmed_at)
  on conflict(winery_id) do update
  set last_confirmed_at=excluded.last_confirmed_at,
      next_review_at=excluded.next_review_at,
      updated_at=excluded.updated_at;

  insert into public.admin_audit_log(actor_id,winery_id,action,details)
  values(auth.uid(),selected_menu.winery_id,'menu_confirmed_current',jsonb_build_object('menu_id',requested_menu_id,'next_review_at',review_date));

  return query select confirmed_at,review_date;
end;
$$;

create or replace function public.sync_published_menu_review_to_settings()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published' then
    insert into public.winery_menu_settings(winery_id,last_confirmed_at,next_review_at,updated_at)
    values(new.winery_id,new.last_confirmed_at,new.next_review_at,now())
    on conflict(winery_id) do update
    set last_confirmed_at=excluded.last_confirmed_at,
        next_review_at=excluded.next_review_at,
        updated_at=excluded.updated_at;
  end if;
  return new;
end;
$$;

drop trigger if exists sync_published_menu_review on public.tasting_menus;
create trigger sync_published_menu_review
after insert or update of status,last_confirmed_at,next_review_at on public.tasting_menus
for each row execute function public.sync_published_menu_review_to_settings();

create or replace view public.winery_menu_refresh_queue
with (security_invoker=true)
as
select
  winery.id as winery_id,
  winery.name as winery_name,
  settings.contact_email,
  settings.reminder_enabled,
  coalesce(settings.refresh_interval_months,3) as refresh_interval_months,
  settings.last_confirmed_at,
  settings.next_review_at,
  menu.id as menu_id,
  menu.name as menu_name,
  menu.published_at,
  case
    when settings.next_review_at is null then 'needs_schedule'
    when settings.next_review_at < current_date then 'overdue'
    when settings.next_review_at <= current_date+14 then 'due_soon'
    else 'current'
  end as refresh_status
from public.wineries winery
left join public.winery_menu_settings settings on settings.winery_id=winery.id
left join lateral (
  select tasting.* from public.tasting_menus tasting
  where tasting.winery_id=winery.id and tasting.status='published'
  order by tasting.published_at desc nulls last limit 1
) menu on true
where public.is_sips_admin() or public.is_winery_member(winery.id);

grant select,insert,update on public.winery_menu_settings to authenticated;
grant execute on function public.confirm_published_menu_current(uuid) to authenticated;
grant select on public.winery_menu_refresh_queue to authenticated;

-- Backfill already-published menus and private settings with a quarterly default.
update public.tasting_menus
set last_confirmed_at=coalesce(last_confirmed_at,published_at,updated_at),
    next_review_at=coalesce(next_review_at,(coalesce(published_at,updated_at)::date+interval '3 months')::date)
where status='published';

insert into public.winery_menu_settings(winery_id,last_confirmed_at,next_review_at)
select winery_id,last_confirmed_at,next_review_at
from public.tasting_menus
where status='published'
on conflict(winery_id) do update
set last_confirmed_at=excluded.last_confirmed_at,
    next_review_at=excluded.next_review_at,
    updated_at=now();
