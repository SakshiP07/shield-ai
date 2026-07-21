const API_BASE = '/api/v1';

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export function getToken(): string | null {
  return localStorage.getItem('shieldai_token');
}

export function setToken(token: string) {
  localStorage.setItem('shieldai_token', token);
}

export function clearToken() {
  localStorage.removeItem('shieldai_token');
  localStorage.removeItem('shieldpay_session'); // old mock auth key
}

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

export function setUnauthorizedHandler(handler: UnauthorizedHandler | null) {
  unauthorizedHandler = handler;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  if (res.status === 401 && token && !path.endsWith('/auth/logout')) {
    clearToken();
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
  return res.json() as Promise<T>;
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
  ai_sensitivity: string;
  privacy_level: string;
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

function getOrCreateDeviceId(): string {
  const key = 'shieldai_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

export const api = {
  authConfig: () => request<AuthConfig>('/auth/config'),

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

  linkPhoneVerify: (phone: string, otp: string) =>
    request<User>('/auth/link/phone/verify', {
      method: 'POST',
      body: JSON.stringify({ phone, otp }),
    }),

  linkGoogle: (access_token: string) =>
    request<User>('/auth/link/google', {
      method: 'POST',
      body: JSON.stringify({ access_token }),
    }),

  updateProfile: (data: { name?: string; avatar_url?: string }) =>
    request<User>('/auth/profile', { method: 'PATCH', body: JSON.stringify(data) }),

  uploadAvatar: async (file: File) => {
    const token = getToken();
    const form = new FormData();
    form.append('file', file);
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${API_BASE}/auth/avatar`, { method: 'POST', headers, body: form });
    if (res.status === 401 && token) {
      clearToken();
      unauthorizedHandler?.();
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const detail = body.detail;
      const message =
        typeof detail === 'string' ? detail : Array.isArray(detail) ? detail.map((d: { msg?: string }) => d.msg).join(', ') : res.statusText;
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
    const token = getToken();
    if (!token) return null;
    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (res.status === 401) {
      clearToken();
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

  analyzeScan: (scan_type: string, content: string, amount?: number, sender?: string) =>
    request<ScanResult>('/scans/analyze', {
      method: 'POST',
      body: JSON.stringify({
        scan_type,
        content,
        amount,
        sender,
        device_info: {
          device_id: getOrCreateDeviceId(),
          userAgent: navigator.userAgent,
          platform: navigator.platform,
        },
      }),
    }),

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

  markAllAlertsRead: () => request<{ ok: boolean; updated?: number }>('/alerts/mark-all-read', { method: 'POST' }),

  smsScans: () => request<SmsScanItem[]>('/sms/scans'),

  smsScanDetail: (id: string) => request<SmsScanDetail>(`/sms/scans/${id}`),

  blockedScans: () => request<ActivityItem[]>('/dashboard/blocked-scans'),
};
