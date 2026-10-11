import { createClient } from 'npm:@supabase/supabase-js@2';

const CONTRIBUTION_BUCKET = 'study-hub-contributions';
const RESOURCE_BUCKET = 'study-hub-resources';
const ACTIVE_SUBJECTS = new Set(['biology', 'chemistry', 'mathematics', 'physics']);
const CATEGORIES = new Set(['notes', 'papers']);
const ALLOWED_EXTENSIONS = new Set(['.pdf', '.doc', '.docx', '.rtf', '.txt']);

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The moderation request failed.';
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const apiUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiUrl || !anonKey || !serviceRoleKey) return json({ error: 'Moderation service is not configured.' }, 503);

  const accessToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return json({ error: 'Sign in to the moderator account.' }, 401);
  const authClient = createClient(apiUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(accessToken);
  if (authError || !authData.user || authData.user.is_anonymous) return json({ error: 'The moderator session is invalid.' }, 401);

  const admin = createClient(apiUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: access, error: accessError } = await admin
    .from('study_hub_admins')
    .select('user_id')
    .eq('user_id', authData.user.id)
    .maybeSingle();
  if (accessError) {
    console.error('Could not verify the moderator allowlist.', accessError);
    return json({ error: 'Moderator access could not be verified.' }, 503);
  }
  if (!access) return json({ error: 'This account is not authorized to moderate Study Hub.' }, 403);

  let body: Record<string, unknown>;
  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return json({ error: 'Invalid moderation request.' }, 400);
    body = payload as Record<string, unknown>;
  } catch {
    return json({ error: 'Invalid moderation request.' }, 400);
  }

  if (body.action === 'dashboard') {
    const [contributionsResult, suggestionsResult, activityResult] = await Promise.all([
      admin.from('study_hub_contributions')
        .select('id,title,original_filename,storage_path,mime_type,size_bytes,status,submitted_at')
        .eq('status', 'pending').order('submitted_at', { ascending: true }).limit(100),
      admin.from('study_hub_suggestions')
        .select('id,content,status,created_at')
        .eq('status', 'pending').order('created_at', { ascending: true }).limit(100),
      admin.from('study_hub_moderation_activity')
        .select('id,entity_type,entity_id,event_type,previous_status,new_status,created_at')
        .order('created_at', { ascending: false }).limit(100),
    ]);
    if (contributionsResult.error || suggestionsResult.error || activityResult.error) {
      console.error('Could not load the moderator dashboard.', contributionsResult.error, suggestionsResult.error, activityResult.error);
      return json({ error: 'Could not load the moderation queue.' }, 503);
    }

    const contributions = [];
    for (const contribution of contributionsResult.data || []) {
      const { data: signedFile, error: signedFileError } = await admin.storage
        .from(CONTRIBUTION_BUCKET)
        .createSignedUrl(contribution.storage_path, 300);
      if (signedFileError) {
        console.error('Could not create a private review link.', signedFileError);
        return json({ error: `Could not prepare "${contribution.original_filename}" for review.` }, 503);
      }
      contributions.push({ ...contribution, review_url: signedFile.signedUrl });
    }
    return json({
      contributions,
      suggestions: suggestionsResult.data || [],
      activity: activityResult.data || [],
    });
  }

  if (body.action === 'moderate_suggestion') {
    if (typeof body.id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.id) || !['approved', 'rejected'].includes(String(body.status))) {
      return json({ error: 'Choose a valid suggestion and decision.' }, 400);
    }
    const { data: suggestion, error: readError } = await admin.from('study_hub_suggestions')
      .select('id,status').eq('id', body.id).maybeSingle();
    if (readError) return json({ error: 'Could not load this suggestion.' }, 503);
    if (!suggestion || suggestion.status !== 'pending') return json({ error: 'This suggestion is no longer pending.' }, 409);
    const { data: updatedSuggestion, error: updateError } = await admin.from('study_hub_suggestions')
      .update({ status: body.status, reviewer_user_id: authData.user.id })
      .eq('id', body.id).eq('status', 'pending').select('id').maybeSingle();
    if (updateError || !updatedSuggestion) {
      console.error('Could not moderate a suggestion.', updateError);
      return json({ error: 'Could not update this suggestion.' }, 503);
    }
    return json({ status: body.status });
  }

  if (body.action === 'moderate_contribution') {
    const id = body.id;
    const decision = body.status;
    const subject = body.subject;
    const category = body.category;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const level = typeof body.level === 'string' ? body.level.trim().slice(0, 80) : '';
    const year = body.year === '' || body.year === null || body.year === undefined ? null : Number(body.year);
    const reviewerNote = typeof body.reviewer_note === 'string' ? body.reviewer_note.trim().slice(0, 500) : '';
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || !['approved', 'rejected'].includes(String(decision))) {
      return json({ error: 'Choose a valid upload and decision.' }, 400);
    }
    if (decision === 'approved' && (
      typeof subject !== 'string' || !ACTIVE_SUBJECTS.has(subject) ||
      typeof category !== 'string' || !CATEGORIES.has(category) ||
      title.length < 3 || title.length > 120 ||
      (year !== null && (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() + 1))
    )) return json({ error: 'Check the subject, category, title, and year before approving.' }, 400);

    const { data: contribution, error: readError } = await admin.from('study_hub_contributions')
      .select('id,title,original_filename,storage_bucket,storage_path,mime_type,size_bytes,status')
      .eq('id', id).maybeSingle();
    if (readError) return json({ error: 'Could not load this upload.' }, 503);
    if (!contribution || contribution.status !== 'pending') return json({ error: 'This upload is no longer pending.' }, 409);

    if (decision === 'approved') {
      const extension = contribution.original_filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
      if (!ALLOWED_EXTENSIONS.has(extension) || contribution.storage_bucket !== CONTRIBUTION_BUCKET ||
          !contribution.storage_path.startsWith('contribution/')) {
        return json({ error: 'This upload has invalid file metadata and cannot be published.' }, 415);
      }
      const publishedPath = `contributions/${id}/${contribution.original_filename.replace(/[^a-z0-9._-]/gi, '_')}`;
      const { error: copyError } = await admin.storage.from(CONTRIBUTION_BUCKET).copy(
        contribution.storage_path,
        publishedPath,
        { destinationBucket: RESOURCE_BUCKET },
      );
      if (copyError) {
        console.error('Could not copy an approved file to the public resource library.', copyError);
        return json({ error: 'Could not publish the file. It remains private and pending.' }, 503);
      }
      const { error: resourceError } = await admin.from('study_hub_resources').insert({
        subject,
        category,
        storage_bucket: RESOURCE_BUCKET,
        storage_path: publishedPath,
        original_filename: contribution.original_filename,
        title,
        extension,
        mime_type: contribution.mime_type,
        size_bytes: contribution.size_bytes,
        level: level || null,
        year,
        resource_type: category === 'notes' ? 'notes' : 'paper',
      });
      if (resourceError) {
        const { error: cleanupError } = await admin.storage.from(RESOURCE_BUCKET).remove([publishedPath]);
        if (cleanupError) console.error('Could not remove an unindexed public file after catalogue insertion failed.', cleanupError);
        console.error('Could not add the approved file to the public catalogue.', resourceError);
        return json({ error: 'Could not add the file to the public library; no approval was recorded.' }, 503);
      }
    }

    const { data: updatedContribution, error: updateError } = await admin.from('study_hub_contributions').update({
      status: decision,
      reviewed_at: new Date().toISOString(),
      reviewer_note: reviewerNote || null,
      reviewer_user_id: authData.user.id,
      ...(decision === 'approved' ? { title } : {}),
    }).eq('id', id).eq('status', 'pending').select('id').maybeSingle();
    if (updateError || !updatedContribution) {
      console.error('Could not update the contribution review status.', updateError);
      if (decision === 'approved') {
        const publishedPath = `contributions/${id}/${contribution.original_filename.replace(/[^a-z0-9._-]/gi, '_')}`;
        const { error: catalogCleanupError } = await admin.from('study_hub_resources')
          .delete().eq('storage_bucket', RESOURCE_BUCKET).eq('storage_path', publishedPath);
        if (catalogCleanupError) console.error('Could not roll back an unreviewed public catalogue entry.', catalogCleanupError);
        const { error: objectCleanupError } = await admin.storage.from(RESOURCE_BUCKET).remove([publishedPath]);
        if (objectCleanupError) console.error('Could not roll back an unreviewed public file.', objectCleanupError);
      }
      return json({ error: 'The file may be published, but its review status was not updated. Contact support before retrying.' }, 503);
    }

    let warning: string | undefined;
    if (decision === 'rejected') {
      const { error: removeError } = await admin.storage.from(CONTRIBUTION_BUCKET).remove([contribution.storage_path]);
      if (removeError) {
        console.error('Could not remove a rejected private contribution file.', removeError);
        warning = 'The rejection was recorded, but its private file could not be deleted.';
      }
    } else {
      const { error: removeError } = await admin.storage.from(CONTRIBUTION_BUCKET).remove([contribution.storage_path]);
      if (removeError) {
        console.error('Could not remove the private source after publishing an approved file.', removeError);
        warning = 'The resource was published, but its original private copy could not be deleted.';
      }
    }
    return json({ status: decision, ...(warning ? { warning } : {}) });
  }

  return json({ error: 'Unknown moderation action.' }, 400);
});
