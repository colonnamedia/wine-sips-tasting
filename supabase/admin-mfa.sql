-- Run after winery-admin.sql.
-- Requires an AAL2 Supabase session for approved winery and Sips-admin work.
-- Public winery listings and published tasting menus remain readable.

drop policy if exists "MFA required for winery updates" on public.wineries;
create policy "MFA required for winery updates" on public.wineries
as restrictive for update to authenticated
using ((select auth.jwt()->>'aal') = 'aal2')
with check ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "MFA required to review claims" on public.winery_claims;
create policy "MFA required to review claims" on public.winery_claims
as restrictive for update to authenticated
using ((select auth.jwt()->>'aal') = 'aal2')
with check ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "MFA required to view winery memberships" on public.winery_members;
create policy "MFA required to view winery memberships" on public.winery_members
as restrictive for select to authenticated
using ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "Published menus or MFA" on public.tasting_menus;
create policy "Published menus or MFA" on public.tasting_menus
as restrictive for select to authenticated
using (status = 'published' or (select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "MFA required to create menus" on public.tasting_menus;
create policy "MFA required to create menus" on public.tasting_menus
as restrictive for insert to authenticated
with check ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "MFA required to update menus" on public.tasting_menus;
create policy "MFA required to update menus" on public.tasting_menus
as restrictive for update to authenticated
using ((select auth.jwt()->>'aal') = 'aal2')
with check ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "MFA required to delete menus" on public.tasting_menus;
create policy "MFA required to delete menus" on public.tasting_menus
as restrictive for delete to authenticated
using ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "Published menu items or MFA" on public.menu_items;
create policy "Published menu items or MFA" on public.menu_items
as restrictive for select to authenticated
using (
  (select auth.jwt()->>'aal') = 'aal2'
  or exists (
    select 1 from public.tasting_menus menu
    where menu.id = menu_id and menu.status = 'published'
  )
);

drop policy if exists "MFA required to create menu items" on public.menu_items;
create policy "MFA required to create menu items" on public.menu_items
as restrictive for insert to authenticated
with check ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "MFA required to update menu items" on public.menu_items;
create policy "MFA required to update menu items" on public.menu_items
as restrictive for update to authenticated
using ((select auth.jwt()->>'aal') = 'aal2')
with check ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "MFA required to delete menu items" on public.menu_items;
create policy "MFA required to delete menu items" on public.menu_items
as restrictive for delete to authenticated
using ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "MFA required to record imports" on public.winery_imports;
create policy "MFA required to record imports" on public.winery_imports
as restrictive for insert to authenticated
with check ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "MFA required to view imports" on public.winery_imports;
create policy "MFA required to view imports" on public.winery_imports
as restrictive for select to authenticated
using ((select auth.jwt()->>'aal') = 'aal2');

drop policy if exists "MFA required to view admin audit log" on public.admin_audit_log;
create policy "MFA required to view admin audit log" on public.admin_audit_log
as restrictive for select to authenticated
using ((select auth.jwt()->>'aal') = 'aal2');

create or replace function public.approve_winery_claim(requested_claim_id uuid)
returns uuid language plpgsql security definer set search_path=''
as $$
declare selected_claim public.winery_claims%rowtype; selected_winery_id uuid;
begin
  if coalesce(auth.jwt()->>'aal','aal1') <> 'aal2' then
    raise exception 'Two-factor verification is required';
  end if;
  if not public.is_sips_admin() then
    raise exception 'Sips administrator access required';
  end if;
  select * into selected_claim
  from public.winery_claims
  where id=requested_claim_id and status='pending';
  if selected_claim.id is null then raise exception 'Pending claim not found'; end if;
  if selected_claim.winery_id is not null then
    selected_winery_id:=selected_claim.winery_id;
  else
    insert into public.wineries(directory_ref,name,slug,website,profile_status)
    values(
      selected_claim.directory_ref,
      selected_claim.winery_name,
      trim(both '-' from regexp_replace(lower(selected_claim.winery_name),'[^a-z0-9]+','-','g')),
      selected_claim.website,
      'claimed'
    )
    on conflict(directory_ref) do update
      set profile_status='claimed',
          website=coalesce(excluded.website,public.wineries.website),
          updated_at=now()
    returning id into selected_winery_id;
  end if;
  insert into public.winery_members(winery_id,user_id,role)
  values(selected_winery_id,selected_claim.user_id,'owner')
  on conflict do nothing;
  update public.winery_claims
  set status='approved',winery_id=selected_winery_id,reviewed_by=auth.uid(),reviewed_at=now()
  where id=requested_claim_id;
  update public.profiles
  set role=case when role='sips_admin' then role else 'winery_admin' end,updated_at=now()
  where id=selected_claim.user_id;
  insert into public.admin_audit_log(actor_id,winery_id,action,details)
  values(auth.uid(),selected_winery_id,'claim_approved',jsonb_build_object('claim_id',requested_claim_id));
  return selected_winery_id;
end; $$;

grant execute on function public.approve_winery_claim(uuid) to authenticated;
