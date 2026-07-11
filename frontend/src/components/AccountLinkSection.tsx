import { useState, type FormEvent } from 'react';
import { Link2, Phone, Mail } from 'lucide-react';
import { GoogleSignInButton } from './GoogleSignInButton';
import { useAuth } from '../hooks/AuthContext';
import { useToast } from '../hooks/ToastContext';
import { ApiError, type User } from '../lib/api';

type AccountLinkSectionProps = {
  user: User;
};

export function AccountLinkSection({ user }: AccountLinkSectionProps) {
  const { linkPhone } = useAuth();
  const { showToast } = useToast();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'idle' | 'otp'>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const canLinkPhone = !user.phone;
  const canLinkGoogle = user.auth_provider === 'phone';

  if (!canLinkPhone && !canLinkGoogle) {
    return (
      <div className="mb-5">
        <p className="mb-2 text-[10px] font-semibold tracking-widest text-slate-500">LINKED ACCOUNTS</p>
        <div className="rounded-2xl border border-white/[0.06] bg-surface-card p-4">
          <div className="flex items-center gap-2 text-[15px] text-blue-400">
            <Link2 className="h-4 w-4" />
            Phone and Google are linked to this account
          </div>
          {user.phone && (
            <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
              <Phone className="h-3.5 w-3.5" /> {user.phone}
            </p>
          )}
          {user.email && (
            <p className="mt-1 flex items-center gap-2 text-xs text-slate-400">
              <Mail className="h-3.5 w-3.5" /> {user.email}
            </p>
          )}
        </div>
      </div>
    );
  }

  const handleSendLinkOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await linkPhone.sendOtp(phone);
      setStep('otp');
      if (result.dev_otp) setOtp(result.dev_otp);
      showToast('Verification code sent', 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyLinkOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await linkPhone.verify(phone, otp);
      showToast('Phone number linked to your account', 'success');
      setStep('idle');
      setPhone('');
      setOtp('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not link phone');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mb-5">
      <p className="mb-2 text-[10px] font-semibold tracking-widest text-slate-500">LINK ACCOUNTS</p>
      <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-surface-card p-4">
        <p className="text-xs text-slate-400">
          Connect additional sign-in methods to your account. Verification is required before linking.
        </p>

        {canLinkPhone && (
          <div className="border-t border-white/[0.04] pt-3">
            <p className="mb-2 text-sm font-medium text-white">Add phone number</p>
            {step === 'idle' ? (
              <form onSubmit={handleSendLinkOtp} className="space-y-2">
                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  className="w-full rounded-lg border border-white/[0.08] bg-surface-input px-3 py-2.5 text-sm text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || phone.length < 10}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {loading ? 'Sending...' : 'Verify & link phone'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyLinkOtp} className="space-y-2">
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="6-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full rounded-lg border border-white/[0.08] bg-surface-input px-3 py-2.5 text-sm text-white outline-none"
                />
                <button
                  type="submit"
                  disabled={loading || otp.length < 4}
                  className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {loading ? 'Linking...' : 'Confirm OTP & link'}
                </button>
                <button type="button" onClick={() => setStep('idle')} className="text-xs text-slate-500 hover:text-white">
                  Cancel
                </button>
              </form>
            )}
          </div>
        )}

        {canLinkGoogle && (
          <div className="border-t border-white/[0.04] pt-3">
            <p className="mb-2 text-sm font-medium text-white">Link Google account</p>
            <GoogleSignInButton
              intent="link"
              disabled={loading}
              onError={(message) => setError(message ?? 'Google linking failed')}
            />
          </div>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}
      </div>
    </div>
  );
}
