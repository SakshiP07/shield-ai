export type CallbackResult =
  | { ok: true; accessToken: string; intent: 'login' | 'signup' | 'link' }
  | { ok: false; message: string };

/** Shared across Strict Mode remounts; reset when starting a new OAuth attempt. */
let callbackPromise: Promise<CallbackResult> | null = null;

export function resetGoogleCallbackState(): void {
  callbackPromise = null;
}

export function getGoogleCallbackPromise(): Promise<CallbackResult> | null {
  return callbackPromise;
}

export function setGoogleCallbackPromise(promise: Promise<CallbackResult>): Promise<CallbackResult> {
  callbackPromise = promise;
  return promise;
}
