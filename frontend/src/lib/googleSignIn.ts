import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const GOOGLE_IDENTITY_SCRIPT = 'https://accounts.google.com/gsi/client';
const GOOGLE_ONE_TAP_DISMISSED_KEY = 'study-hub-google-one-tap-dismissed';

export interface GoogleAuthUser {
  id?: number | string;
  username: string;
  email: string;
  role?: string;
  hasPassword?: boolean;
  learnerType?: 'student' | 'non-student' | null;
  educationLevel?: 'university' | 'secondary' | 'primary' | 'nursery' | null;
  universityCourse?: string | null;
  universityYear?: number | null;
  secondaryTrack?: 'O-Level' | 'A-Level' | null;
  classLevel?: string | null;
  subjects?: string[];
  onboardingComplete?: boolean;
}

export interface GoogleAuthResult {
  token: string;
  user: GoogleAuthUser;
}

interface GoogleCredentialResponse {
  credential?: string;
}

interface GooglePromptNotification {
  isDismissedMoment(): boolean;
  isSkippedMoment(): boolean;
  isNotDisplayed(): boolean;
}

interface GoogleIdentityApi {
  initialize(options: {
    client_id: string;
    nonce: string;
    callback: (response: GoogleCredentialResponse) => void;
  }): void;
  renderButton(element: HTMLElement, options: {
    type: 'standard';
    theme: 'outline';
    size: 'large';
    shape: 'rectangular';
    text: 'continue_with';
    logo_alignment: 'left';
    width: number;
  }): void;
  prompt(callback: (notification: GooglePromptNotification) => void): void;
  cancel(): void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleIdentityApi;
      };
    };
  }
}

interface GoogleAuthEnvelope {
  token?: unknown;
  user?: unknown;
  message?: unknown;
  error?: unknown;
  errors?: unknown;
}

let googleScriptPromise: Promise<GoogleIdentityApi> | undefined;
let supabaseAuthClient: SupabaseClient | undefined;

export function loadGoogleIdentity(): Promise<GoogleIdentityApi> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  if (googleScriptPromise) return googleScriptPromise;

  googleScriptPromise = new Promise((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_IDENTITY_SCRIPT}"]`);
    const handleLoad = () => {
      if (window.google?.accounts.id) resolve(window.google.accounts.id);
      else reject(new Error('Google sign-in loaded without its identity service.'));
    };
    const handleError = () => reject(new Error('Google sign-in could not be loaded. Check your connection or allow Google sign-in in this browser.'));

    if (!script) {
      script = document.createElement('script');
      script.src = GOOGLE_IDENTITY_SCRIPT;
      script.async = true;
      script.defer = true;
    }

    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    if (!script.isConnected) document.head.append(script);
  });

  return googleScriptPromise;
}

export async function createGoogleNonce(): Promise<{ raw: string; hashed: string }> {
  if (!globalThis.crypto?.getRandomValues || !globalThis.crypto.subtle) {
    throw new Error('Secure Google sign-in is unavailable in this browser. Use email sign-in or a supported secure browser.');
  }

  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const raw = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
  const hashed = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
  return { raw, hashed };
}

function getSupabaseAuthClient(url: string, anonKey: string): SupabaseClient {
  if (!supabaseAuthClient) {
    supabaseAuthClient = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return supabaseAuthClient;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isGoogleAuthUser(value: unknown): value is GoogleAuthUser {
  return isRecord(value)
    && typeof value.username === 'string'
    && typeof value.email === 'string';
}

function responseMessage(body: GoogleAuthEnvelope): string | null {
  if (typeof body.message === 'string' && body.message.trim()) return body.message;
  if (typeof body.error === 'string' && body.error.trim()) return body.error;
  if (Array.isArray(body.errors)) {
    const messages = body.errors
      .filter(isRecord)
      .map((item) => item.msg)
      .filter((message): message is string => typeof message === 'string' && Boolean(message.trim()));
    if (messages.length) return messages.join(' ');
  }
  return null;
}

export async function signInWithGoogleCredential(options: {
  apiBase: string;
  clientId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  token: string;
  nonce: string;
}): Promise<GoogleAuthResult> {
  const { apiBase, clientId, supabaseUrl, supabaseAnonKey, token, nonce } = options;
  if (!apiBase || !clientId || !supabaseUrl || !supabaseAnonKey) {
    throw new Error('Google sign-in is not fully configured. Please use email sign-in or try again later.');
  }

  const { error } = await getSupabaseAuthClient(supabaseUrl, supabaseAnonKey).auth.signInWithIdToken({
    provider: 'google',
    token,
    nonce,
  });
  if (error) throw new Error(`Google sign-in could not be verified by Supabase: ${error.message}`);

  let response: Response;
  try {
    response = await fetch(`${apiBase}/api/auth/google`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: token }),
    });
  } catch {
    throw new Error('Could not reach the account service. Check your connection and try again.');
  }

  let body: GoogleAuthEnvelope = {};
  try {
    const parsed: unknown = await response.json();
    if (isRecord(parsed)) body = parsed;
  } catch {
    if (response.ok) throw new Error('The account service returned an unreadable sign-in response. Please try again.');
  }

  if (
    !response.ok
    || typeof body.token !== 'string'
    || !body.token
    || !isGoogleAuthUser(body.user)
  ) {
    throw new Error(responseMessage(body) || 'Google sign-in could not be completed. Please try again.');
  }

  return { token: body.token, user: body.user };
}

export function wasGoogleOneTapDismissed(): boolean {
  return sessionStorage.getItem(GOOGLE_ONE_TAP_DISMISSED_KEY) === '1';
}

export function rememberGoogleOneTapDismissal(): void {
  sessionStorage.setItem(GOOGLE_ONE_TAP_DISMISSED_KEY, '1');
}
