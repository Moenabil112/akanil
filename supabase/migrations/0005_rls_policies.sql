-- Akanil Platform — Phase 3B: Row Level Security policies.
--
-- Model:
--   * anon may INSERT into the public intake tables only (no reads).
--   * authenticated users see their own profile/org/NDA/permissions and only
--     the documents their window permission + NDA status allow.
--   * admins (by role rank) manage requests, documents, permissions, NDA, logs.
--   * service role (server-side) bypasses RLS for trusted writes (logs, intake).
--
-- Helper functions are SECURITY DEFINER so policy checks can read profiles /
-- window_permissions without recursing through their own RLS.

-- ----------------------------------------------------------------------------
-- Helpers
-- ----------------------------------------------------------------------------

create or replace function akanil_current_profile()
  returns uuid language sql stable security definer set search_path = public as $$
  select id from profiles where auth_user_id = auth.uid() limit 1;
$$;

create or replace function akanil_role_rank()
  returns int language sql stable security definer set search_path = public as $$
  select coalesce((
    select case admin_role
      when 'super_admin' then 100
      when 'platform_admin' then 90
      when 'data_room_manager' then 70
      when 'content_manager' then 60
      when 'reviewer' then 40
      when 'viewer' then 10
      else 0 end
    from profiles where auth_user_id = auth.uid() limit 1
  ), 0);
$$;

create or replace function akanil_is_admin()
  returns boolean language sql stable security definer set search_path = public as $$
  select akanil_role_rank() >= 10;
$$;

create or replace function akanil_nda_approved()
  returns boolean language sql stable security definer set search_path = public as $$
  select exists(
    select 1 from profiles
    where auth_user_id = auth.uid() and nda_status = 'approved'
  );
$$;

create or replace function akanil_level_rank(l access_level)
  returns int language sql immutable as $$
  select case l
    when 'public' then 0
    when 'institutional_brief' then 1
    when 'nda_data_room' then 2
    when 'technical_review' then 3
    when 'partner_internal' then 4
  end;
$$;

create or replace function akanil_window_rank(w text)
  returns int language sql stable security definer set search_path = public as $$
  select coalesce(max(akanil_level_rank(access_level)), -1)
  from window_permissions
  where profile_id = akanil_current_profile()
    and "window" = w
    and (expires_at is null or expires_at > now());
$$;

-- Prevent a non-platform-admin from escalating their own admin_role.
create or replace function akanil_guard_role_escalation()
  returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.admin_role is distinct from old.admin_role and akanil_role_rank() < 90 then
    raise exception 'insufficient privilege to change admin_role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_role_guard on profiles;
create trigger trg_profiles_role_guard before update on profiles
  for each row execute function akanil_guard_role_escalation();

-- ----------------------------------------------------------------------------
-- Public intake tables: anon INSERT only; reviewer+ read/manage
-- ----------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'access_requests','briefing_requests','qassas_demo_requests','contact_messages'
  ] loop
    execute format('drop policy if exists %1$s_insert_public on %1$s', t);
    execute format('drop policy if exists %1$s_admin_select on %1$s', t);
    execute format('drop policy if exists %1$s_admin_update on %1$s', t);
    execute format('drop policy if exists %1$s_admin_delete on %1$s', t);
    execute format(
      'create policy %1$s_insert_public on %1$s for insert to anon, authenticated with check (true)', t);
    execute format(
      'create policy %1$s_admin_select on %1$s for select to authenticated using (akanil_role_rank() >= 40)', t);
    execute format(
      'create policy %1$s_admin_update on %1$s for update to authenticated using (akanil_role_rank() >= 40) with check (akanil_role_rank() >= 40)', t);
    execute format(
      'create policy %1$s_admin_delete on %1$s for delete to authenticated using (akanil_role_rank() >= 70)', t);
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- profiles
-- ----------------------------------------------------------------------------

drop policy if exists profiles_select on profiles;
drop policy if exists profiles_insert on profiles;
drop policy if exists profiles_update on profiles;
drop policy if exists profiles_delete on profiles;

create policy profiles_select on profiles for select to authenticated
  using (auth_user_id = auth.uid() or akanil_is_admin());
create policy profiles_insert on profiles for insert to authenticated
  with check (auth_user_id = auth.uid() or akanil_role_rank() >= 70);
create policy profiles_update on profiles for update to authenticated
  using (auth_user_id = auth.uid() or akanil_role_rank() >= 90)
  with check (auth_user_id = auth.uid() or akanil_role_rank() >= 90);
create policy profiles_delete on profiles for delete to authenticated
  using (akanil_role_rank() >= 90);

-- ----------------------------------------------------------------------------
-- organizations
-- ----------------------------------------------------------------------------

drop policy if exists organizations_select on organizations;
drop policy if exists organizations_write on organizations;

create policy organizations_select on organizations for select to authenticated
  using (
    akanil_is_admin()
    or id = (select organization_id from profiles where id = akanil_current_profile())
  );
create policy organizations_write on organizations for all to authenticated
  using (akanil_role_rank() >= 70) with check (akanil_role_rank() >= 70);

-- ----------------------------------------------------------------------------
-- documents — gated SELECT; data-room-manager+ writes
-- ----------------------------------------------------------------------------

drop policy if exists documents_select on documents;
drop policy if exists documents_write on documents;

create policy documents_select on documents for select to authenticated
  using (
    access_level = 'public'
    or akanil_role_rank() >= 70
    or (
      is_active
      and akanil_window_rank("window") >= akanil_level_rank(access_level)
      and (akanil_level_rank(access_level) < 2 or akanil_nda_approved())
    )
  );
create policy documents_write on documents for all to authenticated
  using (akanil_role_rank() >= 70) with check (akanil_role_rank() >= 70);

-- ----------------------------------------------------------------------------
-- nda_records & window_permissions — own read; admin manage
-- ----------------------------------------------------------------------------

drop policy if exists nda_select on nda_records;
drop policy if exists nda_write on nda_records;
create policy nda_select on nda_records for select to authenticated
  using (akanil_role_rank() >= 70 or profile_id = akanil_current_profile());
create policy nda_write on nda_records for all to authenticated
  using (akanil_role_rank() >= 70) with check (akanil_role_rank() >= 70);

drop policy if exists winperm_select on window_permissions;
drop policy if exists winperm_write on window_permissions;
create policy winperm_select on window_permissions for select to authenticated
  using (akanil_role_rank() >= 70 or profile_id = akanil_current_profile());
create policy winperm_write on window_permissions for all to authenticated
  using (akanil_role_rank() >= 70) with check (akanil_role_rank() >= 70);

-- ----------------------------------------------------------------------------
-- Logs — read by admins; writes happen via the service role (bypasses RLS)
-- ----------------------------------------------------------------------------

drop policy if exists doclog_select on document_access_logs;
create policy doclog_select on document_access_logs for select to authenticated
  using (akanil_role_rank() >= 70);

drop policy if exists audit_select on audit_logs;
create policy audit_select on audit_logs for select to authenticated
  using (akanil_role_rank() >= 40);

drop policy if exists email_select on email_logs;
create policy email_select on email_logs for select to authenticated
  using (akanil_role_rank() >= 40);

-- ----------------------------------------------------------------------------
-- Governance tables — internal admin modules
-- ----------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'sustainability_indicators','local_impact_records','crm_opportunities',
    'decision_memos','content_reviews'
  ] loop
    execute format('drop policy if exists %1$s_select on %1$s', t);
    execute format('drop policy if exists %1$s_write on %1$s', t);
    execute format(
      'create policy %1$s_select on %1$s for select to authenticated using (akanil_role_rank() >= 40)', t);
    execute format(
      'create policy %1$s_write on %1$s for all to authenticated using (akanil_role_rank() >= 70) with check (akanil_role_rank() >= 70)', t);
  end loop;
end $$;
