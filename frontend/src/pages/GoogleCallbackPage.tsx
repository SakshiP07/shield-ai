import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/ToastContext';
import { ApiError, api } from '../lib/api';
import {
  clearStoredGoogleOAuth,
  peekStoredGoogleOAuth,
  readGoogleOAuthCallback,
} from '../lib/googleRedirect';

type CallbackResult =
  | { ok: true; idToken: string; intent: 'login' | 'signup' | 'link' }
  | { ok: false; message: string };

// Module-level so React Strict Mode double-mount shares one exchange.
let pendingCallback: Promise<CallbackResult> | null = null;

function resolveGoogleCallback(search: string, hash: string): Promise<CallbackResult> {
  if (!pendingCallback) {
    const run = (async (): Promise<CallbackResult> => {
      try {
        const { code, idToken, state, error: oauthError } = readGoogleOAuthCallback(search, hash);
        if (oauthError) {
          return {
            ok: false,
            message: oauthError === 'access_denied' ? 'Google sign-in was cancelled.' : oauthError,
          };
        }

        const stored = peekStoredGoogleOAuth();

        if (code) {
          if (!state || !stored.state || stored.state !== state) {
            return { ok: false, message: 'OAuth state mismatch. Please try again from the login page.' };
          }
          if (!stored.codeVerifier || !stored.redirectUri) {
            return { ok: false, message: 'OAuth session missing. Please try again from the login page.' };
          }

          const { id_token } = await api.googleExchange({
            code,
            code_verifier: stored.codeVerifier,
            redirect_uri: stored.redirectUri,
            state,
            intent: stored.intent,
          });
          clearStoredGoogleOAuth();
          return { ok: true, idToken: id_token, intent: stored.intent };
        }

        if (idToken) {
          clearStoredGoogleOAuth();
          return { ok: true, idToken, intent: stored.intent };
        }

        return {
          ok: false,
          message:
            'Google did not return an auth code. Close this tab, hard-refresh http://localhost:5173/login, then try Google again.',
        };
      } catch (err) {
        clearStoredGoogleOAuth();
        return {
          ok: false,
          message: err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.',
        };
      }
    })();

    pendingCallback = run;
    void run.finally(() => {
      if (pendingCallback === run) pendingCallback = null;
    });
  }
  return pendingCallback;
}

export function GoogleCallbackPage() {
  const { googleLogin, linkGoogle } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const urlRef = useRef({ search: window.location.search, hash: window.location.hash });

  useEffect(() => {
    let alive = true;

    (async () => {
      const result = await resolveGoogleCallback(urlRef.current.search, urlRef.current.hash);
      if (!alive) return;

      if (!result.ok) {
        setError(result.message);
        return;
      }

      try {
        if (result.intent === 'link') {
          await linkGoogle(result.idToken);
          if (!alive) return;
          showToast('Google account linked', 'success');
          navigate('/app/profile', { replace: true });
          return;
        }

        const needsProfile = await googleLogin(result.idToken, result.intent);
        if (!alive) return;
        showToast(result.intent === 'signup' ? 'Account created successfully' : 'Welcome back', 'success');
        navigate(needsProfile ? '/setup' : '/app', { replace: true });
      } catch (err) {
        if (!alive) return;
        setError(err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.');
      }
    })();

    return () => {
      alive = false;
    };
  }, [googleLogin, linkGoogle, navigate, showToast]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-surface-base px-6 text-center">
        <p className="text-sm text-rose-400">{error}</p>
        <Link to="/login" className="mt-4 text-sm font-medium text-blue-400 hover:text-blue-300">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );
}
