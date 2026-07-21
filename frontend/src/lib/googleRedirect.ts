import { getSupabase, isSupabaseConfigured, resetSupabaseOAuthClient } from './supabase';
import { resetGoogleCallbackState } from './googleCallbackState';

const OAUTH_INTENT_KEY = 'supabase_oauth_intent';

export function getGoogleRedirectUri(): string {
  return `${window.location.origin}/auth/google/callback`;
}

export type OAuthIntent = 'login' | 'signup' | 'link';

export function peekOAuthIntent(): OAuthIntent | null {
  return sessionStorage.getItem(OAUTH_INTENT_KEY) as OAuthIntent | null;
}

export function takeOAuthIntent(): OAuthIntent {
  const intent = peekOAuthIntent() ?? 'login';
  sessionStorage.removeItem(OAUTH_INTENT_KEY);
  return intent;
}

export async function startGoogleOAuth(intent: OAuthIntent): Promise<void> {
  if (!isSupabaseConfigured()) {
    throw new Error('Google sign-in is not configured.');
  }

  // Fresh client + callback state for each attempt (avoids stale PKCE / cached failures).
  resetGoogleCallbackState();
  resetSupabaseOAuthClient();

  const redirectTo = getGoogleRedirectUri();
  sessionStorage.setItem(OAUTH_INTENT_KEY, intent);

  const supabase = getSupabase();

  // skipBrowserRedirect ensures the PKCE verifier is written to localStorage
  // before navigation — otherwise the callback page can't exchange the code.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: { prompt: 'select_account' },
      skipBrowserRedirect: true,
    },
  });

  if (error || !data.url) {
    sessionStorage.removeItem(OAUTH_INTENT_KEY);
    throw new Error(error?.message || 'Could not start Google sign-in');
  }

  window.location.assign(data.url);
}
