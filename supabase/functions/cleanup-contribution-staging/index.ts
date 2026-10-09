import { createClient } from 'npm:@supabase/supabase-js@2';
import { BUCKET, jsonResponse } from '../_shared/contribution.ts';

Deno.serve(async (request) => {
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, {});
  const expectedSecret = Deno.env.get('CONTRIBUTION_CLEANUP_SECRET');
  if (!expectedSecret || request.headers.get('Authorization') !== `Bearer ${expectedSecret}`) {
    return jsonResponse({ error: 'Unauthorized.' }, 401, {});
  }

  const apiUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiUrl || !serviceRoleKey) return jsonResponse({ error: 'Cleanup service is not configured.' }, 503, {});
  const supabase = createClient(apiUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const now = new Date().toISOString();
  const { data: sessions, error: sessionsError } = await supabase
    .from('study_hub_contribution_upload_sessions')
    .select('id, user_id')
    .eq('status', 'uploading')
    .lt('expires_at', now)
    .limit(100);
  if (sessionsError) {
    console.error('Could not list expired contribution sessions.', sessionsError);
    return jsonResponse({ error: 'Could not list expired upload sessions.' }, 503, {});
  }

  let cleaned = 0;
  for (const session of sessions || []) {
    const prefix = `staging/${session.user_id}/${session.id}`;
    const { data: stagedFiles, error: listError } = await supabase.storage.from(BUCKET).list(prefix, { limit: 100 });
    if (listError) {
      console.error('Could not list an expired contribution session folder.', listError);
      return jsonResponse({ error: 'Could not clean expired upload files.' }, 503, {});
    }
    if (stagedFiles?.length) {
      const paths = stagedFiles.map((file) => `${prefix}/${file.name}`);
      const { error: removeError } = await supabase.storage.from(BUCKET).remove(paths);
      if (removeError) {
        console.error('Could not remove expired staged contribution files.', removeError);
        return jsonResponse({ error: 'Could not clean expired upload files.' }, 503, {});
      }
    }
    const { error: updateError } = await supabase
      .from('study_hub_contribution_upload_sessions')
      .update({ status: 'expired' })
      .eq('id', session.id)
      .eq('status', 'uploading');
    if (updateError) {
      console.error('Could not mark a contribution session expired.', updateError);
      return jsonResponse({ error: 'Could not expire cleaned upload sessions.' }, 503, {});
    }
    cleaned += 1;
  }

  return jsonResponse({ expiredSessions: cleaned }, 200, {});
});
