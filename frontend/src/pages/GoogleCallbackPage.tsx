import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/ToastContext';
import { ApiError } from '../lib/api';
import { takeOAuthIntent } from '../lib/googleRedirect';
import { getSupabase } from '../lib/supabase';
import {
  getGoogleCallbackPromise,
  setGoogleCallbackPromise,
  type CallbackResult,
} from '../lib/googleCallbackState';

function readUrlParams() {
  const search = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(
    window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash,
  );
  const get = (key: string) => search.get(key) || hash.get(key);
  return {
    code: get('code'),
    error: get('error'),
    errorDescription: get('error_description'),
  };
}

async function resolveSupabaseCallback(): Promise<CallbackResult> {
  try {
    const { code, error: oauthError, errorDescription } = readUrlParams();

    if (oauthError || errorDescription) {
      return {
        ok: false,
        message:
          oauthError === 'access_denied'
            ? 'Google sign-in was cancelled.'
            : errorDescription || oauthError || 'Google sign-in failed.',
      };
    }

    const supabase = getSupabase();

    // detectSessionInUrl:true exchanges ?code= during client init — wait for that first.
    {
      const { data, error } = await supabase.auth.getSession();
      if (data.session?.access_token) {
        window.history.replaceState({}, document.title, window.location.pathname);
        return { ok: true, accessToken: data.session.access_token, intent: takeOAuthIntent() };
      }
      if (error) {
        return { ok: false, message: error.message };
      }
    }

    // Fallback if init did not pick up the code (e.g. race on first paint).
    if (code) {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      window.history.replaceState({}, document.title, window.location.pathname);
      if (error || !data.session?.access_token) {
        return {
          ok: false,
          message: error?.message || 'Google sign-in failed. Please try again from the login page.',
        };
      }
      return { ok: true, accessToken: data.session.access_token, intent: takeOAuthIntent() };
    }

    return {
      ok: false,
      message: 'Google sign-in did not return a session. Please try again from the login page.',
    };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Google sign-in failed. Please try again.',
    };
  }
}

function resolveSupabaseCallbackOnce(): Promise<CallbackResult> {
  const existing = getGoogleCallbackPromise();
  if (existing) return existing;
  return setGoogleCallbackPromise(resolveSupabaseCallback());
}

export function GoogleCallbackPage() {
  const { googleLogin, linkGoogle } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await resolveSupabaseCallbackOnce();
      if (cancelled) return;

      if (!result.ok) {
        setError(result.message);
        return;
      }

      const accessToken = result.accessToken;
      try {
        if (result.intent === 'link') {
          await linkGoogle(accessToken);
          if (cancelled) return;
          showToast('Google account linked', 'success');
          navigate('/app/profile', { replace: true });
        } else {
          const { needsProfile, isNewUser } = await googleLogin(accessToken);
          if (cancelled) return;
          showToast(isNewUser ? 'Account created successfully' : 'Welcome back', 'success');
          // Google users land on home; only incomplete profiles go to setup.
          navigate(needsProfile ? '/setup' : '/app', { replace: true });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.');
        }
      }
      // Keep Supabase session until after app login succeeds; then clear locally.
      if (!cancelled) {
        try {
          await getSupabase().auth.signOut({ scope: 'local' });
        } catch {
          // App JWT is the source of truth.
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [googleLogin, linkGoogle, navigate, showToast]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-surface-base px-6 text-center">
        <p className="text-sm text-rose-400">{error}</p>
        <button type="button" className="btn-primary max-w-xs" onClick={() => navigate('/login', { replace: true })}>
          Back to sign in
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-base">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
    </div>
  );
}
