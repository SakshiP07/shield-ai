const LOG_PREFIX = '[Biometric Auth]';

export type BiometricMethod = 'device_authenticator';

export type BiometricSupport = {
  /** WebAuthn API exists and page is a secure context */
  available: boolean;
  /** Platform authenticator (Face ID / Touch ID / fingerprint) is available */
  platformAuthenticator: boolean;
  detectedMethods: BiometricMethod[];
  reason?: string;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
};

export class BiometricAuthError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'BiometricAuthError';
    this.code = code;
  }
}

function log(message: string, data?: unknown) {
  if (data !== undefined) {
    console.debug(LOG_PREFIX, message, data);
  } else {
    console.debug(LOG_PREFIX, message);
  }
}

function logError(message: string, error: unknown) {
  console.error(LOG_PREFIX, message, error);
}

export function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64urlToBuffer(value: string): ArrayBuffer {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = (4 - (base64.length % 4)) % 4;
  const padded = base64 + '='.repeat(padding);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

function detectPlatform(): BiometricSupport['platform'] {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (/Macintosh|Windows|Linux/i.test(ua)) return 'desktop';
  return 'unknown';
}

function detectMethods(platform: BiometricSupport['platform']): BiometricMethod[] {
  void platform;
  // Browsers intentionally do not reveal whether the platform authenticator
  // used a fingerprint, face scan, device PIN, or another verification method.
  return ['device_authenticator'];
}

export function getBiometricButtonLabel(methods: BiometricMethod[]): string {
  void methods;
  return 'Sign in with a passkey';
}

export function getBiometricUnavailableMessage(reason?: string): string {
  return reason ?? 'Biometric authentication is not available on this device or browser.';
}

/** Synchronous pre-check before async platform probe. */
export function checkBiometricSupportSync(): Omit<BiometricSupport, 'platformAuthenticator'> {
  const platform = detectPlatform();
  const detectedMethods = detectMethods(platform);

  if (typeof window === 'undefined') {
    return { available: false, detectedMethods, reason: 'Not running in a browser.', platform };
  }

  if (typeof PublicKeyCredential === 'undefined') {
    log('WebAuthn API unavailable');
    return {
      available: false,
      detectedMethods,
      reason: 'This browser does not support WebAuthn biometrics. Use phone or Google sign-in.',
      platform,
    };
  }

  if (!window.isSecureContext) {
    log('Insecure context — WebAuthn requires HTTPS or localhost');
    return {
      available: false,
      detectedMethods,
      reason: 'Biometrics require a secure connection (HTTPS or localhost).',
      platform,
    };
  }

  return { available: true, detectedMethods, platform };
}

export async function probePlatformAuthenticator(): Promise<boolean> {
  if (typeof PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') {
    return false;
  }
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    log('Platform authenticator probe', { available });
    return available;
  } catch (error) {
    logError('Platform authenticator probe failed', error);
    return false;
  }
}

export async function detectBiometricSupport(): Promise<BiometricSupport> {
  const base = checkBiometricSupportSync();
  if (!base.available) {
    return { ...base, platformAuthenticator: false };
  }

  const platformAuthenticator = await probePlatformAuthenticator();
  if (!platformAuthenticator) {
    return {
      ...base,
      platformAuthenticator: false,
      available: false,
      reason:
        'No user-verifying platform authenticator is available. Set up a device screen lock, passkey, or biometric verification.',
    };
  }

  log('Biometric support ready', { platform: base.platform, methods: base.detectedMethods });
  return { ...base, platformAuthenticator: true };
}

type PublicKeyCredentialJSON = Record<string, unknown>;

export async function credentialToJson(credential: PublicKeyCredential): Promise<PublicKeyCredentialJSON> {
  const response = credential.response;

  if (response instanceof AuthenticatorAttestationResponse) {
    return {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      type: credential.type,
      authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
      clientExtensionResults: credential.getClientExtensionResults(),
      response: {
        clientDataJSON: bufferToBase64url(response.clientDataJSON),
        attestationObject: bufferToBase64url(response.attestationObject),
        transports: typeof response.getTransports === 'function' ? response.getTransports() : [],
      },
    };
  }

  const assertion = response as AuthenticatorAssertionResponse;
  return {
    id: credential.id,
    rawId: bufferToBase64url(credential.rawId),
    type: credential.type,
    authenticatorAttachment: credential.authenticatorAttachment ?? undefined,
    clientExtensionResults: credential.getClientExtensionResults(),
    response: {
      clientDataJSON: bufferToBase64url(assertion.clientDataJSON),
      authenticatorData: bufferToBase64url(assertion.authenticatorData),
      signature: bufferToBase64url(assertion.signature),
      userHandle: assertion.userHandle ? bufferToBase64url(assertion.userHandle) : null,
    },
  };
}

export function getWebAuthnContext() {
  return {
    rpId: window.location.hostname,
    origin: window.location.origin,
  };
}

const PASSKEYS_STORAGE_KEY = 'shieldai_passkeys';

type StoredPasskey = { id: string; rpId: string };

export function getLocalPasskeyIds(): string[] {
  try {
    const raw = localStorage.getItem(PASSKEYS_STORAGE_KEY);
    if (!raw) return [];
    const items = JSON.parse(raw) as StoredPasskey[];
    const rpId = window.location.hostname;
    return items.filter((item) => item.rpId === rpId).map((item) => item.id);
  } catch {
    return [];
  }
}

export function saveLocalPasskey(credentialId: string) {
  const rpId = window.location.hostname;
  const existing = getLocalPasskeyIds().filter((id) => id !== credentialId);
  const allRaw = localStorage.getItem(PASSKEYS_STORAGE_KEY);
  const all: StoredPasskey[] = allRaw ? (JSON.parse(allRaw) as StoredPasskey[]) : [];
  const kept = all.filter((item) => item.id !== credentialId);
  kept.push({ id: credentialId, rpId });
  localStorage.setItem(PASSKEYS_STORAGE_KEY, JSON.stringify(kept));
  log('Saved local passkey', { credentialId: credentialId.slice(0, 12), rpId, count: existing.length + 1 });
}

export function hasLocalPasskeyForSite(): boolean {
  return getLocalPasskeyIds().length > 0;
}

const PLATFORM_SELECTION = {
  authenticatorAttachment: 'platform' as const,
  residentKey: 'preferred' as const,
  userVerification: 'required' as const,
};

function parseCreationOptions(options: Record<string, unknown>): CredentialCreationOptions {
  const publicKey = options as unknown as PublicKeyCredentialCreationOptions & {
    challenge: string;
    user: { id: string };
    excludeCredentials?: Array<{ id: string }>;
  };
  return {
    publicKey: {
      ...publicKey,
      challenge: base64urlToBuffer(publicKey.challenge as unknown as string),
      user: {
        ...publicKey.user,
        id: base64urlToBuffer(publicKey.user.id as unknown as string),
      },
      excludeCredentials: publicKey.excludeCredentials?.map((cred) => ({
        ...cred,
        id: base64urlToBuffer(cred.id as unknown as string),
      })),
      authenticatorSelection: {
        ...PLATFORM_SELECTION,
        ...(publicKey.authenticatorSelection ?? {}),
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
    },
  };
}

function parseRequestOptions(options: Record<string, unknown>): CredentialRequestOptions {
  const publicKey = options as unknown as PublicKeyCredentialRequestOptions & {
    challenge: string;
    allowCredentials?: Array<{ id: string; transports?: AuthenticatorTransport[] }>;
  };
  return {
    publicKey: {
      ...publicKey,
      challenge: base64urlToBuffer(publicKey.challenge as unknown as string),
      allowCredentials: publicKey.allowCredentials?.map((cred) => ({
        ...cred,
        id: base64urlToBuffer(cred.id as unknown as string),
        transports: cred.transports ?? (['internal'] as AuthenticatorTransport[]),
      })),
      userVerification: 'required',
    },
  };
}

export function mapDomException(error: unknown): BiometricAuthError {
  if (error instanceof BiometricAuthError) return error;

  if (error instanceof DOMException) {
    logError('DOMException during biometric prompt', { name: error.name, message: error.message });
    switch (error.name) {
      case 'NotAllowedError':
        return new BiometricAuthError('Authentication cancelled or permission denied.', 'cancelled');
      case 'SecurityError':
        return new BiometricAuthError('Biometric authentication blocked by browser security settings.', 'security_error');
      case 'InvalidStateError':
        return new BiometricAuthError('Biometrics are not set up on this device.', 'not_enrolled');
      case 'AbortError':
        return new BiometricAuthError('Authentication timed out. Please try again.', 'timeout');
      case 'NotSupportedError':
        return new BiometricAuthError('This device does not support the requested biometric method.', 'not_supported');
      default:
        if (error.message.toLowerCase().includes('passkey')) {
          return new BiometricAuthError('Biometric sign-in is not set up on this device.', 'no_passkey');
        }
        return new BiometricAuthError(error.message || 'Biometric authentication failed.', error.name.toLowerCase());
    }
  }

  if (error instanceof Error) {
    logError('Biometric error', error);
    return new BiometricAuthError(error.message, 'unknown');
  }

  return new BiometricAuthError('Biometric authentication failed.', 'unknown');
}

export async function createBiometricCredential(
  options: Record<string, unknown>,
): Promise<PublicKeyCredentialJSON> {
  log('Prompting biometric registration');
  try {
    const parsed = parseCreationOptions(options);
    const credential = (await navigator.credentials.create(parsed)) as PublicKeyCredential | null;
    if (!credential) {
      throw new BiometricAuthError('No credential returned from device.', 'empty_credential');
    }
    return credentialToJson(credential);
  } catch (error) {
    throw mapDomException(error);
  }
}

export async function getBiometricAssertion(
  options: Record<string, unknown>,
): Promise<PublicKeyCredentialJSON> {
  log('Prompting biometric login');
  try {
    const parsed = parseRequestOptions(options);
    const credential = (await navigator.credentials.get(parsed)) as PublicKeyCredential | null;
    if (!credential) {
      throw new BiometricAuthError('No credential returned from device.', 'empty_credential');
    }
    return credentialToJson(credential);
  } catch (error) {
    throw mapDomException(error);
  }
}

export const BIOMETRIC_REGISTERED_KEY = 'shieldai_biometric_registered';

export function markBiometricRegisteredLocally(enabled: boolean, credentialId?: string) {
  if (enabled) {
    localStorage.setItem(BIOMETRIC_REGISTERED_KEY, '1');
    if (credentialId) saveLocalPasskey(credentialId);
  } else {
    localStorage.removeItem(BIOMETRIC_REGISTERED_KEY);
  }
}

export function hasLocalBiometricRegistrationHint(): boolean {
  return hasLocalPasskeyForSite() || localStorage.getItem(BIOMETRIC_REGISTERED_KEY) === '1';
}

export function clearLocalPasskeyHints() {
  localStorage.removeItem(PASSKEYS_STORAGE_KEY);
  localStorage.removeItem(BIOMETRIC_REGISTERED_KEY);
}
