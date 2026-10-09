-- Anonymous suggestions are private until a moderator approves them.

create table if not exists public.study_hub_suggestions (
  id uuid primary key default gen_random_uuid(),
  content text not null check (
    char_length(content) between 1 and 1000
    and content ~ '[^[:space:]]'
  ),
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create index if not exists study_hub_suggestions_approved_created_idx
  on public.study_hub_suggestions (created_at desc)
  where status = 'approved';

alter table public.study_hub_suggestions enable row level security;

drop policy if exists "Study Hub suggestions are readable after approval"
  on public.study_hub_suggestions;
create policy "Study Hub suggestions are readable after approval"
  on public.study_hub_suggestions for select to anon
  using (status = 'approved');

drop policy if exists "Anyone may submit a pending Study Hub suggestion"
  on public.study_hub_suggestions;
create policy "Anyone may submit a pending Study Hub suggestion"
  on public.study_hub_suggestions for insert to anon
  with check (status = 'pending');

revoke all on public.study_hub_suggestions from public, anon, authenticated;
grant select (id, content, created_at, status)
  on public.study_hub_suggestions to anon;
grant insert (content)
  on public.study_hub_suggestions to anon;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'study_hub_suggestions'
     ) then
    alter publication supabase_realtime add table public.study_hub_suggestions;
  end if;
end;
$$;