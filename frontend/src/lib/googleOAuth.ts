const GOOGLE_CONSOLE_URL =
  'https://console.cloud.google.com/apis/credentials';

/** Origins that must be registered for local ShieldAI dev. */
export const REQUIRED_GOOGLE_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
] as const;

export function getCurrentOrigin(): string {
  return window.location.origin;
}

export function isOriginLikelyAllowed(): boolean {
  return REQUIRED_GOOGLE_ORIGINS.includes(getCurrentOrigin() as (typeof REQUIRED_GOOGLE_ORIGINS)[number]);
}

export function googleOAuthSetupMessage(): string {
  const origin = getCurrentOrigin();
  return `Add "${origin}" to Authorized JavaScript origins for your OAuth Web client in Google Cloud Console. Also add http://localhost:5173 and http://127.0.0.1:5173 if missing. Open the app at http://localhost:5173 for the most reliable local setup.`;
}

export { GOOGLE_CONSOLE_URL };
