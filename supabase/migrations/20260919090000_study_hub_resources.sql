-- ===========================================================================
-- Study Hub :: study material moved out of GitHub and into Supabase
--
-- Migration:  20260919090000_study_hub_resources
-- Apply:      cd backend && npm run db:push        (or paste into the SQL editor)
--
-- Creates:
--   1. storage bucket `study-hub-resources` (public read, 50 MB per-file cap)
--   2. public.study_hub_resources   (catalog of every uploaded file)
--   3. RLS: anonymous SELECT only; writes happen with the service_role key
--
-- SAFETY / IDEMPOTENCY
--   * Every object below is namespaced `study_hub_*` / `study-hub-*` on purpose.
--     A Supabase project may already host another app with its own `resources`
--     table and `resources` bucket - this migration never touches those.
--   * Everything is `if not exists` / `drop .. if exists` so it can be re-run.
--
-- After applying:  cd backend && npm run resources:upload
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Storage bucket
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'study-hub-resources',
  'study-hub-resources',
  true,
  52428800, -- 50 MB, the ceiling on the Supabase Free plan
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',
    'text/plain'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 2. Catalog table
-- ---------------------------------------------------------------------------
create table if not exists public.study_hub_resources (
  id                uuid primary key default gen_random_uuid(),
  subject           text        not null,
  category          text        check (category in ('notes', 'papers')),
  storage_bucket    text        not null default 'study-hub-resources',
  storage_path      text        not null,
  original_filename text        not null,
  title             text,
  extension         text        not null,
  mime_type         text,
  size_bytes        bigint      not null default 0,
  checksum_sha256   text,
  level             text,
  year              integer,
  resource_type     text,
  duplicate_of      text,
  uploaded_at       timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint study_hub_resources_unique_object unique (storage_bucket, storage_path)
);

create index if not exists study_hub_resources_subject_idx   on public.study_hub_resources (subject);
create index if not exists study_hub_resources_category_idx  on public.study_hub_resources (category);
create index if not exists study_hub_resources_level_idx     on public.study_hub_resources (level);
create index if not exists study_hub_resources_type_idx      on public.study_hub_resources (resource_type);
create index if not exists study_hub_resources_checksum_idx  on public.study_hub_resources (checksum_sha256);

-- Free text search over title + filename.
create index if not exists study_hub_resources_search_idx
  on public.study_hub_resources
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || original_filename));

-- Keep updated_at honest when the uploader re-runs.
create or replace function public.study_hub_touch_resources_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists study_hub_trg_resources_updated_at on public.study_hub_resources;
create trigger study_hub_trg_resources_updated_at
  before update on public.study_hub_resources
  for each row execute function public.study_hub_touch_resources_updated_at();

-- ---------------------------------------------------------------------------
-- 3. Row level security
-- ---------------------------------------------------------------------------
alter table public.study_hub_resources enable row level security;

-- Anyone may read the catalog; the files themselves are public in the bucket.
drop policy if exists "Study Hub resources are publicly readable" on public.study_hub_resources;
create policy "Study Hub resources are publicly readable"
  on public.study_hub_resources
  for select
  to anon, authenticated
  using (true);

-- No insert/update/delete policies on purpose: only the service_role key
-- (used by backend/scripts/upload-resources.js) can write, and service_role
-- bypasses RLS.

drop policy if exists "Study Hub public read access" on storage.objects;
create policy "Study Hub public read access"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'study-hub-resources');