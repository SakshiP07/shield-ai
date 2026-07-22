import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { sha256 } from 'js-sha256';

// ─── Polyfill WebCrypto for React Native ────────────────────────────────
// Supabase auth requires crypto.getRandomValues and crypto.subtle.digest.
// We use react-native-get-random-values for the former, and js-sha256 for the latter
// because expo-crypto can cause native module errors in some Expo Go builds.

if (typeof globalThis.crypto === 'undefined') {
  (globalThis as any).crypto = {};
}

// Polyfill crypto.subtle.digest (SHA-256)
if (!globalThis.crypto.subtle) {
  (globalThis.crypto as any).subtle = {
    digest: async (_algorithm: string, data: ArrayBuffer) => {
      // js-sha256 can directly hash an ArrayBuffer and return an ArrayBuffer
      return sha256.arrayBuffer(data);
    },
  };
}

// ─── Supabase client ────────────────────────────────────────────────────

let client: SupabaseClient | null = null;

function getEnvVar(key: string): string | undefined {
  const map: Record<string, string | undefined> = {
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  };
  return map[key];
}

export function getSupabase(): SupabaseClient {
  const url = getEnvVar('SUPABASE_URL');
  const anonKey = getEnvVar('SUPABASE_ANON_KEY');
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.',
    );
  }
  if (!client) {
    client = createClient(url, anonKey, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        persistSession: true,
        autoRefreshToken: false,
        storage: AsyncStorage,
      },
    });
  }
  return client;
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getEnvVar('SUPABASE_URL') && getEnvVar('SUPABASE_ANON_KEY'));
}

/** Clear any prior callback attempt so a new Google sign-in can run cleanly. */
export function resetSupabaseOAuthClient(): void {
  client = null;
}
