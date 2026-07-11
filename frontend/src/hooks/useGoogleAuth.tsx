import type { ReactNode } from 'react';
import { GoogleOAuthProvider, useGoogleOAuth } from '@react-oauth/google';

const clientId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? '';

/** Wraps children with GoogleOAuthProvider only when VITE_GOOGLE_CLIENT_ID is set. */
export function GoogleAuthBoundary({ children }: { children: ReactNode }) {
  if (!clientId) return <>{children}</>;
  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>;
}

/** Safe hook for pages that may render without the provider when OAuth is not configured. */
export function useOptionalGoogleOAuth() {
  try {
    return useGoogleOAuth();
  } catch {
    return { clientId: '', scriptLoadedSuccessfully: false };
  }
}

export function useGoogleSignInReady() {
  const { scriptLoadedSuccessfully } = useOptionalGoogleOAuth();
  return Boolean(clientId) && scriptLoadedSuccessfully;
}

export function useGoogleClientId() {
  return clientId;
}
