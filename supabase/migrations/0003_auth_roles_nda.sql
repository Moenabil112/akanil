-- Akanil Platform — Phase 3A: controlled access foundation.
-- Adds admin roles, links profiles to auth users, and extends the NDA state
-- model on profiles and organizations. Still RLS deny-by-default; authorization
-- for the data room is enforced server-side (signed-URL action) in this phase.

-- ----------------------------------------------------------------------------
-- Admin roles
-- ----------------------------------------------------------------------------

do $$ begin
  create type admin_role as enum (
    'super_admin',
    'platform_admin',
    'data_room_manager',
    'content_manager',
    'reviewer',
    'viewer'
  );
exception when duplicate_object then null; end $$;

-- Extend the NDA lifecycle with an explicit approved state.
do $$ begin
  alter type nda_status add value if not exists 'approved';
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Profiles: role, auth link, NDA status
-- ----------------------------------------------------------------------------

alter table profiles
  add column if not exists admin_role   admin_role,
  add column if not exists auth_user_id uuid,
  add column if not exists nda_status   nda_status not null default 'pending';

create unique index if not exists idx_profiles_auth_user on profiles(auth_user_id)
  where auth_user_id is not null;
create index if not exists idx_profiles_admin_role on profiles(admin_role);

-- ----------------------------------------------------------------------------
-- Organizations: NDA gating
-- ----------------------------------------------------------------------------

alter table organizations
  add column if not exists nda_status   nda_status not null default 'pending',
  add column if not exists nda_required boolean     not null default true;
