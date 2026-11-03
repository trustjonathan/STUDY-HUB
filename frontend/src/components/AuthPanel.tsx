import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import LearningPreferencesForm, { type LearningPreferences } from './LearningPreferencesForm';
import GoogleIdentitySignIn from './GoogleIdentitySignIn';
import { clearAuthSession, readAuthSession, saveAuthSession } from '../utils/authSession';
import { getPostLoginHref } from '../utils/authRedirect';
import type { GoogleAuthResult, GoogleAuthUser } from '../lib/googleSignIn';

interface Props {
  apiUrl: string;
  googleClientId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  showOneTap?: boolean;
  homeHref: string;
}

type Account = GoogleAuthUser;

interface AuthResponse {
  token?: string;
  user?: Account;
  message?: string;
  error?: string;
  errors?: Array<{ msg?: string }>;
}

type AuthMode = 'login' | 'register';
const REMEMBERED_ACCOUNT_KEY = 'study-hub-remembered-account-email';

function getApiBase(configured: string): string {
  if (!configured) return '';
  try {
    const url = new URL(configured);
    const localHost = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    if (url.protocol !== 'https:' && !localHost) return '';
    if (url.username || url.password || url.search || url.hash) return '';
    return url.href.replace(/\/+$/, '');
  } catch {
    return '';
  }
}

function getErrorMessage(result: AuthResponse, fallback: string): string {
  const validationMessage = result.errors?.map((item) => item.msg).filter(Boolean).join(' ');
  return validationMessage || result.message || result.error || fallback;
}

export default function AuthPanel({
  apiUrl,
  googleClientId,
  supabaseUrl,
  supabaseAnonKey,
  showOneTap = false,
  homeHref,
}: Props) {
  const apiBase = getApiBase(apiUrl);
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [rememberedEmail, setRememberedEmail] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [credentialNotice, setCredentialNotice] = useState('');
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const session = readAuthSession<Account>();
      if (session && typeof session.user.email === 'string') setAccount(session.user);
    } catch {
      setError('Saved sign-in information could not be read in this browser. You can still sign in again.');
    }
    try {
      const storedEmail = localStorage.getItem(REMEMBERED_ACCOUNT_KEY)?.trim() || '';
      if (storedEmail && storedEmail.length <= 254 && !/[\s<>]/.test(storedEmail)) {
        setRememberedEmail(storedEmail);
      }
    } catch {
      setNotice('This browser does not allow Study Hub to remember an email address on this device.');
    }
    setAuthChecked(true);
  }, []);

  function rememberAccountEmail(accountEmail: string) {
    const normalizedEmail = accountEmail.trim().toLowerCase();
    try {
      localStorage.setItem(REMEMBERED_ACCOUNT_KEY, normalizedEmail);
      setRememberedEmail(normalizedEmail);
    } catch {
      setNotice('You are signed in, but this browser could not remember your email for next time.');
    }
  }

  function continueAsRememberedAccount() {
    setMode('login');
    setEmail(rememberedEmail);
    window.setTimeout(() => passwordInputRef.current?.focus(), 0);
  }

  function forgetRememberedAccount() {
    try {
      localStorage.removeItem(REMEMBERED_ACCOUNT_KEY);
      setRememberedEmail('');
    } catch {
      setError('This browser could not remove the remembered email address.');
    }
  }

  function completeSignIn(token: string, user: Account) {
    saveAuthSession(token, user);
    rememberAccountEmail(user.email);
    window.location.assign(getPostLoginHref(homeHref, user));
  }

  function handleGoogleSuccess(result: GoogleAuthResult) {
    setError('');
    setNotice('');
    try {
      completeSignIn(result.token, result.user);
    } catch (signInError) {
      setError(signInError instanceof Error
        ? signInError.message
        : 'Google sign-in could not be completed. Please try again.');
    }
  }

  async function submit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !apiBase) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${apiBase}/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'login'
          ? { email: email.trim(), password }
          : { username: username.trim(), email: email.trim(), password })
      });
      const result: AuthResponse = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.token !== 'string' || !result.user || typeof result.user.email !== 'string') {
        throw new Error(getErrorMessage(result, 'Sign in could not be completed. Please try again.'));
      }

      completeSignIn(result.token, result.user);
      return;
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : '';
      setError(message === 'Failed to fetch'
        ? 'Could not reach the account service. Check your connection and try again.'
        : message || 'Sign in could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    try {
      clearAuthSession();
      setAccount(null);
      setNotice('You have signed out.');
      setError('');
    } catch {
      setError('This browser could not clear the saved sign-in session. Close this tab to end the temporary session.');
    }
  }

  async function updatePreferences(preferences: LearningPreferences | SubmitEvent<HTMLFormElement>) {
    if ('preventDefault' in preferences) {
      await updatePassword(preferences);
      return;
    }

    const session = readAuthSession<Account>();
    if (!session || !apiBase) {
      setAccount(null);
      throw new Error('Your sign-in session has expired. Please sign in again.');
    }

    async function updatePassword(event: SubmitEvent<HTMLFormElement>) {
      event.preventDefault();
      const session = readAuthSession<Account>();
      if (!session || !apiBase) {
        setAccount(null);
        setError('Your sign-in session has expired. Please sign in again.');
        return;
      }
      setCredentialNotice('');
      setError('');
      setBusy(true);
      try {
        const response = await fetch(`${apiBase}/api/auth/password`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.token}`,
          },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
        const result: AuthResponse = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            clearAuthSession();
            setAccount(null);
          }
          throw new Error(getErrorMessage(result, 'Your password could not be updated.'));
        }
        setCurrentPassword('');
        setNewPassword('');
        setCredentialNotice(result.message || 'Your password has been updated.');
      } catch (passwordError) {
        setError(passwordError instanceof Error ? passwordError.message : 'Your password could not be updated.');
      } finally {
        setBusy(false);
      }
    }

    const response = await fetch(`${apiBase}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
        learnerType: preferences.learnerType,
        educationLevel: preferences.educationLevel,
        universityCourse: preferences.universityCourse || null,
        universityYear: preferences.universityYear,
        secondaryTrack: preferences.secondaryTrack,
        classLevel: preferences.classLevel,
        subjects: preferences.subjects,
        onboardingComplete: true,
      }),
    });
    const result: AuthResponse = await response.json().catch(() => ({}));
    if (!response.ok || !result.user || typeof result.user.email !== 'string') {
      if (response.status === 401 || response.status === 403) {
        clearAuthSession();
        setAccount(null);
      }
      throw new Error(getErrorMessage(result, 'Could not update your learning profile. Please try again.'));
    }
    saveAuthSession(session.token, result.user);
    setAccount(result.user);
    setNotice('Your learning profile has been updated. Your Library and AI Study preferences are saved.');
    setError('');
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-heading">
        <div className="auth-card-main">
          <a className="auth-back-link" href={homeHref}>← Back to Study Hub</a>
          <p className="auth-eyebrow">Your personalised study space</p>
          <h1 id="auth-heading">{account ? 'You’re signed in.' : mode === 'login' ? 'Welcome back.' : 'Create an account.'}</h1>
          <p className="auth-intro">
            {account
              ? 'Your class and subject preferences help shape the Library and make AI Study more relevant to what you are learning.'
              : 'Sign in to personalise Study Hub. Set your class and subjects so Library resources are tailored to your interests and AI Study can give you a more relevant learning experience.'}
          </p>

          {account ? (
            <>
              <div className="auth-account-panel">
                <span className="auth-account-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
                </span>
                <div>
                  <strong>{account.username || account.email}</strong>
                  <span>{account.email}</span>
                </div>
                <a className="auth-secondary-button" href={`${homeHref.replace(/\/$/, '')}/study.html`}>Continue to AI Study</a>
                <button type="button" className="auth-secondary-button" onClick={signOut}>Sign out</button>
              </div>
              <section className="auth-profile-editor" aria-labelledby="auth-profile-heading">
                <div>
                  <p className="auth-eyebrow">Learning profile</p>
                  <h2 id="auth-profile-heading">Update your learning profile</h2>
                </div>
                {!apiBase && <p className="auth-api-warning" role="status">The account service is not connected, so profile changes cannot be saved right now.</p>}
                {error && <p className="auth-message auth-error" role="alert">{error}</p>}
                {notice && <p className="auth-message auth-notice" role="status">{notice}</p>}
                <LearningPreferencesForm
                  key={`${account.learnerType || ''}-${account.educationLevel || ''}-${account.universityCourse || ''}-${account.universityYear || ''}-${account.secondaryTrack || ''}-${account.classLevel || ''}-${(account.subjects || []).join(',')}`}
                  initialLearnerType={account.learnerType}
                  initialEducationLevel={account.educationLevel}
                  initialUniversityCourse={account.universityCourse}
                  initialUniversityYear={account.universityYear}
                  initialSecondaryTrack={account.secondaryTrack}
                  initialClassLevel={account.classLevel || ''}
                  initialSubjects={account.subjects || []}
                  submitLabel="Save learning profile"
                  onSave={updatePreferences}
                />
              </section>
              <section className="auth-profile-editor auth-credentials-editor" aria-labelledby="auth-credentials-heading">
                <div>
                  <p className="auth-eyebrow">Account security</p>
                  <h2 id="auth-credentials-heading">Sign-in credentials</h2>
                </div>
                {account.hasPassword ? (
                  <form className="auth-form" onSubmit={(event) => updatePreferences(event)}>
                    <label>
                      Current password
                      <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required minLength={6} maxLength={72} disabled={busy || !apiBase} />
                    </label>
                    <label>
                      New password
                      <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" required minLength={6} maxLength={72} disabled={busy || !apiBase} />
                      <span className="auth-field-hint">Use at least 6 characters.</span>
                    </label>
                    {credentialNotice && <p className="auth-message auth-notice" role="status">{credentialNotice}</p>}
                    <button className="auth-primary-button" type="submit" disabled={busy || !apiBase}>{busy ? 'Updating…' : 'Change password'}</button>
                  </form>
                ) : (
                  <p className="auth-intro">This account uses Google sign-in. Manage its password through your Google account.</p>
                )}
              </section>
            </>
          ) : (
            <>
              {mode === 'login' && rememberedEmail && (
                <aside className="auth-remembered-account" aria-label="Remembered account">
                  <span className="auth-remembered-avatar" aria-hidden="true">{rememberedEmail[0].toUpperCase()}</span>
                  <span className="auth-remembered-copy">
                    <strong>Continue as</strong>
                    <span>{rememberedEmail}</span>
                    <small>Sign in with your password to continue.</small>
                  </span>
                  <button type="button" className="auth-remembered-continue" onClick={continueAsRememberedAccount}>Use this email</button>
                  <button type="button" className="auth-remembered-forget" onClick={forgetRememberedAccount} aria-label="Forget remembered email">×</button>
                </aside>
              )}
              <div className="auth-mode-tabs" role="tablist" aria-label="Account options">
                <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'is-active' : ''} onClick={() => { setMode('login'); setError(''); setNotice(''); }}>Sign in</button>
                <button type="button" role="tab" aria-selected={mode === 'register'} className={mode === 'register' ? 'is-active' : ''} onClick={() => { setMode('register'); setError(''); setNotice(''); }}>Create account</button>
              </div>

              {!apiBase && (
                <p className="auth-api-warning" role="status">
                  The account service is not connected yet. Please try again later.
                </p>
              )}

              <form className="auth-form" onSubmit={submit}>
                {mode === 'register' && (
                  <label>
                    Name
                    <input
                      type="text"
                      value={username}
                      onChange={(event) => setUsername(event.target.value)}
                      autoComplete="name"
                      maxLength={80}
                      required
                      disabled={busy || !apiBase}
                    />
                  </label>
                )}
                <label>
                  Email
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    maxLength={254}
                    required
                    disabled={busy || !apiBase}
                  />
                </label>
                <label>
                  Password
                  <input
                    ref={passwordInputRef}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                    minLength={mode === 'register' ? 6 : undefined}
                    required
                    disabled={busy || !apiBase}
                  />
                  {mode === 'register' && <span className="auth-field-hint">Use at least 6 characters.</span>}
                </label>
                {error && <p className="auth-message auth-error" role="alert">{error}</p>}
                {notice && <p className="auth-message auth-notice" role="status">{notice}</p>}
                <button className="auth-primary-button" type="submit" disabled={busy || !apiBase}>
                  {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
                  {!busy && <span aria-hidden="true">→</span>}
                </button>
              </form>
              <div className="auth-divider" aria-hidden="true"><span>or continue with</span></div>
              {googleClientId ? (
                authChecked && <GoogleIdentitySignIn
                  apiBase={apiBase}
                  clientId={googleClientId}
                  supabaseUrl={supabaseUrl}
                  supabaseAnonKey={supabaseAnonKey}
                  showButton
                  showOneTap={showOneTap}
                  disabled={busy}
                  onSuccess={handleGoogleSuccess}
                />
              ) : (
                <p className="auth-google-notice" role="status">Google sign-in is not configured yet. Use email sign-in for now.</p>
              )}
            </>
          )}
        </div>
        <aside className="auth-card-aside">
          <div className="auth-aside-kicker">
            <span className="auth-aside-mark" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v16H6.5A2.5 2.5 0 0 0 4 21.5z" /><path d="M4 5.5v16M8 7h8m-8 4h7" /></svg>
            </span>
            <p className="auth-eyebrow">A better place to begin</p>
          </div>
          <div className="auth-art-stage">
            <span className="auth-art-orbit auth-art-orbit-one" aria-hidden="true"></span>
            <span className="auth-art-orbit auth-art-orbit-two" aria-hidden="true"></span>
            <span className="auth-art-label">Study Hub · Wherever you learn</span>
            <img className="auth-dashboard-art" src={`${homeHref.replace(/\/$/, '')}/assets/study-dashboard-devices.png`} alt="Study Hub learning dashboard displayed across a laptop, tablet, and phone" />
          </div>
          <p className="auth-eyebrow">Your next chapter</p>
          <h2>Make room for what you’re learning.</h2>
          <p>Bring your class, subject resources, and AI Study into one space that feels ready for the way you learn.</p>
          <ul className="auth-aside-points" aria-label="Study Hub account benefits">
            <li><span aria-hidden="true">01</span><span>Shape your Library around your class and subjects</span></li>
            <li><span aria-hidden="true">02</span><span>Return to your learning profile and saved resources</span></li>
          </ul>
          <a className="auth-aside-link" href={`${homeHref.replace(/\/$/, '')}/study.html`}>Explore AI Study <span aria-hidden="true">→</span></a>
        </aside>
      </section>
      <p className="auth-page-note">Your class and subject preferences can be changed from your learning profile at any time.</p>
    </main>
  );
}
