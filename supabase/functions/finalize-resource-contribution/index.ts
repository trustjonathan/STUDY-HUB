import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  BUCKET,
  authenticateUser,
  corsHeaders,
  isAllowedOrigin,
  jsonResponse,
  matchesFileSignature,
  safeExtension,
  verifyTurnstile,
} from '../_shared/contribution.ts';

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const headers = corsHeaders(origin);
  if (request.method === 'OPTIONS') {
    if (!isAllowedOrigin(origin)) return jsonResponse({ error: 'Origin not allowed.' }, 403, headers);
    return new Response(null, { status: 204, headers });
  }
  if (!isAllowedOrigin(origin)) return jsonResponse({ error: 'Origin not allowed.' }, 403, headers);
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, headers);

  const apiUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiUrl || !anonKey || !serviceRoleKey) return jsonResponse({ error: 'Upload service is not configured.' }, 503, headers);
  const user = await authenticateUser(request, apiUrl, anonKey);
  if (!user) return jsonResponse({ error: 'A valid anonymous upload session is required.' }, 401, headers);

  let body: { sessionId?: unknown; turnstileToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid finalization request.' }, 400, headers);
  }
  if (typeof body.sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.sessionId)) {
    return jsonResponse({ error: 'The upload session is invalid.' }, 400, headers);
  }

  const remoteIp = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
  if (typeof body.turnstileToken !== 'string' || !(await verifyTurnstile(body.turnstileToken, remoteIp, new URL(origin).hostname))) {
    return jsonResponse({ error: 'Verification failed. Please try again.' }, 403, headers);
  }

  const supabase = createClient(apiUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: sessionError } = await supabase
    .from('study_hub_contribution_upload_sessions')
    .select('id, user_id, status, expires_at, rights_confirmed')
    .eq('id', body.sessionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (sessionError) return jsonResponse({ error: 'Could not load this upload session.' }, 503, headers);
  if (!session) return jsonResponse({ error: 'The upload session was not found.' }, 404, headers);
  if (session.status === 'submitted') return jsonResponse({ status: 'pending' }, 202, headers);
  if (session.status !== 'uploading' && session.status !== 'finalizing') {
    return jsonResponse({ error: 'This upload session has expired. Please start a new batch.' }, 410, headers);
  }
  if (session.status === 'uploading' && new Date(session.expires_at).getTime() <= Date.now()) {
    return jsonResponse({ error: 'This upload session has expired. Please start a new batch.' }, 410, headers);
  }
  if (session.status === 'uploading') {
    const { error: finalizingError } = await supabase
      .from('study_hub_contribution_upload_sessions')
      .update({ status: 'finalizing' })
      .eq('id', session.id)
      .eq('user_id', user.id)
      .eq('status', 'uploading');
    if (finalizingError) {
      console.error('Could not lock the contribution batch for submission.', finalizingError);
      return jsonResponse({ error: 'Could not begin submitting this batch. Please retry.' }, 503, headers);
    }
  }

  const pageSize = 500;
  let itemCount = 0;
  for (let offset = 0; ; offset += pageSize) {
    const { data: items, error: itemsError } = await supabase
      .from('study_hub_contribution_upload_items')
      .select('id, title, original_filename, storage_path, contribution_path, mime_type, size_bytes, status')
      .eq('session_id', session.id)
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (itemsError) return jsonResponse({ error: 'Could not load the files in this upload session.' }, 503, headers);
    if (!items?.length) {
      if (offset === 0) return jsonResponse({ error: 'This upload session has no files.' }, 409, headers);
      break;
    }
    itemCount += items.length;

    for (const item of items) {
      if (item.status === 'submitted') continue;
      const extension = safeExtension(item.original_filename, item.mime_type);
      if (!extension) return jsonResponse({ error: `The file type for "${item.original_filename}" is no longer supported.` }, 415, headers);

      let stagedFile = await supabase.storage.from(BUCKET).download(item.storage_path);
      let stagedFromContributionPath = false;
      if (stagedFile.error) {
        stagedFile = await supabase.storage.from(BUCKET).download(item.contribution_path);
        stagedFromContributionPath = !stagedFile.error;
      }
      if (stagedFile.error) {
        return jsonResponse({ error: `"${item.original_filename}" is not fully uploaded yet. Resume the batch and try again.` }, 409, headers);
      }
      if (stagedFile.data.size !== Number(item.size_bytes) || !(await matchesFileSignature(stagedFile.data, extension))) {
        const removePath = stagedFromContributionPath ? item.contribution_path : item.storage_path;
        const { error: removeError } = await supabase.storage.from(BUCKET).remove([removePath]);
        if (removeError) console.error('Could not remove a rejected contribution file.', removeError);
        return jsonResponse({ error: `"${item.original_filename}" does not match its declared file type or size.` }, 415, headers);
      }

      if (!stagedFromContributionPath) {
        const { error: moveError } = await supabase.storage.from(BUCKET).move(item.storage_path, item.contribution_path);
        if (moveError) {
          console.error('Could not promote a staged contribution file.', moveError);
          return jsonResponse({ error: `Could not submit "${item.original_filename}". Please retry the batch.` }, 503, headers);
        }
      }

      const { error: contributionError } = await supabase.from('study_hub_contributions').upsert({
        id: item.id,
        title: item.title,
        original_filename: item.original_filename,
        storage_bucket: BUCKET,
        storage_path: item.contribution_path,
        mime_type: item.mime_type,
        size_bytes: item.size_bytes,
        status: 'pending',
      }, { onConflict: 'id', ignoreDuplicates: true });
      if (contributionError) {
        console.error('Could not queue a promoted contribution file.', contributionError);
        return jsonResponse({ error: `Could not queue "${item.original_filename}" for review. Please retry the batch.` }, 503, headers);
      }

      const { error: itemUpdateError } = await supabase
        .from('study_hub_contribution_upload_items')
        .update({ status: 'submitted', submitted_at: new Date().toISOString() })
        .eq('id', item.id)
        .eq('user_id', user.id);
      if (itemUpdateError) {
        console.error('Could not mark a contribution upload item as submitted.', itemUpdateError);
        return jsonResponse({ error: 'Some files were submitted, but the batch could not be fully confirmed. Retry to safely finish.' }, 503, headers);
      }
    }
    if (items.length < pageSize) break;
  }

  const { error: completeError } = await supabase
    .from('study_hub_contribution_upload_sessions')
    .update({ status: 'submitted', submitted_at: new Date().toISOString() })
    .eq('id', session.id)
    .eq('user_id', user.id);
  if (completeError) {
    console.error('Could not mark a contribution upload session as submitted.', completeError);
    return jsonResponse({ error: 'The files were queued, but the batch status could not be updated. Retry to confirm.' }, 503, headers);
  }
  return jsonResponse({ status: 'pending', count: itemCount }, 202, headers);
});
