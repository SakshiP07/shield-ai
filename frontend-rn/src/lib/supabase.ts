import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import 'react-native-get-random-values';
import { sha256 } from 'js-sha256';

// ─── Polyfill WebCrypto for React Native (required for PKCE) ────────────
const g = globalThis as typeof globalThis & { crypto?: Crypto };

if (!g.crypto) {
  g.crypto = {} as Crypto;
}

// Polyfill crypto.subtle.digest (SHA-256) for PKCE challenge
if (!g.crypto.subtle) {
  (g.crypto as Crypto & { subtle: SubtleCrypto }).subtle = {
    digest: async (_algorithm: AlgorithmIdentifier, data: BufferSource) => {
      const buffer =
        data instanceof ArrayBuffer
          ? data
          : (data as ArrayBufferView).buffer.slice(
              (data as ArrayBufferView).byteOffset,
              (data as ArrayBufferView).byteOffset + (data as ArrayBufferView).byteLength,
            );
      return sha256.arrayBuffer(buffer as ArrayBuffer);
    },
  } as SubtleCrypto;
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
  const url = getEnvVar('SUPABASE_URL')?.trim();
  const key = getEnvVar('SUPABASE_ANON_KEY')?.trim();
  return Boolean(url && key);
}
