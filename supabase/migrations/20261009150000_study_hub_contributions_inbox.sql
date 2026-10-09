create table if not exists public.study_hub_contributions (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 3 and 120),
  original_filename text not null,
  storage_bucket text not null default 'study-hub-contributions',
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 52428800),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewer_note text
);

create index if not exists study_hub_contributions_status_idx
  on public.study_hub_contributions (status, submitted_at desc);

alter table public.study_hub_contributions enable row level security;
revoke all on public.study_hub_contributions from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'study-hub-contributions',
  'study-hub-contributions',
  false,
  52428800,
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/rtf',
    'text/plain'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.study_hub_contribution_limits (
  ip_hash text primary key,
  window_started_at timestamptz not null,
  requests integer not null check (requests >= 0)
);
alter table public.study_hub_contribution_limits enable row level security;
revoke all on public.study_hub_contribution_limits from anon, authenticated;

create or replace function public.study_hub_consume_contribution_limit(
  p_ip_hash text,
  p_now timestamptz default now()
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  request_count integer;
begin
  delete from public.study_hub_contribution_limits
  where window_started_at < p_now - interval '1 day';

  insert into public.study_hub_contribution_limits as limits (ip_hash, window_started_at, requests)
  values (p_ip_hash, p_now, 1)
  on conflict (ip_hash) do update set
    window_started_at = case
      when limits.window_started_at < p_now - interval '1 hour' then p_now
      else limits.window_started_at
    end,
    requests = case
      when limits.window_started_at < p_now - interval '1 hour' then 1
      else limits.requests + 1
    end
  returning requests into request_count;

  return request_count <= 5;
end;
$$;

revoke all on function public.study_hub_consume_contribution_limit(text, timestamptz) from public, anon, authenticated;
grant execute on function public.study_hub_consume_contribution_limit(text, timestamptz) to service_role;
