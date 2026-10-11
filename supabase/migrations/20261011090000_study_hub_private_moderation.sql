create table if not exists public.study_hub_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.study_hub_admins enable row level security;
revoke all on public.study_hub_admins from public, anon, authenticated;
grant select on public.study_hub_admins to service_role;

alter table public.study_hub_contributions
  add column if not exists reviewer_user_id uuid references auth.users (id) on delete set null;
alter table public.study_hub_suggestions
  add column if not exists reviewer_user_id uuid references auth.users (id) on delete set null;

create table if not exists public.study_hub_moderation_activity (
  id bigint generated always as identity primary key,
  entity_type text not null check (entity_type in ('contribution', 'suggestion')),
  entity_id uuid not null,
  event_type text not null check (event_type in ('submitted', 'approved', 'rejected')),
  previous_status text,
  new_status text not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists study_hub_moderation_activity_created_idx
  on public.study_hub_moderation_activity (created_at desc);

alter table public.study_hub_moderation_activity enable row level security;
revoke all on public.study_hub_moderation_activity from public, anon, authenticated;
grant select, insert on public.study_hub_moderation_activity to service_role;

create or replace function public.study_hub_record_moderation_activity()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  previous_state text;
  current_state text;
  entity_kind text;
  entity_key uuid;
begin
  entity_kind := case
    when tg_table_name = 'study_hub_contributions' then 'contribution'
    else 'suggestion'
  end;
  entity_key := new.id;
  current_state := new.status;

  if tg_op = 'INSERT' then
    insert into public.study_hub_moderation_activity (
      entity_type, entity_id, event_type, previous_status, new_status, actor_user_id
    ) values (
      entity_kind, entity_key, 'submitted', null, current_state, auth.uid()
    );
    return new;
  end if;

  previous_state := old.status;
  if previous_state is distinct from current_state then
    insert into public.study_hub_moderation_activity (
      entity_type, entity_id, event_type, previous_status, new_status, actor_user_id
    ) values (
      entity_kind,
      entity_key,
      current_state,
      previous_state,
      current_state,
      new.reviewer_user_id
    );
  end if;
  return new;
end;
$$;

revoke all on function public.study_hub_record_moderation_activity() from public, anon, authenticated;

drop trigger if exists study_hub_contribution_activity on public.study_hub_contributions;
create trigger study_hub_contribution_activity
  after insert or update of status on public.study_hub_contributions
  for each row execute function public.study_hub_record_moderation_activity();

drop trigger if exists study_hub_suggestion_activity on public.study_hub_suggestions;
create trigger study_hub_suggestion_activity
  after insert or update of status on public.study_hub_suggestions
  for each row execute function public.study_hub_record_moderation_activity();
