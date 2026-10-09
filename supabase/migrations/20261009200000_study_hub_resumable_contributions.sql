create table if not exists public.study_hub_contribution_upload_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'uploading' check (status in ('uploading', 'finalizing', 'submitted', 'expired', 'cancelled')),
  file_count integer not null check (file_count between 1 and 20),
  total_size_bytes bigint not null check (total_size_bytes between 1 and 262144000),
  rights_confirmed boolean not null default false check (rights_confirmed),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours'),
  submitted_at timestamptz
);

create index if not exists study_hub_contribution_upload_sessions_expiry_idx
  on public.study_hub_contribution_upload_sessions (expires_at)
  where status = 'uploading';

create table if not exists public.study_hub_contribution_upload_items (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.study_hub_contribution_upload_sessions (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 120),
  original_filename text not null check (char_length(original_filename) between 1 and 255),
  storage_path text not null unique,
  contribution_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  status text not null default 'staging' check (status in ('staging', 'submitted')),
  created_at timestamptz not null default now(),
  submitted_at timestamptz,
  unique (session_id, id)
);

create index if not exists study_hub_contribution_upload_items_session_idx
  on public.study_hub_contribution_upload_items (session_id, status);

alter table public.study_hub_contribution_upload_sessions enable row level security;
alter table public.study_hub_contribution_upload_items enable row level security;
revoke all on public.study_hub_contribution_upload_sessions from anon, authenticated;
revoke all on public.study_hub_contribution_upload_items from anon, authenticated;
grant select on public.study_hub_contribution_upload_sessions to authenticated;
grant select on public.study_hub_contribution_upload_items to authenticated;
grant all on public.study_hub_contribution_upload_sessions to service_role;
grant all on public.study_hub_contribution_upload_items to service_role;

create policy "Users can view their own contribution upload sessions"
  on public.study_hub_contribution_upload_sessions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can view their own contribution upload items"
  on public.study_hub_contribution_upload_items
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can stage files in their active contribution session"
  on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'study-hub-contributions'
    and (storage.foldername(name))[1] = 'staging'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1
      from public.study_hub_contribution_upload_items item
      join public.study_hub_contribution_upload_sessions session
        on session.id = item.session_id
      where item.user_id = (select auth.uid())
        and item.status = 'staging'
        and item.storage_path = name
        and (
          session.status = 'finalizing'
          or (session.status = 'uploading' and session.expires_at > now())
        )
        and coalesce(item.size_bytes, 0) <= 52428800
        and case
          when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$'
            then (metadata ->> 'size')::bigint <= item.size_bytes
          else false
        end
    )
  );

create policy "Users can resume their own contribution uploads"
  on storage.objects
  for update to authenticated
  using (
    bucket_id = 'study-hub-contributions'
    and (storage.foldername(name))[1] = 'staging'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1
      from public.study_hub_contribution_upload_items item
      join public.study_hub_contribution_upload_sessions session
        on session.id = item.session_id
      where item.user_id = (select auth.uid())
        and item.status = 'staging'
        and item.storage_path = name
        and (
          session.status = 'finalizing'
          or (session.status = 'uploading' and session.expires_at > now())
        )
    )
  )
  with check (
    bucket_id = 'study-hub-contributions'
    and (storage.foldername(name))[1] = 'staging'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1
      from public.study_hub_contribution_upload_items item
      join public.study_hub_contribution_upload_sessions session
        on session.id = item.session_id
      where item.user_id = (select auth.uid())
        and item.status = 'staging'
        and item.storage_path = name
        and (
          session.status = 'finalizing'
          or (session.status = 'uploading' and session.expires_at > now())
        )
        and case
          when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$'
            then (metadata ->> 'size')::bigint <= item.size_bytes
          else false
        end
    )
  );

create policy "Users can view their own staged contribution files"
  on storage.objects
  for select to authenticated
  using (
    bucket_id = 'study-hub-contributions'
    and (storage.foldername(name))[1] = 'staging'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );

create policy "Users can delete their own staged contribution files"
  on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'study-hub-contributions'
    and (storage.foldername(name))[1] = 'staging'
    and (storage.foldername(name))[2] = (select auth.uid())::text
  );
