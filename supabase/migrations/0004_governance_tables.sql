-- Akanil Platform — Phase 3B: governance-patch tables.
-- Materializes the remaining tables from 13_Governance_Patch_Schema_Additions.sql
-- so Row Level Security can target them in 0005. (qassas_demo_requests and
-- email_logs already exist from 0001.) All are internal admin modules.

create table if not exists sustainability_indicators (
  id                  uuid primary key default gen_random_uuid(),
  project_window      text not null,
  indicator_category  text not null,
  indicator_name      text not null,
  description         text,
  baseline            text,
  target              text,
  current_status      text,
  evidence_document_id uuid references documents(id) on delete set null,
  last_updated        timestamptz not null default now()
);

create table if not exists local_impact_records (
  id                 uuid primary key default gen_random_uuid(),
  project_window     text,
  location           text,
  record_type        text,
  description        text,
  source             text,
  sensitivity_level  sensitivity_level not null default 'restricted',
  related_document_id uuid references documents(id) on delete set null,
  status             text not null default 'draft',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists crm_opportunities (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid references organizations(id) on delete set null,
  primary_contact  text,
  interest_area    text,
  related_window   text,
  stage            text not null default 'new_inquiry',
  last_contact_at  timestamptz,
  next_action      text,
  internal_owner   text,
  notes            text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists decision_memos (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null,
  related_window       text,
  related_project      text,
  summary              text,
  evidence_level       text,
  risk_summary         text,
  pending_validations  text,
  recommended_next_step text,
  status               text not null default 'draft',
  created_by           text,
  approved_by          text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table if not exists content_reviews (
  id                   uuid primary key default gen_random_uuid(),
  content_type         text not null,
  content_id           text not null,
  status               text not null default 'draft',
  review_required      boolean not null default true,
  technical_reviewed_by text,
  legal_reviewed_by    text,
  final_approved_by    text,
  approval_date        timestamptz,
  publish_date         timestamptz,
  archive_date         timestamptz,
  notes                text,
  created_at           timestamptz not null default now()
);

alter table sustainability_indicators enable row level security;
alter table local_impact_records      enable row level security;
alter table crm_opportunities         enable row level security;
alter table decision_memos            enable row level security;
alter table content_reviews           enable row level security;
