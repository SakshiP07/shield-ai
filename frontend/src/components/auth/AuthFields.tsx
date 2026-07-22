import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { Loader2 } from 'lucide-react';
import { GoogleSignInButton } from '../GoogleSignInButton';

/** Shared layout width for Login + Signup forms */
export function AuthFormStack({ children }: { children: ReactNode }) {
  return <div className="flex w-full flex-col gap-4">{children}</div>;
}

export function AuthDivider() {
  return (
    <div className="flex items-center justify-center gap-3 py-0.5" role="separator" aria-hidden="true">
      <div className="h-px w-24 bg-white/[0.14] sm:w-28" />
      <span className="text-[11px] font-medium uppercase tracking-wider text-slate-500">or</span>
      <div className="h-px w-24 bg-white/[0.14] sm:w-28" />
    </div>
  );
}

export function AuthGoogleBlock({
  intent,
  disabled,
  onError,
}: {
  intent: 'login' | 'signup';
  disabled?: boolean;
  onError: (message: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3.5">
      <GoogleSignInButton intent={intent} disabled={disabled} onError={onError} />
      <AuthDivider />
    </div>
  );
}

export function AuthError({ message }: { message: string }) {
  if (!message) return null;
  return (
    <p className="text-sm text-rose-400" role="alert">
      {message}
    </p>
  );
}

type AuthInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
};

/**
 * Controlled dark auth input. Starts readOnly until focus so browsers
 * don't paint autofill on mount; password managers still work after focus.
 */
export const AuthInput = forwardRef<HTMLInputElement, AuthInputProps>(function AuthInput(
  { label, className = '', id, onFocus, ...props },
  ref,
) {
  const inputId = id ?? props.name ?? label.replace(/\s+/g, '-').toLowerCase();

  return (
    <div className="w-full">
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-label={label}
        {...props}
        readOnly
        onFocus={(e) => {
          e.currentTarget.removeAttribute('readonly');
          onFocus?.(e);
        }}
        className={`auth-control auth-field ${className}`.trim()}
      />
    </div>
  );
});

type AuthPhoneInputProps = {
  id: string;
  label?: string;
  value: string;
  onChange: (digits: string) => void;
  disabled?: boolean;
  required?: boolean;
  name?: string;
};

export function AuthPhoneInput({
  id,
  label = 'Phone number',
  value,
  onChange,
  disabled,
  required,
  name = 'phone',
}: AuthPhoneInputProps) {
  return (
    <div className="w-full">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <div className="grid h-12 w-full grid-cols-[auto_1fr] items-stretch overflow-hidden rounded-xl border border-white/[0.08] bg-surface-input transition hover:border-white/[0.12] focus-within:border-blue-500/60 focus-within:ring-1 focus-within:ring-blue-500/40">
        <div className="flex items-center justify-center pl-4 pr-3.5" aria-hidden="true">
          <span className="text-sm font-medium tabular-nums text-slate-300">+91</span>
        </div>
        <div className="flex min-w-0 items-center border-l border-white/[0.08] pl-3.5 pr-4">
          <input
            id={id}
            name={name}
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            placeholder="Phone number"
            aria-label={label}
            value={value}
            disabled={disabled}
            required={required}
            readOnly
            onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
            onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 10))}
            className="auth-field h-full min-w-0 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500 disabled:opacity-50"
          />
        </div>
      </div>
    </div>
  );
}

type AuthSubmitButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  loading?: boolean;
  children: ReactNode;
};

export function AuthSubmitButton({ loading, children, disabled, className = '', ...props }: AuthSubmitButtonProps) {
  return (
    <button
      type="submit"
      disabled={disabled || loading}
      className={`auth-btn-primary ${className}`.trim()}
      {...props}
    >
      {loading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : children}
    </button>
  );
}
