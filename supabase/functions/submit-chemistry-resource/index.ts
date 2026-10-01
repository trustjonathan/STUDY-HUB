import { createClient } from 'npm:@supabase/supabase-js@2';

const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Map([
  ['application/pdf', '.pdf'],
  ['application/msword', '.doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/rtf', '.rtf'],
  ['text/plain', '.txt'],
]);

const allowedOrigins = (Deno.env.get('CHEMISTRY_ARCHIVE_ALLOWED_ORIGINS') || 'https://trustjonathan.github.io,http://localhost:4321,http://127.0.0.1:4321')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'apikey, content-type',
    'Vary': 'Origin',
  };
  if (origin && allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

function jsonResponse(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...Object.fromEntries(new Headers(headers)), 'Content-Type': 'application/json' },
  });
}

function safeExtension(file: File): string | null {
  const extension = file.name.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
  return ALLOWED_TYPES.get(file.type) === extension ? extension : null;
}

async function verifyTurnstile(token: string, remoteIp: string | null, expectedHostname: string): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
  if (!secret) return false;

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set('remoteip', remoteIp);
  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!result.ok) return false;
  const payload = await result.json();
  return payload.success === true && payload.hostname === expectedHostname;
}

async function hashIp(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function matchesFileSignature(file: File, extension: string): Promise<boolean> {
  const bytes = new Uint8Array(await file.slice(0, 16).arrayBuffer());
  const startsWith = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);

  if (extension === '.pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  if (extension === '.doc') return startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (extension === '.docx') return startsWith([0x50, 0x4b, 0x03, 0x04]);
  if (extension === '.rtf') return new TextDecoder().decode(bytes.slice(0, 5)).toLowerCase() === '{\\rtf';
  if (extension === '.txt') return !bytes.includes(0);
  return false;
}

Deno.serve(async (request) => {
  const origin = request.headers.get('Origin');
  const headers = corsHeaders(origin);

  if (!origin || !allowedOrigins.includes(origin)) return jsonResponse({ error: 'Origin not allowed.' }, 403, headers);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed.' }, 405, headers);
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('multipart/form-data')) {
    return jsonResponse({ error: 'Use a multipart form upload.' }, 415, headers);
  }
  const contentLength = Number(request.headers.get('Content-Length')) || 0;
  if (contentLength > MAX_FILE_BYTES + 1024 * 1024) return jsonResponse({ error: 'Upload request is too large.' }, 413, headers);

  const apiUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!apiUrl || !serviceRoleKey) return jsonResponse({ error: 'Upload service is not configured.' }, 503, headers);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: 'Invalid upload form.' }, 400, headers);
  }

  const title = String(form.get('title') || '').trim();
  const category = String(form.get('category') || '');
  const level = String(form.get('level') || '').trim() || null;
  const yearInput = String(form.get('year') || '').trim();
  const year = yearInput ? Number(yearInput) : null;
  const rightsConfirmed = form.get('rights_confirmed') === 'on';
  const turnstileToken = String(form.get('cf-turnstile-response') || '');
  const file = form.get('file');

  if (title.length < 3 || title.length > 120) return jsonResponse({ error: 'Title must be 3 to 120 characters.' }, 400, headers);
  if (category !== 'notes' && category !== 'papers') return jsonResponse({ error: 'Choose notes or past papers.' }, 400, headers);
  if (level && !['O-Level', 'A-Level', 'S.3', 'S.4', 'S.5', 'S.6'].includes(level)) return jsonResponse({ error: 'Invalid study level.' }, 400, headers);
  if (year !== null && (!Number.isInteger(year) || year < 1990 || year > 2035)) return jsonResponse({ error: 'Year must be between 1990 and 2035.' }, 400, headers);
  if (!rightsConfirmed) return jsonResponse({ error: 'Confirm that you have permission to share this material.' }, 400, headers);
  if (!(file instanceof File)) return jsonResponse({ error: 'Choose a resource file.' }, 400, headers);
  if (file.size < 1 || file.size > MAX_FILE_BYTES) return jsonResponse({ error: 'File must be smaller than 50 MB.' }, 413, headers);
  const extension = safeExtension(file);
  if (!extension) return jsonResponse({ error: 'File type is not supported or does not match its extension.' }, 415, headers);
  if (!(await matchesFileSignature(file, extension))) return jsonResponse({ error: 'File contents do not match the selected file type.' }, 415, headers);

  const remoteIp = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for')?.split(',')[0].trim() || null;
  const expectedHostname = origin ? new URL(origin).hostname : '';
  if (!turnstileToken || !expectedHostname || !(await verifyTurnstile(turnstileToken, remoteIp, expectedHostname))) {
    return jsonResponse({ error: 'Verification failed. Please try again.' }, 403, headers);
  }

  const supabase = createClient(apiUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const rateLimitSalt = Deno.env.get('SUBMISSION_RATE_LIMIT_SALT');
  if (!remoteIp || !rateLimitSalt) return jsonResponse({ error: 'Upload protection is not configured.' }, 503, headers);
  const { data: allowed, error: rateLimitError } = await supabase.rpc('study_hub_consume_chemistry_submission_limit', {
    p_ip_hash: await hashIp(remoteIp, rateLimitSalt),
  });
  if (rateLimitError) return jsonResponse({ error: 'Could not verify upload limits.' }, 503, headers);
  if (allowed !== true) return jsonResponse({ error: 'Upload limit reached. Please try again later.' }, 429, headers);

  const id = crypto.randomUUID();
  const storagePath = `pending/${id}${extension}`;
  const bucket = 'chemistry-resource-submissions';
  const { error: uploadError } = await supabase.storage.from(bucket).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) return jsonResponse({ error: 'Could not store this upload.' }, 500, headers);

  const { error: rowError } = await supabase.from('study_hub_chemistry_submissions').insert({
    id,
    title,
    category,
    level,
    year,
    original_filename: file.name.slice(0, 255),
    storage_bucket: bucket,
    storage_path: storagePath,
    mime_type: file.type,
    size_bytes: file.size,
    status: 'pending',
  });
  if (rowError) {
    await supabase.storage.from(bucket).remove([storagePath]);
    return jsonResponse({ error: 'Could not queue this upload for review.' }, 500, headers);
  }

  return jsonResponse({ status: 'pending' }, 202, headers);
});
