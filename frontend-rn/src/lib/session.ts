import { getToken, clearToken } from './api';

/** Base64-decode without using `atob` (not available in all RN engines). */
function base64Decode(str: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let output = '';
  let i = 0;
  const input = str.replace(/-/g, '+').replace(/_/g, '/');
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);

  while (i < padded.length) {
    const enc1 = chars.indexOf(padded.charAt(i++));
    const enc2 = chars.indexOf(padded.charAt(i++));
    const enc3 = chars.indexOf(padded.charAt(i++));
    const enc4 = chars.indexOf(padded.charAt(i++));

    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;

    output += String.fromCharCode(chr1);
    if (enc3 !== 64) output += String.fromCharCode(chr2);
    if (enc4 !== 64) output += String.fromCharCode(chr3);
  }
  return output;
}

/** Decode JWT payload without verification (client-side expiry hint only). */
function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = base64Decode(part);
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** True when a stored token exists and is not expired (5s clock skew buffer). */
export async function isStoredTokenUsable(): Promise<boolean> {
  const token = await getToken();
  if (!token || token.split('.').length !== 3) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 > Date.now() + 5000;
}

/** Drop expired or malformed tokens before any API call. */
export async function purgeInvalidStoredToken(): Promise<boolean> {
  const token = await getToken();
  if (!token) return false;
  if (!(await isStoredTokenUsable())) {
    await clearToken();
    return true;
  }
  return false;
}
