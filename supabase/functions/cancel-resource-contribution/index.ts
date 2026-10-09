import { createClient } from 'npm:@supabase/supabase-js@2';
import { BUCKET, authenticateUser, corsHeaders, isAllowedOrigin, jsonResponse } from '../_shared/contribution.ts';

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

  let body: { sessionId?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid cancellation request.' }, 400, headers);
  }
  if (typeof body.sessionId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.sessionId)) {
    return jsonResponse({ error: 'The upload session is invalid.' }, 400, headers);
  }

  const supabase = createClient(apiUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: sessionError } = await supabase
    .from('study_hub_contribution_upload_sessions')
    .select('id, status')
    .eq('id', body.sessionId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (sessionError) return jsonResponse({ error: 'Could not load this upload session.' }, 503, headers);
  if (!session) return jsonResponse({ error: 'The upload session was not found.' }, 404, headers);
  if (session.status === 'submitted' || session.status === 'finalizing') {
    return jsonResponse({ error: 'A batch being submitted cannot be discarded.' }, 409, headers);
  }

  const { data: items, error: itemsError } = await supabase
    .from('study_hub_contribution_upload_items')
    .select('storage_path')
    .eq('session_id', session.id)
    .eq('user_id', user.id);
  if (itemsError) return jsonResponse({ error: 'Could not load the staged files.' }, 503, headers);

  const paths = (items || []).map((item) => item.storage_path);
  if (paths.length) {
    const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
    if (removeError) {
      console.error('Could not remove discarded contribution files.', removeError);
      return jsonResponse({ error: 'Could not remove the staged files. Try again later.' }, 503, headers);
    }
  }
  const { error: updateError } = await supabase
    .from('study_hub_contribution_upload_sessions')
    .update({ status: 'cancelled' })
    .eq('id', session.id)
    .eq('user_id', user.id);
  if (updateError) {
    console.error('Could not cancel the contribution upload session.', updateError);
    return jsonResponse({ error: 'The staged files were removed, but the session could not be closed.' }, 503, headers);
  }
  return jsonResponse({ status: 'cancelled' }, 200, headers);
});
