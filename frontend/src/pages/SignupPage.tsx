import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell';
import {
  AuthError,
  AuthFormStack,
  AuthGoogleBlock,
  AuthInput,
  AuthPhoneInput,
  AuthSubmitButton,
} from '../components/auth/AuthFields';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/ToastContext';
import { api, ApiError, type AuthConfig } from '../lib/api';
import { isSupabaseConfigured } from '../lib/supabase';

const DEFAULT_CONFIG: AuthConfig = {
  google_enabled: isSupabaseConfigured(),
  google_redirect_ready: isSupabaseConfigured(),
  google_redirect_uri: '',
  sms_enabled: false,
  otp_delivery: 'console',
};

const EMPTY_FORM = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirm_password: '',
};

export function SignupPage() {
  const { user, loading: authLoading, signupStart, signupVerify } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [step, setStep] = useState<'form' | 'otp'>('form');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);

  const showGoogle = Boolean(config?.google_enabled ?? isSupabaseConfigured());

  useEffect(() => {
    setForm(EMPTY_FORM);
    setOtp('');
    setDevOtp(null);
    setError('');
    setStep('form');
    api.authConfig().then(setConfig).catch(() => setConfig(DEFAULT_CONFIG));
  }, []);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-shield">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={user.profile_completed ? '/app' : '/setup'} replace />;
  }

  const onChange = (key: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleStart = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await signupStart(form);
      setDevOtp(res.dev_otp ?? null);
      setOtp('');
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { needsProfile } = await signupVerify(form.phone, otp);
      showToast('Account created successfully', 'success');
      navigate(needsProfile ? '/setup' : '/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Create your account"
      footer={{ text: 'Already have an account?', linkText: 'Sign in', linkTo: '/login' }}
    >
      <AuthFormStack>
        {step === 'form' && showGoogle && (
          <AuthGoogleBlock
            intent="signup"
            disabled={loading}
            onError={(message) => setError(message ?? 'Google sign-in failed')}
          />
        )}

        {step === 'form' ? (
          <form onSubmit={handleStart} className="flex flex-col gap-3" autoComplete="on">
            <AuthPhoneInput
              id="signup-phone"
              value={form.phone}
              onChange={(digits) => onChange('phone', digits)}
              required
              disabled={loading}
            />
            <AuthInput
              id="signup-name"
              name="name"
              label="Full name"
              type="text"
              autoComplete="name"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => onChange('name', e.target.value)}
              required
              minLength={2}
              disabled={loading}
            />
            <AuthInput
              id="signup-email"
              name="email"
              label="Email address"
              type="email"
              autoComplete="email"
              placeholder="Email address"
              value={form.email}
              onChange={(e) => onChange('email', e.target.value)}
              required
              disabled={loading}
            />
            <AuthInput
              id="signup-password"
              name="password"
              label="Password"
              type="password"
              autoComplete="new-password"
              placeholder="Password (min 8 characters)"
              value={form.password}
              onChange={(e) => onChange('password', e.target.value)}
              required
              minLength={8}
              disabled={loading}
            />
            <AuthInput
              id="signup-confirm-password"
              name="confirm_password"
              label="Confirm password"
              type="password"
              autoComplete="new-password"
              placeholder="Confirm password"
              value={form.confirm_password}
              onChange={(e) => onChange('confirm_password', e.target.value)}
              required
              minLength={8}
              disabled={loading}
            />

            <AuthError message={error} />

            <AuthSubmitButton loading={loading} className="mt-1">
              Continue
            </AuthSubmitButton>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="flex flex-col gap-3" autoComplete="off">
            <p className="text-sm text-slate-400">
              Enter the OTP sent to <span className="font-medium text-white">+91 {form.phone}</span>
            </p>
            <AuthInput
              id="signup-otp"
              name="otp"
              label="Verification code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              required
              disabled={loading}
            />
            {devOtp && <p className="text-xs text-slate-500">Dev OTP: {devOtp}</p>}
            <AuthError message={error} />
            <AuthSubmitButton loading={loading} className="mt-1">
              Verify & create account
            </AuthSubmitButton>
            <button
              type="button"
              className="h-12 w-full text-center text-sm text-slate-500 transition hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
              onClick={() => {
                setStep('form');
                setError('');
                setOtp('');
                setDevOtp(null);
              }}
            >
              Back to form
            </button>
          </form>
        )}

        {config && !config.sms_enabled && step === 'otp' && (
          <p className="text-center text-xs text-slate-500">
            SMS is in console mode — check backend logs for the OTP.
          </p>
        )}
      </AuthFormStack>
    </AuthShell>
  );
}
