const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_INTENT_KEY = 'google_oauth_intent';
const OAUTH_STATE_KEY = 'google_oauth_state';
const OAUTH_NONCE_KEY = 'google_oauth_nonce';

export function getGoogleRedirectUri(): string {
  return `${window.location.origin}/auth/google/callback`;
}

export function readGoogleOAuthCallbackHash(): {
  idToken: string | null;
  state: string | null;
  error: string | null;
} {
  const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
  const params = new URLSearchParams(hash);
  return {
    idToken: params.get('id_token'),
    state: params.get('state'),
    error: params.get('error'),
  };
}

export function consumeStoredGoogleOAuth(): {
  intent: 'login' | 'signup' | 'link';
  state: string | null;
  nonce: string | null;
} {
  const intent = (sessionStorage.getItem(OAUTH_INTENT_KEY) || 'login') as 'login' | 'signup' | 'link';
  const state = sessionStorage.getItem(OAUTH_STATE_KEY);
  const nonce = sessionStorage.getItem(OAUTH_NONCE_KEY);
  sessionStorage.removeItem(OAUTH_INTENT_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_NONCE_KEY);
  return { intent, state, nonce };
}

export function startGoogleOAuth(intent: 'login' | 'signup' | 'link'): void {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  if (!clientId) {
    throw new Error('Google sign-in is not configured.');
  }

  const redirectUri = getGoogleRedirectUri();
  const state = crypto.randomUUID();
  const nonce = crypto.randomUUID();

  sessionStorage.setItem(OAUTH_INTENT_KEY, intent);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  sessionStorage.setItem(OAUTH_NONCE_KEY, nonce);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token',
    scope: 'openid email profile',
    state,
    nonce,
    prompt: 'select_account',
  });

  window.location.assign(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
