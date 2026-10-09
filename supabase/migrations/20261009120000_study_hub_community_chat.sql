-- Study Hub shared student chat: authenticated reads and owner-only writes.

create table if not exists public.study_hub_chat_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  user_name text not null check (char_length(user_name) between 1 and 40),
  content text not null check (char_length(content) between 1 and 2000 and btrim(content) <> ''),
  created_at timestamptz not null default now()
);

create index if not exists study_hub_chat_messages_created_at_idx
  on public.study_hub_chat_messages (created_at desc);

alter table public.study_hub_chat_messages enable row level security;

drop policy if exists "Study Hub chat is readable by authenticated users"
  on public.study_hub_chat_messages;
create policy "Study Hub chat is readable by authenticated users"
  on public.study_hub_chat_messages for select to authenticated
  using (true);

drop policy if exists "Study Hub users insert their own chat messages"
  on public.study_hub_chat_messages;
create policy "Study Hub users insert their own chat messages"
  on public.study_hub_chat_messages for insert to authenticated
  with check (
    auth.uid() = user_id
    and user_name = coalesce(
      nullif(auth.jwt() -> 'user_metadata' ->> 'display_name', ''),
      nullif(split_part(auth.jwt() ->> 'email', '@', 1), ''),
      'Student'
    )
  );

drop policy if exists "Study Hub users delete their own chat messages"
  on public.study_hub_chat_messages;
create policy "Study Hub users delete their own chat messages"
  on public.study_hub_chat_messages for delete to authenticated
  using (auth.uid() = user_id);

grant select, delete on public.study_hub_chat_messages to authenticated;
grant insert (user_id, user_name, content) on public.study_hub_chat_messages to authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'study_hub_chat_messages'
     ) then
    alter publication supabase_realtime add table public.study_hub_chat_messages;
  end if;
end;
$$;