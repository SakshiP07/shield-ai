import { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthShell } from '../components/auth/AuthShell';
import { PhoneOtpAuth } from '../components/auth/PhoneOtpAuth';
import { GoogleSignInButton } from '../components/GoogleSignInButton';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/ToastContext';
import { api, type AuthConfig } from '../lib/api';

const DEFAULT_CONFIG: AuthConfig = {
  google_enabled: false,
  google_redirect_ready: false,
  google_redirect_uri: '',
  sms_enabled: false,
  otp_delivery: 'console',
};

export function SignupPage() {
  const { user, loading: authLoading, sendOtp, verifyOtp } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState<AuthConfig | null>(null);

  useEffect(() => {
    api.authConfig().then(setConfig).catch(() => setConfig(DEFAULT_CONFIG));
  }, []);

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface-base">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (user) {
    return <Navigate to={user.profile_completed ? '/app' : '/setup'} replace />;
  }

  const afterAuth = (needsProfile: boolean) => {
    showToast('Account created successfully', 'success');
    navigate(needsProfile ? '/setup' : '/app');
  };

  return (
    <AuthShell
      title="Create your account"
      footer={{ text: 'Already have an account?', linkText: 'Sign in', linkTo: '/login' }}
    >
      <PhoneOtpAuth
        loading={loading}
        error={error}
        onError={setError}
        onLoading={setLoading}
        sendOtp={sendOtp}
        verifyOtp={(phone, otp) => verifyOtp(phone, otp, 'signup')}
        onSuccess={afterAuth}
        sendLabel="Send verification code"
        verifyLabel="Create account"
      />

      {config?.google_enabled && (
        <>
          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/[0.08]" />
            <span className="text-xs text-slate-500">or</span>
            <div className="h-px flex-1 bg-white/[0.08]" />
          </div>
          <GoogleSignInButton
            intent="signup"
            disabled={loading}
            onError={(message) => setError(message ?? 'Google sign-in failed')}
          />
        </>
      )}

      {config && !config.sms_enabled && (
        <p className="mt-4 text-center text-xs text-slate-500">
          SMS delivery is in console mode — check the backend logs for your OTP when testing.
        </p>
      )}
    </AuthShell>
  );
}
