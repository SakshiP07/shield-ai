import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import { useAuth, type User } from '../hooks/AuthContext';
import { ApiError } from '../lib/api';

type AccountLinkSectionProps = {
  user: User;
};

export function AccountLinkSection({ user }: AccountLinkSectionProps) {
  const { linkPhone } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const canLinkPhone = !user.phone;
  const canLinkGoogle = !user.google_id;

  if (!canLinkPhone && !canLinkGoogle) {
    return (
      <div className="mb-6 overflow-hidden rounded-3xl bg-surface-card px-5 py-4">
        <p className="text-[14px] text-slate-400">Phone and Google are linked to this account</p>
      </div>
    );
  }

  const sendOtp = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await linkPhone.sendOtp(phone);
      setOtpSent(true);
      setDevOtp(res.dev_otp ?? null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setLoading(true);
    setError('');
    try {
      await linkPhone.verify(phone, otp);
      setOtpSent(false);
      setOtp('');
      setDevOtp(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Failed to verify OTP');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-6">
      <p className="mb-2.5 text-[13px] font-semibold uppercase tracking-wider text-slate-500">Link accounts</p>
      <div className="space-y-4 overflow-hidden rounded-3xl bg-surface-card px-5 py-5">
        {error && <p className="text-sm text-rose-400">{error}</p>}

        {canLinkPhone && (
          <div>
            <p className="mb-2 text-sm font-medium text-white">Link phone number</p>
            {!otpSent ? (
              <div className="flex gap-2">
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit phone"
                  className="flex-1 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none"
                />
                <button
                  type="button"
                  disabled={loading}
                  onClick={sendOtp}
                  className="rounded-xl bg-blue-500/20 px-3 py-2.5 text-sm font-medium text-blue-400 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send OTP'}
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter OTP"
                  className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 text-sm text-white outline-none"
                />
                {devOtp && <p className="text-xs text-slate-500">Dev OTP: {devOtp}</p>}
                <button
                  type="button"
                  disabled={loading}
                  onClick={verifyOtp}
                  className="rounded-xl bg-blue-500/20 px-3 py-2.5 text-sm font-medium text-blue-400 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Verify & link'}
                </button>
              </div>
            )}
          </div>
        )}

        {canLinkGoogle && (
          <div>
            <p className="mb-2 text-sm font-medium text-white">Link Google account</p>
            <GoogleSignInButton
              intent="link"
              disabled={loading}
              onError={(message) => setError(message ?? 'Google linking failed')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
