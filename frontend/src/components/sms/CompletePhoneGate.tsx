import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { AuthPhoneInput } from '../auth/AuthFields';
import { MobileCard, MobilePage } from '../mobile/MobilePage';
import { useAuth } from '../../hooks/AuthContext';
import { ApiError } from '../../lib/api';

type CompletePhoneGateProps = {
  onCompleted: () => void;
};

/**
 * Shown on SMS Shield when the logged-in user has no phone (typical Google signup).
 * Links the number to the existing account via OTP — never creates a new user.
 */
export function CompletePhoneGate({ onCompleted }: CompletePhoneGateProps) {
  const { linkPhone } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleContinue = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (phone.replace(/\D/g, '').length < 10) {
      setError('Enter a valid 10-digit phone number');
      return;
    }
    setLoading(true);
    try {
      const res = await linkPhone.sendOtp(phone);
      setDevOtp(res.dev_otp ?? null);
      setOtp('');
      setStep('otp');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Could not send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (otp.length < 4) {
      setError('Enter the verification code');
      return;
    }
    setLoading(true);
    try {
      await linkPhone.verify(phone, otp);
      onCompleted();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <MobilePage>
      <div className="mb-6">
        <h2 className="text-[22px] font-bold tracking-tight text-white">Complete Your Profile</h2>
        <p className="mt-2 text-[15px] leading-relaxed text-slate-400">
          A verified phone number is required before using SMS Shield. We’ll save it to your existing account —
          no new signup.
        </p>
      </div>

      <MobileCard padding="md" className="space-y-4">
        {step === 'phone' ? (
          <form onSubmit={handleContinue} className="space-y-4">
            <AuthPhoneInput
              id="sms-complete-phone"
              value={phone}
              onChange={setPhone}
              required
              disabled={loading}
            />
            {error && (
              <p className="text-sm text-rose-400" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading || phone.length < 10} className="auth-btn-primary">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : 'Continue'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerify} className="space-y-4">
            <p className="text-sm text-slate-400">
              Enter the OTP sent to <span className="font-medium text-white">+91 {phone}</span>
            </p>
            <div>
              <label htmlFor="sms-complete-otp" className="sr-only">
                Verification code
              </label>
              <input
                id="sms-complete-otp"
                name="otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Enter OTP"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                disabled={loading}
                required
                className="auth-control auth-field"
              />
            </div>
            {devOtp && <p className="text-xs text-slate-500">Dev OTP: {devOtp}</p>}
            {error && (
              <p className="text-sm text-rose-400" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={loading || otp.length < 4} className="auth-btn-primary">
              {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : 'Verify & continue'}
            </button>
            <button
              type="button"
              disabled={loading}
              className="w-full text-center text-sm text-slate-500 transition hover:text-slate-300"
              onClick={() => {
                setStep('phone');
                setOtp('');
                setDevOtp(null);
                setError('');
              }}
            >
              Change phone number
            </button>
          </form>
        )}
      </MobileCard>
    </MobilePage>
  );
}
