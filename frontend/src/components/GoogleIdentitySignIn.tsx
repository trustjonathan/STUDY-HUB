import { useEffect, useRef, useState } from 'react';
import '../styles/google-sign-in.css';
import {
  createGoogleNonce,
  loadGoogleIdentity,
  rememberGoogleOneTapDismissal,
  signInWithGoogleCredential,
  wasGoogleOneTapDismissed,
  type GoogleAuthResult,
} from '../lib/googleSignIn';

interface Props {
  apiBase: string;
  clientId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  showButton?: boolean;
  showOneTap?: boolean;
  disabled?: boolean;
  onSuccess: (result: GoogleAuthResult) => void;
  onError?: (message: string) => void;
}

export default function GoogleIdentitySignIn({
  apiBase,
  clientId,
  supabaseUrl,
  supabaseAnonKey,
  showButton = false,
  showOneTap = true,
  disabled = false,
  onSuccess,
  onError,
}: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const identityRef = useRef<Awaited<ReturnType<typeof loadGoogleIdentity>> | null>(null);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const disabledRef = useRef(disabled);
  const signingInRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  disabledRef.current = disabled;

  useEffect(() => {
    let active = true;
    let promptTimer = 0;
    let nonceRaw = '';
    const button = buttonRef.current;

    function reportError(message: string) {
      if (!active) return;
      setError(message);
      onErrorRef.current?.(message);
    }

    async function initializeIdentity(allowOneTap = true) {
      const nonce = await createGoogleNonce();
      if (!active) return;
      nonceRaw = nonce.raw;
      const identity = identityRef.current;
      if (!identity) return;
      identity.initialize({
        client_id: clientId,
        nonce: nonce.hashed,
        callback: (response) => {
          if (disabledRef.current || signingInRef.current) return;
          if (!response.credential) {
            reportError('Google did not return a sign-in credential. Please try again.');
            return;
          }
          signingInRef.current = true;
          identity.cancel();
          setBusy(true);
          setError('');
          void signInWithGoogleCredential({
            apiBase,
            clientId,
            supabaseUrl,
            supabaseAnonKey,
            token: response.credential,
            nonce: nonceRaw,
          }).then((result) => {
            if (active) onSuccessRef.current(result);
          }).catch((signInError: unknown) => {
            const message = signInError instanceof Error
              ? signInError.message
              : 'Google sign-in could not be completed. Please try again.';
            reportError(message);
            if (active && showButton) {
              void initializeIdentity(false).then(() => {
                if (active && button) {
                  button.replaceChildren();
                  identity.renderButton(button, {
                    type: 'standard',
                    theme: 'outline',
                    size: 'large',
                    shape: 'rectangular',
                    text: 'continue_with',
                    logo_alignment: 'left',
                    width: Math.min(360, Math.floor(button.clientWidth || 360)),
                  });
                }
              }).catch((retryError: unknown) => {
                reportError(retryError instanceof Error
                  ? retryError.message
                  : 'Google sign-in could not be prepared for another attempt.');
              });
            }
          }).finally(() => {
            signingInRef.current = false;
            if (active) setBusy(false);
          });
        },
      });

      if (showButton && button) {
        button.replaceChildren();
        identity.renderButton(button, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          logo_alignment: 'left',
          width: Math.min(360, Math.floor(button.clientWidth || 360)),
        });
      }

      if (allowOneTap && showOneTap && !wasGoogleOneTapDismissed()) {
        promptTimer = window.setTimeout(() => {
          identity.prompt((notification) => {
            if (notification.isNotDisplayed()) {
              reportError('Google One Tap is not available in this browser right now. Use the Continue with Google button on the sign-in page.');
              return;
            }
            if (notification.isDismissedMoment() || notification.isSkippedMoment()) {
              try {
                rememberGoogleOneTapDismissal();
              } catch {
                reportError('This browser could not remember your One Tap dismissal for this session.');
              }
            }
          });
        }, 1200);
      }
    }

    if (!clientId || !apiBase || !supabaseUrl || !supabaseAnonKey) {
      reportError('Google sign-in is not fully configured. Please use email sign-in or try again later.');
      return () => { active = false; };
    }

    void loadGoogleIdentity().then((identity) => {
      if (!active) return;
      identityRef.current = identity;
      return initializeIdentity();
    }).catch((loadError: unknown) => {
      reportError(loadError instanceof Error
        ? loadError.message
        : 'Google sign-in could not be loaded. Please use email sign-in or try again later.');
    });

    return () => {
      active = false;
      window.clearTimeout(promptTimer);
      identityRef.current?.cancel();
    };
  }, [apiBase, clientId, showButton, showOneTap, supabaseAnonKey, supabaseUrl]);

  return (
    <div className={`google-signin-widget${busy || disabled ? ' is-busy' : ''}`} aria-busy={busy || disabled}>
      {showButton && <div className="auth-google-button" ref={buttonRef} aria-label="Continue with Google" />}
      {error && <p className="google-signin-feedback" role="alert">{error}</p>}
    </div>
  );
}
