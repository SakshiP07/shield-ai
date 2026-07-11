import { useState, type FormEvent } from 'react';
import { ApiError } from '../../lib/api';

type PhoneOtpAuthProps = {
  loading: boolean;
  error: string;
  onError: (message: string) => void;
  onLoading: (value: boolean) => void;
  sendOtp: (phone: string) => Promise<{ dev_otp?: string | null }>;
  verifyOtp: (phone: string, otp: string) => Promise<boolean>;
  onSuccess: (needsProfile: boolean) => void;
  sendLabel?: string;
  verifyLabel?: string;
};

export function PhoneOtpAuth({
  loading,
  error,
  onError,
  onLoading,
  sendOtp,
  verifyOtp,
  onSuccess,
  sendLabel = 'Continue',
  verifyLabel = 'Verify & continue',
}: PhoneOtpAuthProps) {
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');

  const handleSendOtp = async (e: FormEvent) => {
    e.preventDefault();
    onError('');
    onLoading(true);
    try {
      const result = await sendOtp(phone);
      setStep('otp');
      setOtp(result.dev_otp ?? '');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not send verification code');
    } finally {
      onLoading(false);
    }
  };

  const handleVerifyOtp = async (e: FormEvent) => {
    e.preventDefault();
    onError('');
    onLoading(true);
    try {
      const needsProfile = await verifyOtp(phone, otp);
      onSuccess(needsProfile);
    } catch (err) {
      onError(err instanceof ApiError ? err.message : 'Invalid verification code');
    } finally {
      onLoading(false);
    }
  };

  if (step === 'phone') {
    return (
      <form onSubmit={handleSendOtp} className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-white/[0.08] bg-surface-input">
          <div className="flex items-center">
            <div className="flex items-center gap-2 border-r border-white/[0.08] px-3 py-3.5">
              <span className="text-base">🇮🇳</span>
              <span className="text-sm font-medium text-white">+91</span>
            </div>
            <input
              type="tel"
              inputMode="numeric"
              placeholder="Mobile number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              className="flex-1 bg-transparent px-3 py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
            />
          </div>
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <button
          type="submit"
          disabled={loading || phone.length < 10}
          className="btn-primary disabled:opacity-50"
        >
          {loading ? 'Sending code...' : sendLabel}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={handleVerifyOtp} className="space-y-4">
      <input
        type="text"
        inputMode="numeric"
        placeholder="6-digit code"
        value={otp}
        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
        className="w-full rounded-xl border border-white/[0.08] bg-surface-input px-4 py-3.5 text-sm text-white outline-none placeholder:text-slate-600"
      />
      {error && <p className="text-sm text-rose-400">{error}</p>}
      <button
        type="submit"
        disabled={loading || otp.length < 6}
        className="btn-primary disabled:opacity-50"
      >
        {loading ? 'Verifying...' : verifyLabel}
      </button>
      <button
        type="button"
        onClick={() => {
          setStep('phone');
          onError('');
        }}
        className="w-full text-sm text-slate-400 hover:text-white"
      >
        Use a different number
      </button>
    </form>
  );
}
