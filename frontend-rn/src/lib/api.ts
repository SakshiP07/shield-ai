import { NativeModules, Platform } from 'react-native';
import Constants from 'expo-constants';
import { getToken, setToken, clearToken, getDeviceId, getOverrideApiBase, setOverrideApiBase } from './storage';

// Re-export storage helpers so consumers can do `import { setToken } from './api'`
export { getToken, setToken, clearToken };

/** Most reliable on device: Metro packager host from the JS bundle URL. */
function hostFromScriptURL(): string | null {
  const scriptURL: string | undefined = NativeModules.SourceCode?.scriptURL;
  if (!scriptURL || typeof scriptURL !== 'string') return null;
  const match = scriptURL.match(/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/([^/:]+)(?::\d+)?/);
  const host = match?.[1];
  if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== '10.0.2.2') {
    return host;
  }
  return null;
}

/** Metro / Expo packager host (LAN IP on physical devices). */
function expoDevHost(): string | null {
  const fromScript = hostFromScriptURL();
  if (fromScript) return fromScript;

  const candidates = [
    Constants.expoConfig?.hostUri,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants as any).expoGoConfig?.debuggerHost,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants as any).manifest2?.extra?.expoClient?.hostUri,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Constants as any).manifest?.debuggerHost,
    Constants.linkingUri,
  ];
  for (const raw of candidates) {
    if (!raw || typeof raw !== 'string') continue;
    let cleaned = raw;
    try {
      cleaned = decodeURIComponent(cleaned);
    } catch {
      // keep raw
    }
    cleaned = cleaned
      .replace(/^exp:\/\//, '')
      .replace(/^exps:\/\//, '')
      .replace(/^https?:\/\//, '')
      .replace(/^shieldai:\/\/expo-development-client\/\?url=/, '');
    // url=http://10.x.x.x:8081
    const urlMatch = cleaned.match(/(?:^|[?&]url=)https?:\/\/([^/:]+)/);
    if (urlMatch?.[1] && urlMatch[1] !== 'localhost' && urlMatch[1] !== '127.0.0.1') {
      return urlMatch[1];
    }
    const host = cleaned.split('/')[0]?.split('?')[0]?.split(':')[0];
    if (host && host !== 'localhost' && host !== '127.0.0.1' && host !== '10.0.2.2') {
      return host;
    }
  }
  return null;
}

/**
 * Resolve FastAPI base URL.
 * Physical device: derive LAN IP from Metro (same Wi‑Fi as the phone).
 * Emulator: 10.0.2.2. Override with EXPO_PUBLIC_API_BASE when needed.
 */
function resolveApiBase(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE?.trim();
  const host = expoDevHost();

  if (fromEnv) {
    const isEmulatorLoopback = fromEnv.includes('10.0.2.2') || fromEnv.includes('127.0.0.1');
    // Prefer auto LAN host on a real device even if .env still has emulator default.
    if (!(isEmulatorLoopback && host)) {
      return fromEnv.replace(/\/$/, '');
    }
  }
  if (host) return `http://${host}:8000/api/v1`;
  if (Platform.OS === 'android') return 'http://10.0.2.2:8000/api/v1';
  return 'http://127.0.0.1:8000/api/v1';
}

let cachedApiBase = resolveApiBase();
let overrideLoaded = false;

/** Current API base (may update after AsyncStorage override loads). */
export function getApiBase(): string {
  return cachedApiBase;
}

export const API_BASE = cachedApiBase;

/** Call once at app start to apply a stored API override (optional). */
export async function initApiBase(): Promise<string> {
  if (!overrideLoaded) {
    overrideLoaded = true;
    const resolved = resolveApiBase();
    try {
      const override = (await getOverrideApiBase())?.trim().replace(/\/$/, '') || '';
      const isLoopback =
        !override ||
        override.includes('10.0.2.2') ||
        override.includes('127.0.0.1') ||
        override.includes('localhost');
      if (override && !isLoopback) {
        cachedApiBase = override;
      } else {
        // Clear stale emulator overrides so Google sign-in can reach the Mac LAN API.
        if (override && isLoopback) {
          await setOverrideApiBase('');
        }
        cachedApiBase = resolved;
      }
    } catch {
      cachedApiBase = resolved;
    }
  }
  if (__DEV__) {
    console.log('[API] base=', cachedApiBase, 'env=', process.env.EXPO_PUBLIC_API_BASE || '(unset)');
  }
  return cachedApiBase;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (!overrideLoaded) {
    await initApiBase();
  }
  const base = cachedApiBase;
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const controller = new AbortController();
  // Keep non-ingest calls snappy so profile/alerts stay usable during SMS sync.
  const timeoutMs = path.includes('/sms/ingest') ? 45000 : 12000;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers,
    signal: options.signal ?? controller.signal,
  })
    .catch((err) => {
      const reason = err instanceof Error ? err.message : String(err);
      const timedOut = err instanceof Error && err.name === 'AbortError';
      throw new ApiError(
        timedOut
          ? 'Server timed out — pull to refresh'
          : `Cannot reach API at ${base} (${reason}). Check USB reverse or Wi‑Fi.`,
        0,
      );
    })
    .finally(() => clearTimeout(timer));
  if (res.status === 401 && token && !path.endsWith('/auth/logout')) {
    await clearToken();
    unauthorizedHandler?.();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const detail = body.detail;
    const message = Array.isArray(detail)
      ? detail.map((d: { msg?: string }) => d.msg).join(', ')
      : typeof detail === 'string'
        ? detail
        : res.statusText;
    throw new ApiError(message, res.status);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  const text = await res.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export interface User {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  google_id: string | null;
  avatar_url: string | null;
  plan: string;
  profile_completed: boolean;
  auth_provider: string;
  phone_verified?: boolean;
  email_verified?: boolean;
}

export interface AuthResponse {
  success?: boolean;
  isNewUser?: boolean;
  access_token: string;
  token?: string;
  token_type: string;
  user: User;
  needs_profile: boolean;
}

export interface OTPResponse {
  message: string;
  expires_in: number;
  sms_sent: boolean;
  delivery_channel: string;
  dev_otp?: string | null;
}

export interface AuthConfig {
  google_enabled: boolean;
  google_redirect_ready: boolean;
  google_redirect_uri: string;
  sms_enabled: boolean;
  otp_delivery: string;
}

export interface DashboardStats {
  security_score: number;
  threats_blocked: number;
  items_scanned: number;
  safe_items: number;
  risk_level: string;
  last_scan_at: string | null;
  blocked_count: number;
  warning_count: number;
  safe_count: number;
  blocked_scans_count: number;
  score_breakdown: string[];
}

export interface ActivityItem {
  id: string;
  title: string;
  time: string;
  amount: string | null;
  sub: string | null;
  badge: string;
}

export interface ScamAlert {
  id: string;
  title: string;
  time: string;
  badge: string;
}

export interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: string;
  alert_type: string;
  is_read: boolean;
  created_at: string;
  transaction_id?: string | null;
  source?: string;
  fraud_score?: number;
}

export interface AlertDetail extends AlertItem {
  risk_score: number;
  risk_level: string;
  decision: string;
  full_message: string;
  recommendation: string;
  flagged_reasons: string[];
  behaviour: Record<string, unknown> | null;
  rules: Record<string, unknown> | null;
  ml_prediction: Record<string, unknown> | null;
  pipeline: Record<string, unknown> | null;
  scan_reference: string | null;
}

export interface UserPreferences {
  notifications_enabled: boolean;
  push_alerts: boolean;
  email_alerts: boolean;
  sms_alerts: boolean;
  android_sms_connected: boolean;
  ai_sensitivity: string;
  privacy_level: string;
}

export interface AndroidSmsConnection {
  connected: boolean;
  platform: string;
  ios_supported: boolean;
  total_messages?: number;
  last_sync_at?: string | null;
}

export interface AndroidSmsInboxItem {
  id: string;
  android_sms_id: string;
  address: string;
  phone_number: string;
  sender: string;
  body: string;
  received_at: string;
  timestamp: string;
  is_read: boolean;
  unread: boolean;
  is_otp: boolean;
  otp_code: string | null;
  sms_type?: string | null;
  transaction_id: string | null;
  fraud_score: number | null;
  risk_score: number | null;
  risk_level: string | null;
  confidence?: number | null;
  processing_time_ms?: number | null;
  decision: string | null;
  badge: string | null;
}

export interface AndroidSmsInboxResponse {
  items: AndroidSmsInboxItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  connected: boolean;
}

export interface SmsScanItem {
  id: string;
  sender: string;
  text: string;
  time: string;
  badge: string;
  decision: string;
  status: string;
  fraud_score: number;
  risk_score: number;
  risk_level: string;
}

export interface SmsScanDetail extends SmsScanItem {
  alert_id: string | null;
  flagged_reasons: string[];
  behaviour: Record<string, unknown> | null;
  rules: Record<string, unknown> | null;
  ml_prediction: Record<string, unknown> | null;
  pipeline: Record<string, unknown> | null;
}

export interface ScanResult {
  status: string;
  decision: string;
  fraud_score: number;
  risk_score: number;
  risk_level: string;
  title: string;
  message: string;
  requires_otp: boolean;
  transaction_id: string | null;
  alert_id: string | null;
}

export interface LedgerEntry {
  id: string;
  transaction_id: string;
  phone_number: string | null;
  upi_id: string | null;
  created_at: string;
  fraud_score: number;
  risk_level: string;
  status: string;
  reason: string;
  model_version: string;
  processing_time_ms: number;
  device_id: string | null;
  scan_source: string;
}

export interface LedgerListResponse {
  items: LedgerEntry[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export const api = {
  authConfig: () => request<AuthConfig>('/auth/config'),

  signupStart: (data: {
    name: string;
    email: string;
    phone: string;
    password: string;
    confirm_password: string;
  }) =>
    request<OTPResponse>('/auth/signup/start', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  signupVerify: (phone: string, otp: string) =>
    request<AuthResponse>('/auth/signup/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    }),

  loginPassword: (phone: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ phone, password }),
    }),

  sendOtp: (phone: string) =>
    request<OTPResponse>('/auth/otp/send', { method: 'POST', body: JSON.stringify({ phone }) }),

  verifyOtp: (phone: string, otp: string, intent: 'login' | 'signup' | 'continue' = 'continue') =>
    request<AuthResponse>('/auth/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, intent }),
    }),

  googleLogin: (access_token: string) =>
    request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ access_token, intent: 'continue' }),
    }),

  linkPhoneSendOtp: (phone: string) =>
    request<OTPResponse>('/auth/link/phone/send-otp', {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  linkPhoneVerify: (
    phone: string,
    otp: string,
    passwords?: { password: string; confirm_password: string },
  ) =>
    request<User>('/auth/link/phone/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp, ...passwords }),
    }),

  linkGoogle: (access_token: string) =>
    request<User>('/auth/link/google', {
      method: 'POST',
      body: JSON.stringify({ access_token }),
    }),

  updateProfile: (data: { name?: string; avatar_url?: string; plan?: string }) =>
    request<User>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  /**
   * Upload avatar — in RN the `file` param is `{ uri, name, type }` from expo-image-picker.
   */
  uploadAvatar: async (file: { uri: string; name: string; type: string }) => {
    const token = await getToken();
    const form = new FormData();
    // RN's FormData accepts { uri, name, type } objects directly
    form.append('file', file as unknown as Blob);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${getApiBase()}/auth/avatar`, { method: 'POST', headers, body: form });
    if (res.status === 401 && token) {
      await clearToken();
      unauthorizedHandler?.();
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body.detail;
      const message =
        typeof detail === 'string'
          ? detail
          : Array.isArray(detail)
            ? detail.map((d: { msg?: string }) => d.msg).join(', ')
            : res.statusText;
      throw new ApiError(message, res.status);
    }
    return res.json() as Promise<User>;
  },

  getPreferences: () => request<UserPreferences>('/auth/preferences'),

  updatePreferences: (data: Partial<UserPreferences>) =>
    request<UserPreferences>('/auth/preferences', { method: 'PATCH', body: JSON.stringify(data) }),

  me: () => request<User>('/auth/me'),

  /** Validate stored session without throwing on 401 (bootstrap / expired token). */
  restoreSession: async (): Promise<User | null> => {
    const token = await getToken();
    if (!token) return null;
    const res = await fetch(`${getApiBase()}/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 401) {
      await clearToken();
      unauthorizedHandler?.();
      return null;
    }
    if (!res.ok) return null;
    return res.json() as Promise<User>;
  },

  logout: () => request<{ ok: boolean }>('/auth/logout', { method: 'POST' }),

  dashboardStats: () => request<DashboardStats>('/dashboard/stats'),

  dashboardActivity: () => request<ActivityItem[]>('/dashboard/activity'),

  scamAlerts: () => request<ScamAlert[]>('/dashboard/scam-alerts'),

  analyzeScan: async (scan_type: string, content: string, amount?: number, sender?: string) => {
    const deviceId = await getDeviceId();
    return request<ScanResult>('/scans/analyze', {
      method: 'POST',
      body: JSON.stringify({
        scan_type,
        content,
        amount,
        sender,
        device_info: {
          device_id: deviceId,
          platform: Platform.OS,
          os_version: Platform.Version,
        },
      }),
    });
  },

  ledger: (params: {
    phone?: string;
    upi?: string;
    status?: 'succeeded' | 'failed' | 'pending';
    risk_level?: 'high' | 'medium' | 'low';
    page?: number;
    page_size?: number;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.phone) q.set('phone', params.phone);
    if (params.upi) q.set('upi', params.upi);
    if (params.status) q.set('status', params.status);
    if (params.risk_level) q.set('risk_level', params.risk_level);
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    const qs = q.toString();
    return request<LedgerListResponse>(`/ledger${qs ? `?${qs}` : ''}`);
  },

  alerts: () => request<AlertItem[]>('/alerts'),

  alertDetail: (id: string) => request<AlertDetail>(`/alerts/${id}`),

  alertsUnreadCount: () => request<{ count: number }>('/alerts/unread-count'),

  markAlertRead: (alertId: string) =>
    request<{ ok: boolean; is_read: boolean }>(`/alerts/${alertId}/read`, { method: 'PATCH' }),

  markAllAlertsRead: () =>
    request<{ ok: boolean; updated?: number }>('/alerts/mark-all-read', { method: 'POST' }),

  smsScans: () => request<SmsScanItem[]>('/sms/scans'),

  smsScanDetail: (id: string) => request<SmsScanDetail>(`/sms/scans/${id}`),

  smsConnection: () => request<AndroidSmsConnection>('/sms/connection'),

  smsConnect: (body?: { device_info?: Record<string, unknown> }) =>
    request<AndroidSmsConnection>('/sms/connect', {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),

  smsDisconnect: (body?: { device_info?: Record<string, unknown> }) =>
    request<AndroidSmsConnection>('/sms/disconnect', {
      method: 'POST',
      body: JSON.stringify(body || {}),
    }),

  smsClientAudit: (data: {
    event_type: string;
    description?: string;
    metadata?: Record<string, unknown>;
    sms_id?: string;
    status?: string;
  }) =>
    request<void>('/sms/client-audit', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  smsIngest: (data: {
    messages: Array<{
      android_sms_id: string;
      address: string;
      body: string;
      sender?: string;
      received_at: string;
      is_read?: boolean;
      thread_id?: string | null;
      is_otp?: boolean;
      otp_code?: string | null;
      folder?: string;
      sms_type?: string;
    }>;
    device_info?: Record<string, unknown>;
    auto_scan?: boolean;
  }) =>
    request<{ created: number; updated: number; scanned: number }>('/sms/ingest', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  smsInbox: (params: {
    search?: string;
    page?: number;
    page_size?: number;
    unread_only?: boolean;
    otp_only?: boolean;
    sms_type?: string;
    badge?: string;
  } = {}) => {
    const q = new URLSearchParams();
    if (params.search) q.set('search', params.search);
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    if (params.unread_only != null) q.set('unread_only', String(params.unread_only));
    if (params.otp_only != null) q.set('otp_only', String(params.otp_only));
    if (params.sms_type) q.set('sms_type', params.sms_type);
    if (params.badge) q.set('badge', params.badge);
    const qs = q.toString();
    return request<AndroidSmsInboxResponse>(`/sms/inbox${qs ? `?${qs}` : ''}`);
  },

  blockedScans: () => request<ActivityItem[]>('/dashboard/blocked-scans'),
};
