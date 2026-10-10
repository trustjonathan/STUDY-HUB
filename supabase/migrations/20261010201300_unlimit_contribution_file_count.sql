alter table public.study_hub_contribution_upload_sessions
  drop constraint if exists study_hub_contribution_upload_sessions_file_count_check;

alter table public.study_hub_contribution_upload_sessions
  add constraint study_hub_contribution_upload_sessions_file_count_check
  check (file_count >= 1);
