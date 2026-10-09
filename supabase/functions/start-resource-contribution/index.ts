import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  ALLOWED_TYPES,
  BUCKET,
  MAX_BATCH_BYTES,
  MAX_BATCH_FILES,
  MAX_FILE_BYTES,
  authenticateUser,
  corsHeaders,
  hashIp,
  isAllowedOrigin,
  jsonResponse,
  safeExtension,
  safeStorageFilename,
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

  let body: {
    files?: Array<{ name?: unknown; size?: unknown; type?: unknown }>;
    rightsConfirmed?: unknown;
    turnstileToken?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid upload session request.' }, 400, headers);
  }

  const files = body.files;
  if (!Array.isArray(files) || files.length < 1 || files.length > MAX_BATCH_FILES) {
    return jsonResponse({ error: `Select between 1 and ${MAX_BATCH_FILES} files.` }, 400, headers);
  }
  if (body.rightsConfirmed !== true) return jsonResponse({ error: 'Confirm that you have permission to share these materials.' }, 400, headers);

  let totalSize = 0;
  const prepared: Array<{ id: string; title: string; original_filename: string; storage_path: string; contribution_path: string; mime_type: string; size_bytes: number }> = [];
  const sessionId = crypto.randomUUID();
  for (const entry of files) {
    if (typeof entry.name !== 'string' || typeof entry.type !== 'string' || typeof entry.size !== 'number' || !Number.isSafeInteger(entry.size)) {
      return jsonResponse({ error: 'One or more files have invalid metadata.' }, 400, headers);
    }
    const filename = entry.name.trim();
    const extension = safeExtension(filename, entry.type);
    if (!extension || !ALLOWED_TYPES.has(entry.type)) return jsonResponse({ error: `${filename || 'A file'} has an unsupported type or mismatched extension.` }, 415, headers);
    if (entry.size < 1 || entry.size > MAX_FILE_BYTES) return jsonResponse({ error: 'Each file must be no larger than 50 MB.' }, 413, headers);
    if (filename.length > 255) return jsonResponse({ error: 'File names must be 255 characters or fewer.' }, 400, headers);
    totalSize += entry.size;
    if (totalSize > MAX_BATCH_BYTES) return jsonResponse({ error: 'The batch must be no larger than 250 MB.' }, 413, headers);

    const id = crypto.randomUUID();
    const safeName = safeStorageFilename(filename, extension);
    const titleFromName = filename.slice(0, -extension.length).trim().slice(0, 120);
    prepared.push({
      id,
      title: titleFromName.length >= 3 ? titleFromName : 'Shared resource',
      original_filename: filename,
      storage_path: `staging/${user.id}/${sessionId}/${id}_${safeName}`,
      contribution_path: `contribution/${id}_${safeName}`,
      mime_type: entry.type,
      size_bytes: entry.size,
    });
  }

  const remoteIp = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
  const rateLimitSalt = Deno.env.get('SUBMISSION_RATE_LIMIT_SALT');
  if (!remoteIp || !rateLimitSalt) return jsonResponse({ error: 'Upload protection is not configured.' }, 503, headers);
  if (typeof body.turnstileToken !== 'string' || !(await verifyTurnstile(body.turnstileToken, remoteIp, new URL(origin).hostname))) {
    return jsonResponse({ error: 'Verification failed. Please try again.' }, 403, headers);
  }

  const supabase = createClient(apiUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: allowed, error: rateLimitError } = await supabase.rpc('study_hub_consume_contribution_limit', {
    p_ip_hash: await hashIp(remoteIp, rateLimitSalt),
  });
  if (rateLimitError) return jsonResponse({ error: 'Could not verify upload limits.' }, 503, headers);
  if (allowed !== true) return jsonResponse({ error: 'Upload limit reached. Please try again later.' }, 429, headers);

  const { error: sessionError } = await supabase.from('study_hub_contribution_upload_sessions').insert({
    id: sessionId,
    user_id: user.id,
    file_count: prepared.length,
    total_size_bytes: totalSize,
    rights_confirmed: true,
  });
  if (sessionError) {
    console.error('Could not create a contribution upload session.', sessionError);
    return jsonResponse({ error: 'Could not start the upload session.' }, 500, headers);
  }

  const { error: itemsError } = await supabase.from('study_hub_contribution_upload_items').insert(
    prepared.map((item) => ({ ...item, session_id: sessionId, user_id: user.id })),
  );
  if (itemsError) {
    const { error: cleanupError } = await supabase.from('study_hub_contribution_upload_sessions').delete().eq('id', sessionId);
    if (cleanupError) console.error('Could not remove an incomplete contribution upload session.', cleanupError);
    console.error('Could not create contribution upload items.', itemsError);
    return jsonResponse({ error: 'Could not prepare the files for upload.' }, 500, headers);
  }

  return jsonResponse({
    sessionId,
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    bucket: BUCKET,
    files: prepared.map(({ id, title, original_filename, storage_path, mime_type, size_bytes }) => ({
      id,
      title,
      name: original_filename,
      path: storage_path,
      type: mime_type,
      size: size_bytes,
    })),
    maxBatchBytes: MAX_BATCH_BYTES,
    maxBatchFiles: MAX_BATCH_FILES,
  }, 201, headers);
});
