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

export function LoginPage() {
  const { user, loading: authLoading, loginPassword } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');

  const showGoogle = Boolean(config?.google_enabled ?? isSupabaseConfigured());

  useEffect(() => {
    setPhone('');
    setPassword('');
    setError('');
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

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { needsProfile } = await loginPassword(phone, password);
      showToast('Welcome back', 'success');
      navigate(needsProfile ? '/setup' : '/app', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Welcome back"
      footer={{ text: "Don't have an account?", linkText: 'Sign up', linkTo: '/signup' }}
    >
      <AuthFormStack>
        {showGoogle && (
          <AuthGoogleBlock
            intent="login"
            disabled={loading}
            onError={(message) => setError(message ?? 'Google sign-in failed')}
          />
        )}

        <form onSubmit={handleLogin} className="flex flex-col gap-3" autoComplete="on">
          <AuthPhoneInput
            id="login-phone"
            value={phone}
            onChange={setPhone}
            required
            disabled={loading}
          />

          <AuthInput
            id="login-password"
            name="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />

          <AuthError message={error} />

          <AuthSubmitButton loading={loading} className="mt-1">
            Sign in
          </AuthSubmitButton>
        </form>
      </AuthFormStack>
    </AuthShell>
  );
}
