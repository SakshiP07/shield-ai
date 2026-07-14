import { api } from './api';

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const OAUTH_INTENT_KEY = 'google_oauth_intent';
const OAUTH_STATE_KEY = 'google_oauth_state';
const OAUTH_VERIFIER_KEY = 'google_oauth_verifier';
const OAUTH_REDIRECT_KEY = 'google_oauth_redirect';

export function getGoogleRedirectUri(): string {
  return `${window.location.origin}/auth/google/callback`;
}

function base64UrlEncode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function createPkce(): Promise<{ verifier: string; challenge: string }> {
  const raw = new Uint8Array(32);
  crypto.getRandomValues(raw);
  // PKCE verifier must be ASCII; use base64url of random bytes
  const verifier = base64UrlEncode(raw.buffer);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return { verifier, challenge: base64UrlEncode(digest) };
}

export type GoogleCallbackParams = {
  code: string | null;
  idToken: string | null;
  state: string | null;
  error: string | null;
};

/** Read OAuth result from query (code flow) or hash (legacy id_token). */
export function readGoogleOAuthCallback(search = window.location.search, hash = window.location.hash): GoogleCallbackParams {
  const query = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);

  return {
    code: query.get('code') || hashParams.get('code'),
    idToken: hashParams.get('id_token') || query.get('id_token'),
    state: query.get('state') || hashParams.get('state'),
    error: query.get('error') || hashParams.get('error'),
  };
}

export function peekStoredGoogleOAuth(): {
  intent: 'login' | 'signup' | 'link';
  state: string | null;
  codeVerifier: string | null;
  redirectUri: string | null;
} {
  return {
    intent: (sessionStorage.getItem(OAUTH_INTENT_KEY) || 'login') as 'login' | 'signup' | 'link',
    state: sessionStorage.getItem(OAUTH_STATE_KEY),
    codeVerifier: sessionStorage.getItem(OAUTH_VERIFIER_KEY),
    redirectUri: sessionStorage.getItem(OAUTH_REDIRECT_KEY),
  };
}

export function clearStoredGoogleOAuth(): void {
  sessionStorage.removeItem(OAUTH_INTENT_KEY);
  sessionStorage.removeItem(OAUTH_STATE_KEY);
  sessionStorage.removeItem(OAUTH_VERIFIER_KEY);
  sessionStorage.removeItem(OAUTH_REDIRECT_KEY);
}

/** @deprecated Prefer peekStoredGoogleOAuth + clearStoredGoogleOAuth */
export function consumeStoredGoogleOAuth() {
  const stored = peekStoredGoogleOAuth();
  clearStoredGoogleOAuth();
  return stored;
}

export async function startGoogleOAuth(intent: 'login' | 'signup' | 'link'): Promise<void> {
  const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  if (!clientId) {
    throw new Error('Google sign-in is not configured.');
  }

  const redirectUri = getGoogleRedirectUri();
  const { verifier, challenge } = await createPkce();
  const { state } = await api.googlePrepare({ intent, redirect_uri: redirectUri });

  sessionStorage.setItem(OAUTH_INTENT_KEY, intent);
  sessionStorage.setItem(OAUTH_STATE_KEY, state);
  sessionStorage.setItem(OAUTH_VERIFIER_KEY, verifier);
  sessionStorage.setItem(OAUTH_REDIRECT_KEY, redirectUri);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
    access_type: 'online',
  });

  window.location.assign(`${GOOGLE_AUTH_URL}?${params.toString()}`);
}
