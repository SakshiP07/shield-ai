import { clearToken, getToken } from './api';

/** Decode JWT payload without verification (client-side expiry hint only). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '='));
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** True when a stored token exists and is not expired (5s clock skew buffer). */
export function isStoredTokenUsable(): boolean {
  const token = getToken();
  if (!token || token.split('.').length !== 3) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 > Date.now() + 5000;
}

/** Drop expired or malformed tokens before any API call. */
export function purgeInvalidStoredToken(): boolean {
  const token = getToken();
  if (!token) return false;
  if (!isStoredTokenUsable()) {
    clearToken();
    return true;
  }
  return false;
}
