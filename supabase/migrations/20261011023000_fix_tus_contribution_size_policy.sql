drop policy if exists "Users can stage files in their active contribution session" on storage.objects;
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
        and item.size_bytes between 1 and 52428800
        and case
          when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$'
            then (metadata ->> 'size')::bigint <= item.size_bytes
          when coalesce(metadata ->> 'size', '') = ''
            then true
          else false
        end
    )
  );

drop policy if exists "Users can resume their own contribution uploads" on storage.objects;
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
        and item.size_bytes between 1 and 52428800
        and case
          when coalesce(metadata ->> 'size', '') ~ '^[0-9]+$'
            then (metadata ->> 'size')::bigint <= item.size_bytes
          when coalesce(metadata ->> 'size', '') = ''
            then true
          else false
        end
    )
  );
