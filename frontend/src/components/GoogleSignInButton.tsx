import { Loader2 } from 'lucide-react';
import { useState } from 'react';
import { startGoogleOAuth } from '../lib/googleRedirect';

type GoogleSignInButtonProps = {
  intent: 'login' | 'signup' | 'link';
  disabled?: boolean;
  onError?: (message: string) => void;
};

function GoogleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#EA4335" d="M12 10.2v3.6h5.1c-.2 1.2-.9 2.3-1.9 3l3.1 2.4c1.8-1.7 2.9-4.1 2.9-7 0-.7-.1-1.3-.2-1.9H12z" />
      <path fill="#34A853" d="M6.6 14.3l-.9.7-2.7 2.1C4.6 20.1 8 22 12 22c2.7 0 5-.9 6.7-2.4l-3.1-2.4c-.9.6-2 .9-3.6.9-2.8 0-5.1-1.9-5.9-4.4z" />
      <path fill="#4A90E2" d="M3 7.1C2.4 8.3 2 9.6 2 11s.4 2.7 1 3.9c0 .1 3.6-2.8 3.6-2.8-.2-.6-.3-1.2-.3-1.9s.1-1.3.3-1.9L3 7.1z" />
      <path fill="#FBBC05" d="M12 5.9c1.5 0 2.8.5 3.9 1.5l2.9-2.9C16.9 2.7 14.7 2 12 2 8 2 4.6 3.9 3 7.1l3.6 2.8C7 7.8 9.2 5.9 12 5.9z" />
    </svg>
  );
}

export function GoogleSignInButton({ intent, disabled, onError }: GoogleSignInButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      await startGoogleOAuth(intent);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Could not start Google sign-in';
      onError?.(msg);
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      aria-label="Continue with Google"
      className="flex w-full items-center justify-center gap-3 rounded-xl border border-white/[0.08] bg-surface-input py-3.5 text-sm font-medium text-white transition hover:bg-white/[0.04] disabled:opacity-50"
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleLogo className="h-5 w-5 shrink-0" />}
      <span>{loading ? 'Redirecting to Google…' : 'Continue with Google'}</span>
    </button>
  );
}
