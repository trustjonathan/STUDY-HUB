export const BUCKET = 'study-hub-contributions';
export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const MAX_BATCH_BYTES = 250 * 1024 * 1024;

export const ALLOWED_TYPES = new Map([
  ['application/pdf', '.pdf'],
  ['application/msword', '.doc'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', '.docx'],
  ['application/rtf', '.rtf'],
  ['text/plain', '.txt'],
]);

const allowedOrigins = (Deno.env.get('STUDY_HUB_ALLOWED_ORIGINS') || 'https://trustjonathan.github.io,http://localhost:4321,http://127.0.0.1:4321')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

export function corsHeaders(origin: string | null): HeadersInit {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'apikey, authorization, content-type',
    'Vary': 'Origin',
  };
  if (origin && allowedOrigins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}

export function isAllowedOrigin(origin: string | null): origin is string {
  return Boolean(origin && allowedOrigins.includes(origin));
}

export function jsonResponse(body: unknown, status: number, headers: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...Object.fromEntries(new Headers(headers)), 'Content-Type': 'application/json' },
  });
}

export function safeExtension(filename: string, mimeType: string): string | null {
  const extension = filename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
  return ALLOWED_TYPES.get(mimeType) === extension ? extension : null;
}

export function safeStorageFilename(filename: string, extension: string): string {
  const stem = filename
    .slice(0, -extension.length)
    .replace(/[^a-z0-9._-]/gi, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+|[._-]+$/g, '')
    .slice(0, 100);
  return `${stem || 'resource'}${extension}`;
}

export async function authenticateUser(request: Request, apiUrl: string, anonKey: string): Promise<{ id: string; accessToken: string } | null> {
  const accessToken = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
  if (!accessToken) return null;
  const response = await fetch(`${apiUrl}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) return null;
  const user = await response.json();
  return typeof user.id === 'string' && user.is_anonymous === true ? { id: user.id, accessToken } : null;
}

export async function hashIp(ip: string, salt: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function matchesFileSignature(blob: Blob, extension: string): Promise<boolean> {
  const bytes = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const startsWith = (signature: number[]) => signature.every((byte, index) => bytes[index] === byte);

  if (extension === '.pdf') return new TextDecoder().decode(bytes.slice(0, 5)) === '%PDF-';
  if (extension === '.doc') return startsWith([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
  if (extension === '.docx') return startsWith([0x50, 0x4b, 0x03, 0x04]);
  if (extension === '.rtf') return new TextDecoder().decode(bytes.slice(0, 5)).toLowerCase() === '{\\rtf';
  if (extension === '.txt') return !bytes.includes(0);
  return false;
}
