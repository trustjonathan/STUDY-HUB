import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import LearningPreferencesForm, { type LearningPreferences } from './LearningPreferencesForm';
import { clearAuthSession, readAuthSession, saveAuthSession } from '../utils/authSession';

interface Props {
  apiUrl: string;
  googleClientId: string;
  homeHref: string;
}

interface GoogleCredentialResponse {
  credential?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (element: HTMLElement, options: {
            type: 'standard';
            theme: 'outline';
            size: 'large';
            shape: 'rectangular';
            text: 'continue_with' | 'signup_with';
            logo_alignment: 'left';
            width: number;
          }) => void;
          prompt: () => void;
        };
      };
    };
  }
}

interface Account {
  id?: number | string;
  username: string;
  email: string;
  role?: string;
  classLevel?: string | null;
  subjects?: string[];
  onboardingComplete?: boolean;
}

interface AuthResponse {
  token?: string;
  user?: Account;
  message?: string;
  error?: string;
  errors?: Array<{ msg?: string }>;
}

type AuthMode = 'login' | 'register';

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

export default function AuthPanel({ apiUrl, googleClientId, homeHref }: Props) {
  const apiBase = getApiBase(apiUrl);
  const [mode, setMode] = useState<AuthMode>('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [account, setAccount] = useState<Account | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const oneTapPromptRequested = useRef(false);

  useEffect(() => {
    try {
      const session = readAuthSession<Account>();
      if (session && typeof session.user.email === 'string') setAccount(session.user);
    } catch {
      setError('Saved sign-in information could not be read in this browser. You can still sign in again.');
    }
  }, []);

  async function signInWithGoogle(credential: string) {
    if (busy || !apiBase) return;
    setBusy(true);
    setError('');
    setNotice('');

    try {
      const response = await fetch(`${apiBase}/api/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const result: AuthResponse = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.token !== 'string' || !result.user || typeof result.user.email !== 'string') {
        throw new Error(getErrorMessage(result, 'Google sign-in could not be completed. Please try again.'));
      }

      saveAuthSession(result.token, result.user);
      if (result.user.onboardingComplete !== true) {
        window.location.assign(`${homeHref.replace(/\/$/, '')}/assistant.html?welcome=1`);
        return;
      }
      setAccount(result.user);
      setNotice('You are signed in with Google. Your learning profile is ready.');
    } catch (googleError) {
      const message = googleError instanceof Error ? googleError.message : '';
      setError(message === 'Failed to fetch'
        ? 'Could not reach the account service. Check your connection and try again.'
        : message || 'Google sign-in could not be completed. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const button = googleButtonRef.current;
    if (!button || account || !apiBase || !googleClientId) return;

    const configureGoogleButton = () => {
      if (!window.google) {
        setError('Google sign-in could not be loaded. Please use email sign-in or try again later.');
        return;
      }
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          if (!response.credential) {
            setError('Google did not return a sign-in credential. Please try again.');
            return;
          }
          void signInWithGoogle(response.credential);
        },
      });
      button.replaceChildren();
      window.google.accounts.id.renderButton(button, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: mode === 'register' ? 'signup_with' : 'continue_with',
        logo_alignment: 'left',
        width: Math.min(360, Math.floor(button.clientWidth || 360)),
      });
      if (!oneTapPromptRequested.current) {
        oneTapPromptRequested.current = true;
        window.google.accounts.id.prompt();
      }
    };

    const scriptUrl = 'https://accounts.google.com/gsi/client';
    const script = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
    if (window.google) {
      configureGoogleButton();
      return;
    }
    if (!script) {
      setError('Google sign-in script is missing from the sign-in page.');
      return;
    }
    const handleScriptError = () => setError('Google sign-in could not be loaded. Please use email sign-in.');
    script.addEventListener('load', configureGoogleButton);
    script.addEventListener('error', handleScriptError);

    return () => {
      script?.removeEventListener('load', configureGoogleButton);
      script?.removeEventListener('error', handleScriptError);
    };
  }, [account, apiBase, googleClientId, mode]);

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

      saveAuthSession(result.token, result.user);
      if (result.user.onboardingComplete !== true) {
        window.location.assign(`${homeHref.replace(/\/$/, '')}/assistant.html?welcome=1`);
        return;
      }
      setAccount(result.user);
      setPassword('');
      setNotice('Your Study Hub learning profile is ready.');
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

  async function updatePreferences(preferences: LearningPreferences) {
    const session = readAuthSession<Account>();
    if (!session || !apiBase) {
      setAccount(null);
      throw new Error('Your sign-in session has expired. Please sign in again.');
    }

    const response = await fetch(`${apiBase}/api/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.token}`,
      },
      body: JSON.stringify({
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
                <button type="button" className="auth-secondary-button" onClick={signOut}>Sign out</button>
              </div>
              <section className="auth-profile-editor" aria-labelledby="auth-profile-heading">
                <div>
                  <p className="auth-eyebrow">Learning profile</p>
                  <h2 id="auth-profile-heading">Update your class and subjects</h2>
                </div>
                {!apiBase && <p className="auth-api-warning" role="status">The account service is not connected, so profile changes cannot be saved right now.</p>}
                {error && <p className="auth-message auth-error" role="alert">{error}</p>}
                {notice && <p className="auth-message auth-notice" role="status">{notice}</p>}
                <LearningPreferencesForm
                  key={`${account.classLevel || ''}-${(account.subjects || []).join(',')}`}
                  initialClassLevel={account.classLevel || ''}
                  initialSubjects={account.subjects || []}
                  submitLabel="Save learning profile"
                  onSave={updatePreferences}
                />
              </section>
            </>
          ) : (
            <>
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
                <div className={`auth-google-button ${busy ? 'is-busy' : ''}`} ref={googleButtonRef} aria-label="Continue with Google" />
              ) : (
                <p className="auth-google-notice" role="status">Google sign-in is not configured yet. Use email sign-in for now.</p>
              )}
              {googleClientId && error && <p className="auth-message auth-error" role="alert">{error}</p>}
            </>
          )}
        </div>
        <aside className="auth-card-aside">
          <span className="auth-aside-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M8 7h8M8 11h6" /></svg>
          </span>
          <p className="auth-eyebrow">A better fit for you</p>
          <h2>Study around what matters to you.</h2>
          <p>Choose your current level and subjects. Your Library opens with more relevant resources, while AI Study can shape its guidance around what you’re learning.</p>
          <a href={`${homeHref.replace(/\/$/, '')}/library.html`}>Browse the library <span aria-hidden="true">↗</span></a>
        </aside>
      </section>
      <p className="auth-page-note">Your class and subject preferences can be changed from your learning profile at any time.</p>
    </main>
  );
}
