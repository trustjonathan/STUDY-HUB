import { useEffect, useRef, useState } from 'react';
import '../styles/google-sign-in.css';
import {
  createGoogleNonce,
  loadGoogleIdentity,
  rememberGoogleOneTapDismissal,
  signInWithGoogleCredential,
  wasGoogleOneTapDismissed,
  type GoogleAuthResult,
  type GoogleIdentityApi,
} from '../lib/googleSignIn';

export interface GoogleIdentitySignInProps {
  apiBase: string;
  clientId: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  context?: 'signin' | 'signup' | 'use';
  enableAutoSelect?: boolean;
  showOneTap?: boolean;
  showButton?: boolean;
  disabled?: boolean;
  onSuccess: (result: GoogleAuthResult) => void;
  onError?: (message: string) => void;
}

export function GoogleIdentitySignIn({
  apiBase,
  clientId,
  supabaseUrl,
  supabaseAnonKey,
  context = 'signin',
  enableAutoSelect = false,
  showOneTap = true,
  showButton = true,
  disabled = false,
  onSuccess,
  onError,
}: GoogleIdentitySignInProps) {
  const buttonRef = useRef<HTMLDivElement | null>(null);
  const identityRef = useRef<GoogleIdentityApi | null>(null);
  const signingInRef = useRef(false);
  const disabledRef = useRef(disabled);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  disabledRef.current = disabled;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  useEffect(() => {
    if (!clientId || !supabaseUrl || !supabaseAnonKey) return;

    let active = true;
    let promptTimer: number | undefined;
    let resizeObserver: ResizeObserver | undefined;

    const renderResponsiveButton = (identity: GoogleIdentityApi) => {
      const container = buttonRef.current;
      if (!showButton || !container) return;
      const availableWidth = container.getBoundingClientRect().width;
      const safeWidth = Math.max(220, Math.min(360, Math.floor(availableWidth || 300)));

      container.replaceChildren();
      identity.renderButton(container, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        shape: 'rectangular',
        text: context === 'signup' ? 'signup_with' : 'continue_with',
        logo_alignment: 'left',
        width: safeWidth,
      });
    };

    async function setup() {
      try {
        const [identity, nonce] = await Promise.all([
          loadGoogleIdentity(),
          createGoogleNonce(),
        ]);
        if (!active) return;

        identityRef.current = identity;

        identity.initialize({
          client_id: clientId,
          nonce: nonce.hashed,
          auto_select: enableAutoSelect,
          cancel_on_tap_outside: true,
          use_fedcm_for_prompt: true,
          itp_support: true,
          context,
          callback: (response) => {
            if (disabledRef.current || signingInRef.current || !response.credential) return;

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
              nonce: nonce.raw,
            })
              .then((result) => {
                if (active) onSuccessRef.current(result);
              })
              .catch((err: unknown) => {
                if (!active) return;
                const msg = err instanceof Error ? err.message : 'Google sign-in could not be completed.';
                setError(msg);
                onErrorRef.current?.(msg);
              })
              .finally(() => {
                signingInRef.current = false;
                if (active) setBusy(false);
              });
          },
        });

        renderResponsiveButton(identity);

        if (showButton && buttonRef.current && typeof ResizeObserver !== 'undefined') {
          resizeObserver = new ResizeObserver(() => renderResponsiveButton(identity));
          resizeObserver.observe(buttonRef.current);
        }

        if (showOneTap && !disabledRef.current && !wasGoogleOneTapDismissed()) {
          promptTimer = window.setTimeout(() => {
            if (!active || disabledRef.current || signingInRef.current) return;
            identity.prompt((notification) => {
              if (notification.isDismissedMoment() || notification.isSkippedMoment?.()) {
                rememberGoogleOneTapDismissal();
              }
            });
          }, 900);
        }
      } catch (err: unknown) {
        if (!active) return;
        const msg = err instanceof Error ? err.message : 'Unable to load Google sign-in.';
        setError(msg);
        onErrorRef.current?.(msg);
      }
    }

    void setup();

    return () => {
      active = false;
      if (promptTimer) window.clearTimeout(promptTimer);
      resizeObserver?.disconnect();
      identityRef.current?.cancel();
    };
  }, [apiBase, clientId, supabaseUrl, supabaseAnonKey, context, enableAutoSelect, showOneTap, showButton]);

  return (
    <div className="google-signin-widget w-full flex flex-col items-center gap-2">
      {showButton && (
        <div
          ref={buttonRef}
          className={`auth-google-button w-full max-w-[360px] flex justify-center transition-opacity ${
            busy || disabled ? 'is-busy opacity-60 pointer-events-none' : ''
          }`}
          aria-label={context === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
        />
      )}
      {busy && (
        <p className="auth-google-notice text-xs text-slate-500 animate-pulse">
          Signing you in with Google…
        </p>
      )}
      {error && (
        <p role="alert" className="google-signin-feedback text-xs text-red-600 text-center max-w-[360px]">
          {error}
        </p>
      )}
    </div>
  );
}

export default GoogleIdentitySignIn;
