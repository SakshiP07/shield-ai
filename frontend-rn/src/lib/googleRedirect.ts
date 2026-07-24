/**
 * Google OAuth via Supabase + in-app browser (no native Google Sign-In module).
 *
 * Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:
 *   shieldai://callback
 *   shieldai://**
 */
import * as WebBrowser from 'expo-web-browser';
import * as QueryParams from 'expo-auth-session/build/QueryParams';
import { makeRedirectUri } from 'expo-auth-session';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Linking, Platform } from 'react-native';
import { getSupabase, isSupabaseConfigured } from './supabase';

WebBrowser.maybeCompleteAuthSession();

const OAUTH_INTENT_KEY = 'supabase_oauth_intent';
const PENDING_CALLBACK_KEY = 'shield_oauth_pending_callback';

let oauthInFlight = false;
let linkListenerInstalled = false;

export const GOOGLE_REDIRECT_URI = 'shieldai://callback';

export type OAuthIntent = 'login' | 'signup' | 'link';

export async function peekOAuthIntent(): Promise<OAuthIntent | null> {
  return (await AsyncStorage.getItem(OAUTH_INTENT_KEY)) as OAuthIntent | null;
}

export async function takeOAuthIntent(): Promise<OAuthIntent> {
  const intent = (await peekOAuthIntent()) ?? 'login';
  await AsyncStorage.removeItem(OAUTH_INTENT_KEY);
  return intent;
}

function resolveRedirectUri(): string {
  const uri = makeRedirectUri({
    scheme: 'shieldai',
    path: 'callback',
    native: GOOGLE_REDIRECT_URI,
  });
  if (
    !uri ||
    uri.startsWith('http://') ||
    uri.startsWith('https://') ||
    uri.startsWith('exp://') ||
    uri.includes('localhost') ||
    uri.includes('127.0.0.1')
  ) {
    return GOOGLE_REDIRECT_URI;
  }
  return uri;
}

export function isOAuthCallbackUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  if (lower.includes('localhost') || lower.includes('127.0.0.1')) return false;
  if (!lower.startsWith('shieldai://')) return false;
  return (
    lower.includes('callback') ||
    lower.includes('access_token') ||
    lower.includes('refresh_token') ||
    lower.includes('code=') ||
    lower.includes('error=')
  );
}

async function storePendingCallback(url: string) {
  await AsyncStorage.setItem(PENDING_CALLBACK_KEY, url);
}

export async function consumePendingCallback(): Promise<string | null> {
  const url = await AsyncStorage.getItem(PENDING_CALLBACK_KEY);
  if (!url) return null;
  await AsyncStorage.removeItem(PENDING_CALLBACK_KEY);
  return url;
}

export async function sessionAccessTokenFromUrl(url: string): Promise<string> {
  if (url.includes('localhost') || url.includes('127.0.0.1')) {
    throw new Error(
      'Google redirected to localhost. Add shieldai://callback under Supabase → Authentication → URL Configuration → Redirect URLs.',
    );
  }

  const { params, errorCode } = QueryParams.getQueryParams(url);
  if (errorCode) throw new Error(String(errorCode));
  if (params.error) {
    throw new Error(String(params.error_description || params.error));
  }

  if (params.access_token) {
    return params.access_token;
  }

  if (params.code) {
    const supabase = getSupabase();
    const { data, error } = await supabase.auth.exchangeCodeForSession(params.code);
    if (error || !data.session?.access_token) {
      throw new Error(error?.message || 'Failed to exchange Google auth code');
    }
    return data.session.access_token;
  }

  throw new Error('Google sign-in did not return an access token.');
}

export function installGoogleOAuthLinkListener(): void {
  if (linkListenerInstalled) return;
  linkListenerInstalled = true;

  const handle = (url: string | null) => {
    if (!isOAuthCallbackUrl(url)) return;
    void storePendingCallback(url!);
  };

  Linking.addEventListener('url', ({ url }) => handle(url));
  void Linking.getInitialURL().then(handle);
}

async function waitForCallbackUrl(timeoutMs: number): Promise<string | null> {
  const started = Date.now();

  const existing = await AsyncStorage.getItem(PENDING_CALLBACK_KEY);
  if (existing && isOAuthCallbackUrl(existing)) {
    await AsyncStorage.removeItem(PENDING_CALLBACK_KEY);
    return existing;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (url: string | null) => {
      if (settled) return;
      settled = true;
      sub.remove();
      appSub.remove();
      clearInterval(poll);
      clearTimeout(timer);
      resolve(url);
    };

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (isOAuthCallbackUrl(url)) {
        void storePendingCallback(url);
        finish(url);
      }
    });

    const appSub = AppState.addEventListener('change', (state) => {
      if (state !== 'active') return;
      void (async () => {
        const pending = await AsyncStorage.getItem(PENDING_CALLBACK_KEY);
        if (pending && isOAuthCallbackUrl(pending)) {
          await AsyncStorage.removeItem(PENDING_CALLBACK_KEY);
          finish(pending);
          return;
        }
        const initial = await Linking.getInitialURL();
        if (isOAuthCallbackUrl(initial)) finish(initial);
      })();
    });

    const poll = setInterval(() => {
      void (async () => {
        const pending = await AsyncStorage.getItem(PENDING_CALLBACK_KEY);
        if (pending && isOAuthCallbackUrl(pending)) {
          await AsyncStorage.removeItem(PENDING_CALLBACK_KEY);
          finish(pending);
        }
      })();
    }, 250);

    const timer = setTimeout(() => finish(null), Math.max(0, timeoutMs - (Date.now() - started)));
  });
}

export async function startGoogleOAuth(intent: OAuthIntent): Promise<string | null> {
  if (oauthInFlight) {
    throw new Error('Google sign-in is already in progress. Close the browser, then try again.');
  }
  oauthInFlight = true;
  installGoogleOAuthLinkListener();

  try {
    if (!isSupabaseConfigured()) {
      throw new Error(
        'Google sign-in is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in frontend-rn/.env.',
      );
    }

    await AsyncStorage.removeItem(PENDING_CALLBACK_KEY);
    await AsyncStorage.setItem(OAUTH_INTENT_KEY, intent);

    const redirectUri = resolveRedirectUri();
    const supabase = getSupabase();

    if (Platform.OS === 'android') {
      try {
        await WebBrowser.warmUpAsync();
      } catch {
        // optional
      }
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        skipBrowserRedirect: true,
        redirectTo: redirectUri,
      },
    });

    if (error || !data.url) {
      await AsyncStorage.removeItem(OAUTH_INTENT_KEY);
      throw new Error(error?.message || 'Could not start Google sign-in');
    }

    try {
      const authorizeUrl = new URL(data.url);
      const redirectTo = decodeURIComponent(authorizeUrl.searchParams.get('redirect_to') ?? '');
      if (
        redirectTo.includes('localhost') ||
        redirectTo.includes('127.0.0.1') ||
        (redirectTo.length > 0 && !redirectTo.startsWith('shieldai://'))
      ) {
        await AsyncStorage.removeItem(OAUTH_INTENT_KEY);
        throw new Error(
          'Supabase rejected the app redirect. Add shieldai://callback (and shieldai://**) under Authentication → URL Configuration → Redirect URLs.',
        );
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('Supabase rejected')) throw err;
    }

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    let callbackUrl: string | null = null;
    if (result.type === 'success' && isOAuthCallbackUrl(result.url)) {
      callbackUrl = result.url;
    } else if (
      result.type === 'success' &&
      result.url &&
      (result.url.includes('localhost') || result.url.includes('127.0.0.1'))
    ) {
      await AsyncStorage.removeItem(OAUTH_INTENT_KEY);
      throw new Error(
        'Google redirected to localhost. Add shieldai://callback to Supabase Redirect URLs.',
      );
    } else {
      callbackUrl = await waitForCallbackUrl(5_000);
    }

    try {
      await WebBrowser.coolDownAsync();
    } catch {
      // optional
    }

    if (!callbackUrl) {
      await AsyncStorage.removeItem(OAUTH_INTENT_KEY);
      return null;
    }

    try {
      return await sessionAccessTokenFromUrl(callbackUrl);
    } catch (err) {
      await AsyncStorage.removeItem(OAUTH_INTENT_KEY);
      throw err;
    }
  } finally {
    oauthInFlight = false;
  }
}
