import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/ToastContext';
import { ApiError } from '../lib/api';
import { consumeStoredGoogleOAuth, readGoogleOAuthCallbackHash } from '../lib/googleRedirect';

export function GoogleCallbackPage() {
  const { googleLogin, linkGoogle } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      const { idToken, state, error: oauthError } = readGoogleOAuthCallbackHash();
      if (oauthError) {
        if (!cancelled) setError(oauthError === 'access_denied' ? 'Google sign-in was cancelled.' : oauthError);
        return;
      }

      const stored = consumeStoredGoogleOAuth();

      if (!idToken) {
        if (!cancelled) setError('Google did not return a sign-in token. Please try again.');
        return;
      }
      if (!state || !stored.state || stored.state !== state) {
        if (!cancelled) setError('OAuth state mismatch. Please try again.');
        return;
      }

      try {
        if (cancelled) return;

        if (stored.intent === 'link') {
          await linkGoogle(idToken);
          showToast('Google account linked', 'success');
          navigate('/app/profile', { replace: true });
          return;
        }

        const needsProfile = await googleLogin(idToken, stored.intent);
        showToast(stored.intent === 'signup' ? 'Account created successfully' : 'Welcome back', 'success');
        navigate(needsProfile ? '/setup' : '/app', { replace: true });
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Google sign-in failed. Please try again.');
        }
      }
    }

    complete();
    return () => {
      cancelled = true;
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
