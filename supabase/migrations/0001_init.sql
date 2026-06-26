-- Akanil Platform — Institutional Access + Data Room schema
-- Phase 2A: persistence for public requests, organizations, profiles,
-- document metadata, NDA records, and audit logs.
--
-- Design notes:
--  * Follows the table shapes in 08_Akanil_Backend_Recommendation_EN.md and
--    13_Governance_Patch_Schema_Additions.sql.
--  * RLS is enabled and deny-by-default on every table. The public website
--    writes exclusively through the Supabase service-role key on the server,
--    which bypasses RLS; the anon key is never used against these tables.
--    Authenticated end-user / partner policies are added in Phase 3 alongside
--    Supabase Auth + window permissions.

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- Enums
-- ----------------------------------------------------------------------------

-- The five Akanil access levels (08 §6) — also the Data Room layer structure.
do $$ begin
  create type access_level as enum (
    'public',
    'institutional_brief',
    'nda_data_room',
    'technical_review',
    'partner_internal'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type request_status as enum (
    'pending',
    'in_review',
    'approved',
    'declined',
    'closed'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type nda_status as enum ('pending', 'sent', 'signed', 'expired', 'revoked');
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Core entities
-- ----------------------------------------------------------------------------

create table if not exists organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        text,
  country     text,
  website     text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists profiles (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid,                       -- maps to auth.users in Phase 3
  full_name       text,
  email           text,
  phone           text,
  role            text,
  country         text,
  organization_id uuid references organizations(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Public intake — one table per request channel
-- ----------------------------------------------------------------------------

create table if not exists access_requests (
  id               uuid primary key default gen_random_uuid(),
  full_name        text not null,
  email            text not null,
  organization     text,
  role             text,
  country          text,
  area_of_interest text,
  requested_window text,
  requested_level  access_level,
  message          text,
  status           request_status not null default 'pending',
  nda_required      boolean not null default false,
  nda_acknowledged  boolean not null default false,
  source           text,
  created_at       timestamptz not null default now(),
  reviewed_at      timestamptz,
  reviewed_by      uuid
);

create table if not exists briefing_requests (
  id              uuid primary key default gen_random_uuid(),
  full_name       text not null,
  email           text not null,
  organization    text,
  role            text,
  requested_topic text,
  related_window  text,
  message         text,
  status          request_status not null default 'pending',
  source          text,
  created_at      timestamptz not null default now(),
  reviewed_at     timestamptz,
  reviewed_by     uuid
);

create table if not exists qassas_demo_requests (
  id                     uuid primary key default gen_random_uuid(),
  full_name              text not null,
  email                  text not null,
  organization           text,
  role                   text,
  country                text,
  use_case               text,
  requested_access_level text default 'demo',
  status                 request_status not null default 'pending',
  source                 text,
  approved_by            uuid,
  approved_at            timestamptz,
  expires_at             timestamptz,
  created_at             timestamptz not null default now()
);

create table if not exists contact_messages (
  id            uuid primary key default gen_random_uuid(),
  full_name     text not null,
  email         text not null,
  organization  text,
  role          text,
  reason        text,
  message       text,
  status        request_status not null default 'pending',
  source        text,
  created_at    timestamptz not null default now(),
  reviewed_at   timestamptz,
  reviewed_by   uuid
);

-- ----------------------------------------------------------------------------
-- Data Room — document metadata + access control (files stay gated)
-- ----------------------------------------------------------------------------

create table if not exists documents (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  window        text,
  document_type text,
  access_level  access_level not null default 'institutional_brief',
  storage_path  text,                         -- never exposed to clients
  language      text default 'en',
  version       text default '1',
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists document_access_logs (
  id              uuid primary key default gen_random_uuid(),
  document_id     uuid references documents(id) on delete cascade,
  user_id         uuid,
  organization_id uuid references organizations(id) on delete set null,
  accessed_at     timestamptz not null default now(),
  ip_address      text,
  user_agent      text
);

create table if not exists nda_records (
  id               uuid primary key default gen_random_uuid(),
  profile_id       uuid references profiles(id) on delete set null,
  organization_id  uuid references organizations(id) on delete set null,
  status           nda_status not null default 'pending',
  signed_file_path text,
  signed_at        timestamptz,
  approved_by      uuid,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists window_permissions (
  id           uuid primary key default gen_random_uuid(),
  profile_id   uuid references profiles(id) on delete cascade,
  window       text not null,
  access_level access_level not null default 'institutional_brief',
  granted_by   uuid,
  granted_at   timestamptz not null default now(),
  expires_at   timestamptz
);

-- ----------------------------------------------------------------------------
-- Governance & operations
-- ----------------------------------------------------------------------------

create table if not exists audit_logs (
  id            uuid primary key default gen_random_uuid(),
  actor         text,                         -- admin email (Phase 3: auth uid)
  action_type   text not null,                -- e.g. 'status_update', 'login'
  target_type   text,                         -- table / entity
  target_id     text,
  metadata      jsonb,
  notes         text,
  created_at    timestamptz not null default now()
);

create table if not exists email_logs (
  id                 uuid primary key default gen_random_uuid(),
  template_name      text not null,
  recipient_email    text not null,
  related_request_id uuid,
  status             text,
  sent_at            timestamptz not null default now(),
  error_message      text
);

-- ----------------------------------------------------------------------------
-- Indexes
-- ----------------------------------------------------------------------------

create index if not exists idx_access_requests_status   on access_requests(status);
create index if not exists idx_access_requests_created  on access_requests(created_at desc);
create index if not exists idx_briefing_requests_status on briefing_requests(status);
create index if not exists idx_qassas_requests_status   on qassas_demo_requests(status);
create index if not exists idx_contact_messages_status  on contact_messages(status);
create index if not exists idx_documents_access_level   on documents(access_level);
create index if not exists idx_audit_logs_created       on audit_logs(created_at desc);

-- ----------------------------------------------------------------------------
-- Row Level Security — deny-by-default. Service role bypasses RLS.
-- ----------------------------------------------------------------------------

alter table organizations        enable row level security;
alter table profiles             enable row level security;
alter table access_requests      enable row level security;
alter table briefing_requests    enable row level security;
alter table qassas_demo_requests enable row level security;
alter table contact_messages     enable row level security;
alter table documents            enable row level security;
alter table document_access_logs enable row level security;
alter table nda_records          enable row level security;
alter table window_permissions   enable row level security;
alter table audit_logs           enable row level security;
alter table email_logs           enable row level security;

-- No anon/authenticated policies are defined yet: with RLS on and no policies,
-- only the service-role key (used server-side) can read or write. Authenticated
-- partner/end-user policies arrive in Phase 3 with Supabase Auth.

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

do $$
declare t text;
begin
  foreach t in array array[
    'organizations','profiles','documents','nda_records'
  ] loop
    execute format(
      'drop trigger if exists trg_%1$s_updated_at on %1$s;
       create trigger trg_%1$s_updated_at before update on %1$s
       for each row execute function set_updated_at();', t);
  end loop;
end $$;
