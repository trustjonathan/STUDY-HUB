const AUTH_SESSION_KEY = 'study-hub-auth';

export interface AuthSession<TUser> {
  token: string;
  user: TUser;
}

function tokenExpiresAt(token: string): number | null {
  const payload = token.split('.')[1];
  if (!payload) return null;

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const decoded: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')));
    if (typeof decoded !== 'object' || decoded === null || !('exp' in decoded)) return null;
    const expiresAt = decoded.exp;
    return typeof expiresAt === 'number' && Number.isFinite(expiresAt) ? expiresAt * 1000 : null;
  } catch {
    return null;
  }
}

export function readAuthSession<TUser>(): AuthSession<TUser> | null {
  const stored = sessionStorage.getItem(AUTH_SESSION_KEY);
  if (!stored) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(stored);
  } catch {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }

  if (typeof parsed !== 'object' || parsed === null || !('token' in parsed) || !('user' in parsed)) {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }

  const { token, user } = parsed;
  const expiresAt = typeof token === 'string' ? tokenExpiresAt(token) : null;
  if (
    typeof token !== 'string'
    || !token
    || expiresAt === null
    || expiresAt <= Date.now()
    || typeof user !== 'object'
    || user === null
  ) {
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    return null;
  }

  return { token, user: user as TUser };
}

export function saveAuthSession<TUser>(token: string, user: TUser): void {
  const expiresAt = tokenExpiresAt(token);
  if (expiresAt === null || expiresAt <= Date.now()) {
    throw new Error('The sign-in session is invalid or has expired. Please sign in again.');
  }
  sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ token, user }));
}

export function updateAuthSessionUser<TUser>(user: TUser): void {
  const session = readAuthSession<unknown>();
  if (!session) throw new Error('Your sign-in session has expired. Please sign in again.');
  saveAuthSession(session.token, user);
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(AUTH_SESSION_KEY);
}
