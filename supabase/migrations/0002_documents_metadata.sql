-- Akanil Platform — Phase 2B: extended document metadata + private storage bucket.
-- Adds the full institutional document metadata model and a PRIVATE storage
-- bucket. File access stays gated: uploads go through the service-role key
-- server-side; no public URLs are issued and raw storage paths are never
-- exposed to clients. Protected, NDA-checked signed-URL delivery is Phase 3.

-- ----------------------------------------------------------------------------
-- New enums
-- ----------------------------------------------------------------------------

do $$ begin
  create type sensitivity_level as enum (
    'public',
    'internal',
    'confidential',
    'restricted',
    'secret'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type document_status as enum (
    'draft',
    'in_review',
    'approved',
    'published',
    'archived'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- Extend documents
-- ----------------------------------------------------------------------------

alter table documents
  add column if not exists sensitivity_level sensitivity_level not null default 'confidential',
  add column if not exists status            document_status   not null default 'draft',
  add column if not exists owner             text,
  add column if not exists review_date       date,
  add column if not exists expiry_date       date,
  add column if not exists approved_by       text,
  add column if not exists related_entity    text,
  add column if not exists tags              text[] not null default '{}';

create index if not exists idx_documents_status      on documents(status);
create index if not exists idx_documents_sensitivity on documents(sensitivity_level);
create index if not exists idx_documents_tags        on documents using gin (tags);

-- ----------------------------------------------------------------------------
-- Private storage bucket for data room files
-- ----------------------------------------------------------------------------
-- Created idempotently. `public = false` means objects are never servable via
-- a public URL; access requires a server-side signed URL (Phase 3).

insert into storage.buckets (id, name, public)
values ('akanil-data-room', 'akanil-data-room', false)
on conflict (id) do update set public = false;

-- No anon/authenticated storage policies: with RLS on storage.objects and no
-- policies for this bucket, only the service-role key can read/write its
-- objects. Phase 3 introduces NDA-gated, signed-URL access.
